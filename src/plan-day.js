/* ============================================================
   ENGINE / PlanDayEngine v2
   Czysty, deterministyczny planer. Nie jest Module, nie zapisuje
   stanu, nie emituje zdarzen i nie steruje jeszcze widokiem Dzis.
   ============================================================ */

const PLAN_DAY_MAX_TASKS_PER_MODULE = 500;
const PLAN_DAY_MAX_TASKS_TOTAL = 2000;
const PLAN_DAY_MAX_SELECTED = 100;
const PLAN_DAY_SELECTION_REASONS = Object.freeze([
  'URGENT_PHASE',
  'SCHEDULED_PHASE',
  'DOMAIN_FAIRNESS_PHASE',
  'GLOBAL_FILL_PHASE'
]);
const PLAN_DAY_DEFERRED_REASONS = Object.freeze([
  'ENERGY_TOO_LOW',
  'NO_AVAILABILITY',
  'NO_REMAINING_AVAILABILITY',
  'BUDGET_EXHAUSTED',
  'NO_FITTING_WINDOW',
  'SELECTION_LIMIT_REACHED',
  'DOMAIN_TURN_NOT_REACHED'
]);
const PLAN_DAY_EXCLUDED_REASONS = Object.freeze(['STATUS_DONE', 'STATUS_SKIPPED', 'INVALID_TASK']);
const PLAN_DAY_WARNING_CODES = Object.freeze([
  'MODULE_TASKS_UNAVAILABLE',
  'INVALID_TASK',
  'AVAILABILITY_NOT_CONFIGURED',
  'CHECK_IN_MISSING',
  'INVALID_ENERGY'
]);
const PLAN_DAY_FATAL_CODES = Object.freeze([
  'INVALID_INPUT',
  'INVALID_BUDGET',
  'INVALID_AVAILABILITY',
  'TASK_SOURCES_UNAVAILABLE'
]);

function clonePlanDayValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlanDayPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch (error) {
    return false;
  }
}

function planDayFatal(code, warnings = []) {
  return {
    ok: false,
    partial: false,
    code,
    warnings: clonePlanDayValue(warnings)
  };
}

function planDayBudgetForKey(key) {
  if (typeof key !== 'string') return null;
  const budget = TIME_BUDGETS.find(item => item.key === key);
  if (!budget || !Number.isInteger(budget.minutes) || ![30, 60, 150].includes(budget.minutes)) return null;
  return { key: budget.key, minutes: budget.minutes };
}

function planDayTimeToMinutes(value) {
  if (value === '24:00') return 1440;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function planDayMinutesToTime(value) {
  if (value === 1440) return '24:00';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function validatePlanDayModuleDescriptor(moduleDescriptor) {
  if (!isPlanDayPlainObject(moduleDescriptor)) return false;
  try {
    return typeof moduleDescriptor.id === 'string'
      && moduleDescriptor.id.trim().length > 0
      && typeof moduleDescriptor.name === 'string'
      && moduleDescriptor.name.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function validateTask(task, moduleDescriptor, sourceOrder) {
  if (!validatePlanDayModuleDescriptor(moduleDescriptor)
      || !Number.isInteger(sourceOrder)
      || sourceOrder < 0
      || sourceOrder >= PLAN_DAY_MAX_TASKS_PER_MODULE) {
    return { valid: false, code: 'INVALID_TASK' };
  }
  const check = validateTaskV2(task);
  if (!check.valid) return { valid: false, code: 'INVALID_TASK' };

  try {
    return {
      valid: true,
      task: {
        moduleId: moduleDescriptor.id,
        moduleName: moduleDescriptor.name,
        taskId: task.id,
        title: task.title,
        why: Object.prototype.hasOwnProperty.call(task, 'why') ? task.why : '',
        xp: Object.prototype.hasOwnProperty.call(task, 'xp') ? task.xp : 0,
        status: task.status,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        difficulty: task.difficulty,
        planningClass: task.planningClass,
        dueDate: Object.prototype.hasOwnProperty.call(task, 'dueDate') ? task.dueDate : null,
        completedDate: Object.prototype.hasOwnProperty.call(task, 'completedDate') ? task.completedDate : null,
        sourceOrder
      }
    };
  } catch (error) {
    return { valid: false, code: 'INVALID_TASK' };
  }
}

function validatePlanDayAvailability(value, date, planningStartMinute) {
  if (!isPlanDayPlainObject(value) || value.ok !== true || value.date !== date
      || value.weekday !== weekdayFromLocalDate(date)
      || typeof value.configured !== 'boolean' || !Array.isArray(value.intervals)) {
    return null;
  }

  if (!value.configured) {
    if (value.source !== 'unconfigured' || value.status !== 'unconfigured'
        || value.availableMinutes !== null || value.intervals.length !== 0) return null;
    return {
      configured: false,
      source: 'unconfigured',
      status: 'unconfigured',
      availableMinutes: null,
      remainingAvailableMinutes: null,
      sourceIntervals: [],
      planningWindows: []
    };
  }

  if (!['weekly', 'exception'].includes(value.source)
      || !['available', 'unavailable'].includes(value.status)
      || !Number.isInteger(value.availableMinutes)
      || value.availableMinutes < 0
      || value.availableMinutes > 1440
      || value.intervals.length > AVAILABILITY_MAX_INTERVALS_PER_DAY) return null;

  const sourceIntervals = [];
  let previousEnd = -1;
  let availableMinutes = 0;
  for (const interval of value.intervals) {
    const check = validateAvailabilityInterval(interval);
    if (!check.valid) return null;
    const start = planDayTimeToMinutes(interval.start);
    const end = planDayTimeToMinutes(interval.end);
    if (start < previousEnd) return null;
    previousEnd = end;
    availableMinutes += end - start;
    sourceIntervals.push({ start: interval.start, end: interval.end });
  }
  if (availableMinutes !== value.availableMinutes
      || (availableMinutes === 0) !== (value.status === 'unavailable')) return null;

  const numericWindows = [];
  for (const interval of sourceIntervals) {
    const originalStart = planDayTimeToMinutes(interval.start);
    const end = planDayTimeToMinutes(interval.end);
    if (end <= planningStartMinute) continue;
    const start = Math.max(originalStart, planningStartMinute);
    const previous = numericWindows.at(-1);
    if (previous && previous.end === start) previous.end = end;
    else numericWindows.push({ start, end });
  }
  const remainingAvailableMinutes = numericWindows.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  return {
    configured: true,
    source: value.source,
    status: value.status,
    availableMinutes,
    remainingAvailableMinutes,
    sourceIntervals,
    planningWindows: numericWindows
  };
}

function comparePlanDayDueDate(left, right) {
  if (left.dueDate === right.dueDate) return 0;
  if (left.dueDate === null) return 1;
  if (right.dueDate === null) return -1;
  return left.dueDate.localeCompare(right.dueDate);
}

function comparePlanDayUrgentOrScheduled(left, right) {
  return left.priority - right.priority
    || comparePlanDayDueDate(left, right)
    || left.moduleId.localeCompare(right.moduleId)
    || left.sourceOrder - right.sourceOrder;
}

function comparePlanDayFlexibleWithinDomain(left, right) {
  return left.priority - right.priority
    || comparePlanDayDueDate(left, right)
    || left.sourceOrder - right.sourceOrder;
}

function publicPlanDayTask(task) {
  return {
    moduleId: task.moduleId,
    moduleName: task.moduleName,
    taskId: task.taskId,
    title: task.title,
    why: task.why,
    xp: task.xp,
    status: task.status,
    priority: task.priority,
    estimatedMinutes: task.estimatedMinutes,
    difficulty: task.difficulty,
    planningClass: task.planningClass,
    dueDate: task.dueDate,
    completedDate: task.completedDate
  };
}

function planDaySourceFailure(warnings, excluded, moduleId, sourceOrder = null, invalidTask = false) {
  warnings.push({ code: 'MODULE_TASKS_UNAVAILABLE', moduleId });
  if (invalidTask) {
    warnings.push({ code: 'INVALID_TASK', moduleId, sourceOrder });
    if (excluded.length < PLAN_DAY_MAX_TASKS_TOTAL) {
      excluded.push({ moduleId, sourceOrder, reason: 'INVALID_TASK' });
    }
  }
}

function collectValidatedPlanDayTasks(sources) {
  if (!Array.isArray(sources)) return { invalidInput: true };
  const warnings = [];
  const excluded = [];
  const tasks = [];
  const moduleIds = new Set();
  let successfulSources = 0;
  let observedTaskCount = 0;

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const source = sources[sourceIndex];
    if (!isPlanDayPlainObject(source)
        || typeof source.moduleId !== 'string'
        || !source.moduleId.trim()
        || typeof source.moduleName !== 'string'
        || !source.moduleName.trim()
        || moduleIds.has(source.moduleId)) return { invalidInput: true };
    moduleIds.add(source.moduleId);

    let sourceTasks;
    try {
      sourceTasks = source.tasks;
    } catch (error) {
      planDaySourceFailure(warnings, excluded, source.moduleId);
      continue;
    }
    if (!Array.isArray(sourceTasks)) {
      planDaySourceFailure(warnings, excluded, source.moduleId);
      continue;
    }

    let sourceTaskCount;
    try {
      sourceTaskCount = sourceTasks.length;
    } catch (error) {
      planDaySourceFailure(warnings, excluded, source.moduleId);
      continue;
    }
    if (!Number.isInteger(sourceTaskCount)
        || sourceTaskCount < 0
        || sourceTaskCount > PLAN_DAY_MAX_TASKS_PER_MODULE
        || observedTaskCount + sourceTaskCount > PLAN_DAY_MAX_TASKS_TOTAL) {
      planDaySourceFailure(warnings, excluded, source.moduleId);
      continue;
    }
    observedTaskCount += sourceTaskCount;

    const descriptor = { id: source.moduleId, name: source.moduleName };
    const validated = [];
    const taskIds = new Set();
    let invalidSourceOrder = null;
    for (let sourceOrder = 0; sourceOrder < sourceTaskCount; sourceOrder++) {
      let sourceTask;
      try {
        sourceTask = sourceTasks[sourceOrder];
      } catch (error) {
        invalidSourceOrder = sourceOrder;
        break;
      }
      const result = validateTask(sourceTask, descriptor, sourceOrder);
      if (!result.valid || taskIds.has(result.task.taskId)) {
        invalidSourceOrder = sourceOrder;
        break;
      }
      taskIds.add(result.task.taskId);
      validated.push(result.task);
    }
    if (invalidSourceOrder !== null) {
      planDaySourceFailure(warnings, excluded, source.moduleId, invalidSourceOrder, true);
      continue;
    }

    successfulSources++;
    tasks.push(...validated);
  }

  const allowedInvalidMarkers = Math.max(0, PLAN_DAY_MAX_TASKS_TOTAL - tasks.length);
  if (excluded.length > allowedInvalidMarkers) excluded.length = allowedInvalidMarkers;
  return {
    fatal: sources.length === 0 || successfulSources === 0,
    partial: successfulSources !== sources.length,
    warnings,
    excluded,
    tasks
  };
}

function determinePlanDayEnergy(checkInCompleted, energyScore) {
  if (!checkInCompleted) {
    return {
      energy: { checkInCompleted: false, score: null, state: 'unknown' },
      warning: { code: 'CHECK_IN_MISSING' },
      filterHighDifficulty: false
    };
  }
  if (!Number.isInteger(energyScore) || energyScore < 0 || energyScore > 100) {
    return {
      energy: { checkInCompleted: true, score: null, state: 'unknown-invalid' },
      warning: { code: 'INVALID_ENERGY' },
      filterHighDifficulty: false
    };
  }
  const state = energyScore < 50 ? 'low' : energyScore < 75 ? 'medium' : 'high';
  return {
    energy: { checkInCompleted: true, score: energyScore, state },
    warning: null,
    filterHighDifficulty: state === 'low'
  };
}

function planDayDeferredDetails(reason, task, context) {
  if (reason === 'ENERGY_TOO_LOW') return { energyState: 'low', difficulty: task.difficulty };
  if (reason === 'NO_AVAILABILITY') return { availableMinutes: 0 };
  if (reason === 'NO_REMAINING_AVAILABILITY') {
    return { availableMinutes: context.availableMinutes, remainingAvailableMinutes: 0 };
  }
  if (reason === 'BUDGET_EXHAUSTED') return { remainingBudgetMinutes: context.remainingBudgetMinutes };
  if (reason === 'NO_FITTING_WINDOW') {
    return { estimatedMinutes: task.estimatedMinutes, largestRemainingWindowMinutes: context.largestRemainingWindowMinutes };
  }
  if (reason === 'SELECTION_LIMIT_REACHED') return { selectedLimit: PLAN_DAY_MAX_SELECTED };
  return { selectedLimit: PLAN_DAY_MAX_SELECTED };
}

function buildPlan(input) {
  try {
    if (!isPlanDayPlainObject(input)
        || !isValidCalendarDateString(input.date)
        || !Number.isInteger(input.planningStartMinute)
        || input.planningStartMinute < 0
        || input.planningStartMinute > 1440
        || typeof input.checkInCompleted !== 'boolean') {
      return planDayFatal('INVALID_INPUT');
    }

    const approvedBudget = planDayBudgetForKey(input.manualBudgetKey);
    if (!approvedBudget || input.manualBudgetMinutes !== approvedBudget.minutes) {
      return planDayFatal('INVALID_BUDGET');
    }

    let availabilityState;
    try {
      availabilityState = validatePlanDayAvailability(input.availability, input.date, input.planningStartMinute);
    } catch (error) {
      return planDayFatal('INVALID_AVAILABILITY');
    }
    if (!availabilityState) return planDayFatal('INVALID_AVAILABILITY');

    const collected = collectValidatedPlanDayTasks(input.sources);
    if (collected.invalidInput) return planDayFatal('INVALID_INPUT');
    if (collected.fatal) return planDayFatal('TASK_SOURCES_UNAVAILABLE', collected.warnings || []);

    const energyState = determinePlanDayEnergy(input.checkInCompleted, input.energyScore);
    const warnings = [...collected.warnings];
    if (!availabilityState.configured) warnings.push({ code: 'AVAILABILITY_NOT_CONFIGURED' });
    if (energyState.warning) warnings.push(energyState.warning);

    const effectiveBudgetMinutes = availabilityState.configured
      ? Math.min(approvedBudget.minutes, availabilityState.remainingAvailableMinutes)
      : approvedBudget.minutes;
    const budgetSource = !availabilityState.configured
      ? 'manual'
      : availabilityState.remainingAvailableMinutes < approvedBudget.minutes
        ? 'manual-capped-by-availability'
        : 'manual-within-availability';

    const excluded = [...collected.excluded];
    const completedToday = [];
    const todo = [];
    for (const task of collected.tasks) {
      if (task.status === 'done') {
        const record = { ...publicPlanDayTask(task), reason: 'STATUS_DONE' };
        if (task.completedDate === input.date) completedToday.push(record);
        else excluded.push(record);
      } else if (task.status === 'skipped') {
        excluded.push({ ...publicPlanDayTask(task), reason: 'STATUS_SKIPPED' });
      } else {
        todo.push(task);
      }
    }

    const energyDeferred = [];
    const eligible = [];
    for (const task of todo) {
      if (energyState.filterHighDifficulty && task.difficulty >= 4) energyDeferred.push(task);
      else eligible.push(task);
    }

    const windowStates = availabilityState.planningWindows.map((interval, index) => ({
      start: interval.start,
      end: interval.end,
      cursor: interval.start,
      index
    }));
    let remainingBudgetMinutes = effectiveBudgetMinutes;
    const selected = [];
    const selectedTasks = new Set();

    function trySelect(task, phase, selectionReason) {
      if (selected.length >= PLAN_DAY_MAX_SELECTED || task.estimatedMinutes > remainingBudgetMinutes) return false;
      let selectedWindow = null;
      if (availabilityState.configured) {
        const fitting = windowStates.filter(window => window.end - window.cursor >= task.estimatedMinutes);
        if (!fitting.length) return false;
        fitting.sort((left, right) => {
          const leftCapacity = left.end - left.cursor;
          const rightCapacity = right.end - right.cursor;
          return leftCapacity - rightCapacity || left.cursor - right.cursor || left.index - right.index;
        });
        selectedWindow = fitting[0];
      }

      const slot = selectedWindow
        ? { start: planDayMinutesToTime(selectedWindow.cursor), end: planDayMinutesToTime(selectedWindow.cursor + task.estimatedMinutes) }
        : null;
      if (selectedWindow) selectedWindow.cursor += task.estimatedMinutes;
      remainingBudgetMinutes -= task.estimatedMinutes;
      selectedTasks.add(task);
      selected.push({
        ...publicPlanDayTask(task),
        selectionRank: selected.length + 1,
        executionOrder: 0,
        phase,
        selectionReason,
        slot
      });
      return true;
    }

    const urgent = eligible.filter(task => task.planningClass === 'urgent').sort(comparePlanDayUrgentOrScheduled);
    const scheduled = eligible.filter(task => task.planningClass === 'scheduled').sort(comparePlanDayUrgentOrScheduled);
    const flexible = eligible.filter(task => task.planningClass === 'flexible');

    urgent.forEach(task => trySelect(task, 'urgent', 'URGENT_PHASE'));
    scheduled.forEach(task => trySelect(task, 'scheduled', 'SCHEDULED_PHASE'));

    const flexibleByModule = new Map();
    for (const task of flexible) {
      if (!flexibleByModule.has(task.moduleId)) flexibleByModule.set(task.moduleId, []);
      flexibleByModule.get(task.moduleId).push(task);
    }
    for (const tasks of flexibleByModule.values()) tasks.sort(comparePlanDayFlexibleWithinDomain);

    const domainIds = [...flexibleByModule.keys()].sort((left, right) => left.localeCompare(right));
    const offset = domainIds.length ? positiveModulo(civilDayOrdinal(input.date), domainIds.length) : 0;
    const rotatedDomainIds = domainIds.length
      ? [...domainIds.slice(offset), ...domainIds.slice(0, offset)]
      : [];
    const rotatedPositions = new Map(rotatedDomainIds.map((moduleId, index) => [moduleId, index]));
    const domainsNotReached = new Set();

    for (let domainIndex = 0; domainIndex < rotatedDomainIds.length; domainIndex++) {
      const moduleId = rotatedDomainIds[domainIndex];
      if (selected.length >= PLAN_DAY_MAX_SELECTED) {
        for (let index = domainIndex; index < rotatedDomainIds.length; index++) domainsNotReached.add(rotatedDomainIds[index]);
        break;
      }
      const candidates = flexibleByModule.get(moduleId);
      for (const task of candidates) {
        if (trySelect(task, 'domain-fairness', 'DOMAIN_FAIRNESS_PHASE')) break;
      }
    }

    if (selected.length < PLAN_DAY_MAX_SELECTED) {
      const globalCandidates = flexible
        .filter(task => !selectedTasks.has(task))
        .sort((left, right) => left.priority - right.priority
          || comparePlanDayDueDate(left, right)
          || rotatedPositions.get(left.moduleId) - rotatedPositions.get(right.moduleId)
          || left.sourceOrder - right.sourceOrder);
      globalCandidates.forEach(task => trySelect(task, 'global-fill', 'GLOBAL_FILL_PHASE'));
    }

    const deferredInternal = energyDeferred.map(task => ({ task, reason: 'ENERGY_TOO_LOW' }));
    const initialRemainingAvailability = availabilityState.remainingAvailableMinutes;
    for (const task of eligible) {
      if (selectedTasks.has(task)) continue;
      let reason;
      if (availabilityState.configured && availabilityState.availableMinutes === 0) {
        reason = 'NO_AVAILABILITY';
      } else if (availabilityState.configured
          && availabilityState.availableMinutes > 0
          && initialRemainingAvailability === 0) {
        reason = 'NO_REMAINING_AVAILABILITY';
      } else if (task.estimatedMinutes > remainingBudgetMinutes) {
        reason = 'BUDGET_EXHAUSTED';
      } else if (availabilityState.configured
          && !windowStates.some(window => window.end - window.cursor >= task.estimatedMinutes)) {
        reason = 'NO_FITTING_WINDOW';
      } else if (domainsNotReached.has(task.moduleId) && task.planningClass === 'flexible') {
        reason = 'DOMAIN_TURN_NOT_REACHED';
      } else if (selected.length >= PLAN_DAY_MAX_SELECTED) {
        reason = 'SELECTION_LIMIT_REACHED';
      } else {
        reason = 'BUDGET_EXHAUSTED';
      }
      deferredInternal.push({ task, reason });
    }

    const classRank = { urgent: 0, scheduled: 1, flexible: 2 };
    deferredInternal.sort((left, right) => classRank[left.task.planningClass] - classRank[right.task.planningClass]
      || (left.task.planningClass === 'flexible'
        ? left.task.moduleId.localeCompare(right.task.moduleId) || comparePlanDayFlexibleWithinDomain(left.task, right.task)
        : comparePlanDayUrgentOrScheduled(left.task, right.task)));

    const largestRemainingWindowMinutes = windowStates.reduce(
      (largest, window) => Math.max(largest, window.end - window.cursor),
      0
    );
    const deferred = deferredInternal.map(({ task, reason }) => ({
      ...publicPlanDayTask(task),
      reason,
      details: planDayDeferredDetails(reason, task, {
        availableMinutes: availabilityState.availableMinutes,
        remainingBudgetMinutes,
        largestRemainingWindowMinutes
      })
    }));

    const executionSorted = [...selected].sort((left, right) => {
      if (left.slot === null || right.slot === null) return left.selectionRank - right.selectionRank;
      return planDayTimeToMinutes(left.slot.start) - planDayTimeToMinutes(right.slot.start)
        || planDayTimeToMinutes(left.slot.end) - planDayTimeToMinutes(right.slot.end)
        || left.selectionRank - right.selectionRank;
    });
    executionSorted.forEach((task, index) => { task.executionOrder = index + 1; });

    const plannedMinutes = effectiveBudgetMinutes - remainingBudgetMinutes;
    const result = {
      ok: true,
      partial: collected.partial,
      date: input.date,
      mode: availabilityState.configured ? 'scheduled' : 'unscheduled',
      planningStartMinute: input.planningStartMinute,
      energy: energyState.energy,
      budget: {
        manualBudgetKey: approvedBudget.key,
        manualBudgetMinutes: approvedBudget.minutes,
        availableMinutes: availabilityState.availableMinutes,
        remainingAvailableMinutes: availabilityState.remainingAvailableMinutes,
        effectiveBudgetMinutes,
        source: budgetSource
      },
      availability: {
        configured: availabilityState.configured,
        source: availabilityState.source,
        status: availabilityState.status
      },
      sourceIntervals: clonePlanDayValue(availabilityState.sourceIntervals),
      planningWindows: availabilityState.planningWindows.map(interval => ({
        start: planDayMinutesToTime(interval.start),
        end: planDayMinutesToTime(interval.end)
      })),
      selected: executionSorted,
      deferred,
      excluded,
      completedToday,
      warnings,
      totals: {
        plannedMinutes,
        unusedEffectiveMinutes: effectiveBudgetMinutes - plannedMinutes,
        uncommittedAvailabilityMinutes: availabilityState.configured
          ? availabilityState.remainingAvailableMinutes - plannedMinutes
          : null
      }
    };

    const taskRecordCount = result.selected.length + result.deferred.length + result.excluded.length + result.completedToday.length;
    if (result.selected.length > PLAN_DAY_MAX_SELECTED || taskRecordCount > PLAN_DAY_MAX_TASKS_TOTAL) {
      return planDayFatal('INVALID_INPUT');
    }
    return clonePlanDayValue(result);
  } catch (error) {
    return planDayFatal('INVALID_INPUT');
  }
}

function planDayInputFromPublicSources(date, budgetKey, planningStartMinute) {
  const approvedBudget = planDayBudgetForKey(budgetKey);
  if (!approvedBudget) return planDayFatal('INVALID_BUDGET');

  let record;
  try {
    record = DayEngine.getRecord(date);
  } catch (error) {
    return planDayFatal('INVALID_INPUT');
  }

  let availability;
  try {
    availability = AvailabilityEngine.getAvailabilityForDate(date);
  } catch (error) {
    return planDayFatal('INVALID_AVAILABILITY');
  }

  let modules;
  try {
    modules = ModuleRegistry.all();
  } catch (error) {
    return planDayFatal('TASK_SOURCES_UNAVAILABLE');
  }
  if (!Array.isArray(modules)) return planDayFatal('TASK_SOURCES_UNAVAILABLE');

  const sources = modules.map((module, index) => {
    let moduleId = '';
    let moduleName = '';
    try {
      moduleId = module.id;
      moduleName = module.name;
      const tasks = module.getTasks(date);
      return { moduleId, moduleName, tasks };
    } catch (error) {
      return {
        moduleId: typeof moduleId === 'string' && moduleId ? moduleId : `unavailable-module-${index}`,
        moduleName: typeof moduleName === 'string' && moduleName ? moduleName : 'Niedostepne zrodlo',
        tasks: null
      };
    }
  });

  let checkInCompleted = false;
  let energyScore = null;
  try {
    checkInCompleted = isPlanDayPlainObject(record)
      && Object.prototype.hasOwnProperty.call(record, 'energyScore');
    if (checkInCompleted) energyScore = record.energyScore;
  } catch (error) {
    return planDayFatal('INVALID_INPUT');
  }

  return buildPlan({
    date,
    manualBudgetKey: approvedBudget.key,
    manualBudgetMinutes: approvedBudget.minutes,
    checkInCompleted,
    energyScore,
    availability,
    planningStartMinute,
    sources
  });
}

function getPlanForDate(date, budgetKey, planningStartMinute = 0) {
  if (!isValidCalendarDateString(date)
      || !Number.isInteger(planningStartMinute)
      || planningStartMinute < 0
      || planningStartMinute > 1440) {
    return planDayFatal('INVALID_INPUT');
  }
  return planDayInputFromPublicSources(date, budgetKey, planningStartMinute);
}

function getPlanForToday(budgetKey, now = new Date()) {
  let captured;
  try {
    const timestamp = Date.prototype.getTime.call(now);
    if (!Number.isFinite(timestamp)) return planDayFatal('INVALID_INPUT');
    captured = new Date(timestamp);
  } catch (error) {
    return planDayFatal('INVALID_INPUT');
  }
  const date = localDateKey(captured);
  const planningStartMinute = captured.getHours() * 60 + captured.getMinutes();
  return getPlanForDate(date, budgetKey, planningStartMinute);
}

const PlanDayEngine = Object.freeze({
  validateTask,
  buildPlan,
  getPlanForToday,
  getPlanForDate
});

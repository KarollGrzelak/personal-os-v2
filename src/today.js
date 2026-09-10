/* ============================================================
   ENGINE / DayEngine
   Odpowiedzialność: jedna rzecz — liczy energię na dziś na
   podstawie snu (i w przyszłości, gdy powstanie moduł Trening,
   także wczorajszego obciążenia treningowego). Nie wie nic
   o zadaniach ani priorytetach — to rola PriorityEngine/
   DecisionEngine w Kroku 3.
   ============================================================ */
const DayEngine = (() => {
  function todayKey() { return localDateKey(); }

  function getRecord(date) {
    const recs = Store.get('dayRecords', {});
    return recs[date] || null;
  }

  // Sen 8-9h + dobra jakość = wysoka energia. To celowo prosta,
  // czytelna formuła — nie czarna skrzynka.
  function computeEnergy(sleepHours, sleepQuality, trainingLoadYesterday = 0) {
    const sleepScore = Math.min(100, (sleepHours / 9) * 70 + (sleepQuality / 5) * 30);
    const fatigue = Math.min(20, trainingLoadYesterday / 5);
    return Math.max(0, Math.round(sleepScore - fatigue));
  }

  function advice(energy) {
    if (energy >= 75) return { level: 'wysoka', text: 'Świetna energia — możesz iść pełną parą z najtrudniejszymi zadaniami dnia.' };
    if (energy >= 50) return { level: 'średnia', text: 'Energia w normie — trzymaj się planu, bez dokładania dodatkowych rzeczy.' };
    return { level: 'niska', text: 'Niska energia — dziś priorytet to regeneracja: lżejszy trening, nauka w mniejszych dawkach.' };
  }

  // Zapisuje obciążenie treningowe dla danej daty w DayRecord.
  // Wywoływane przez moduł Trening (Krok 4) po każdej zmianie w logu
  // ćwiczeń — DayEngine NIE zna szczegółów treningu (serie, RPE),
  // dostaje już gotową, wyliczoną liczbę. To Core udostępnia miejsce
  // w DayRecord, moduł dostarcza wartość — kierunek zależności jest
  // jednostronny (Training → DayEngine), zgodnie z architekturą v2.
  function recordTrainingLoad(date, load) {
    const recs = Store.get('dayRecords', {});
    recs[date] = { ...(recs[date] || { date }), trainingLoad: load };
    Store.set('dayRecords', recs);
  }

  function getTrainingLoad(date) {
    const rec = getRecord(date);
    return rec && typeof rec.trainingLoad === 'number' ? rec.trainingLoad : 0;
  }

  // checkIn() sam sięga po WCZORAJSZE obciążenie treningowe —
  // parametr trainingLoadYesterday w computeEnergy() był gotowy od
  // Kroku 2, ale zawsze dostawał 0, bo modułu Trening jeszcze nie
  // było. Od Kroku 4 dostaje realną wartość, bez zmiany sygnatury.
  function checkIn(hours, quality) {
    const date = todayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLoad = getTrainingLoad(localDateKey(yesterday));

    const recs = Store.get('dayRecords', {});
    const energyScore = computeEnergy(hours, quality, yesterdayLoad);
    recs[date] = { ...(recs[date] || {}), date, sleepHours: hours, sleepQuality: quality, energyScore };
    Store.set('dayRecords', recs);
    EventBus.emit('day:checkin', recs[date]);
    return recs[date];
  }

  return { todayKey, getRecord, computeEnergy, advice, checkIn, recordTrainingLoad, getTrainingLoad };
})();

/* ============================================================
   ENGINE / HabitEngine
   Odpowiedzialność: nawyki niezależne od sezonów (patrz sekcja
   architektury "System nawyków"). Streak liczony per nawyk,
   nie jeden globalny — jeden urwany nawyk nie zeruje reszty.
   ============================================================ */
const DEFAULT_HABITS = [
  // goalPillar dokumentuje, KTÓREMU z 3 filarów służy nawyk —
  // zgodnie z zasadą "każda funkcja ma uzasadnienie".
  { id: 'sleep8', label: '8-9h snu', goalPillar: 'physique', xp: 40, frequency: 'daily', active: true },
  { id: 'water', label: 'Woda jako główny napój dziś', goalPillar: 'physique', xp: 10, frequency: 'daily', active: true },
  { id: 'focus', label: 'Brak bezmyślnego scrollowania poza zaplanowanym czasem', goalPillar: 'it-job', xp: 15, frequency: 'daily', active: true },
  { id: 'note', label: 'Notatka dnia zapisana (czego się nauczyłem)', goalPillar: 'it-job', xp: 15, frequency: 'daily', active: true }
];

const HabitEngine = (() => {
  function defs() { return Store.get('habitDefs', DEFAULT_HABITS); }

  function isDone(habitId, date) {
    const logs = Store.get('habitLogs', {});
    return !!(logs[habitId] && logs[habitId][date]);
  }

  function log(habitId, date, done) {
    const logs = Store.get('habitLogs', {});
    logs[habitId] = logs[habitId] || {};
    logs[habitId][date] = done;
    Store.set('habitLogs', logs);
    EventBus.emit('habit:change', { habitId, date, done });
  }

  // Streak liczony wstecz. BŁĄD Z KROKU 3: jeśli dziś jeszcze
  // nieodhaczone, pętla startowała OD DZIŚ, nie znajdowała wpisu
  // i przerywała się natychmiast — seria z poprzednich dni znikała
  // z UI rano, zanim użytkownik zdążył cokolwiek zrobić. Poprawka:
  // gdy dziś puste, start liczenia przesuwamy na wczoraj — seria
  // "wciąż żyje" aż do końca dzisiejszego dnia.
  function streak(habitId) {
    const logs = Store.get('habitLogs', {});
    const today = localDateKey();
    let s = 0;
    let d = new Date();
    if (!(logs[habitId] && logs[habitId][today])) {
      d.setDate(d.getDate() - 1); // dziś puste — zaczynamy liczyć od wczoraj
    }
    for (let i = 0; i < 365; i++) {
      const k = localDateKey(d);
      if (logs[habitId] && logs[habitId][k]) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  }

  return { defs, isDone, log, streak };
})();

/* ============================================================
   WIDOK: Dziś
   Łączy DayEngine (energia z snu) i HabitEngine (nawyki).
   To pierwszy realny ekran aplikacji — reszta (zadania modułów,
   filtrowanie wg priorytetów) dojdzie w Kroku 3, gdy powstanie
   PriorityEngine/DecisionEngine.
   ============================================================ */
let todayPlanLastRenderedDate = null;
let todayPendingFocus = null;
const TODAY_NEXT_VISIBLE_LIMIT = 4;

function renderDzis(now = new Date()) {
  return renderTodayTasks(now);
}

function clearTodayNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function createTodayNode(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}

const todayTaskActionTargets = new WeakMap();
const todayDetailsActionTargets = new WeakMap();
const todayHabitTargets = new WeakMap();

function todayBudgetSourceLabel(source) {
  if (source === 'manual') return 'budżet ręczny';
  if (source === 'manual-within-availability') return 'budżet ręczny w granicach dostępności';
  if (source === 'manual-capped-by-availability') return 'budżet ograniczony dostępnością';
  return 'źródło budżetu niedostępne';
}

function todayPlanningClassLabel(planningClass) {
  if (planningClass === 'urgent') return 'pilne';
  if (planningClass === 'scheduled') return 'zaplanowane';
  if (planningClass === 'flexible') return 'elastyczne';
  return 'status planistyczny niedostępny';
}

function todaySelectionReason(reason) {
  const messages = {
    URGENT_PHASE: 'To zadanie jest pilne i ma pierwszeństwo.',
    SCHEDULED_PHASE: 'To zaplanowana aktywność na dziś.',
    DOMAIN_FAIRNESS_PHASE: 'Ten krok utrzymuje równowagę między ważnymi obszarami.',
    GLOBAL_FILL_PHASE: 'To najlepszy kolejny krok, który mieści się w pozostałym czasie.'
  };
  return messages[reason] || 'To zadanie jest następnym wykonalnym krokiem w dzisiejszym planie.';
}

function todayDeferredMessage(reason) {
  const messages = {
    ENERGY_TOO_LOW: 'Odłożone z powodu zbyt niskiej energii.',
    NO_AVAILABILITY: 'Brak zadeklarowanej dostępności w tym dniu.',
    NO_REMAINING_AVAILABILITY: 'Dzisiejsze dostępne przedziały już minęły.',
    BUDGET_EXHAUSTED: 'Zadanie nie mieści się w pozostałym budżecie.',
    NO_FITTING_WINDOW: 'Zadanie nie mieści się w żadnym pojedynczym oknie.',
    SELECTION_LIMIT_REACHED: 'Osiągnięto limit liczby zadań w planie.',
    DOMAIN_TURN_NOT_REACHED: 'Limit planu zatrzymał pierwszą rundę tej domeny.'
  };
  return messages[reason] || 'Zadanie zostało odłożone z bezpiecznie ukrytego powodu.';
}

function todayWarningMessage(code) {
  const messages = {
    MODULE_TASKS_UNAVAILABLE: 'Jedno ze źródeł zadań jest chwilowo niedostępne.',
    INVALID_TASK: 'Jedno ze źródeł zawiera niepoprawne zadanie i zostało pominięte.',
    AVAILABILITY_NOT_CONFIGURED: 'Dostępność nie jest skonfigurowana — używam wyłącznie ręcznego budżetu.',
    CHECK_IN_MISSING: 'Brak porannego check-inu — trudność zadań nie jest filtrowana.',
    INVALID_ENERGY: 'Zapis energii jest niepoprawny — trudność zadań nie jest filtrowana.'
  };
  return messages[code] || 'Plan zawiera dodatkowe ostrzeżenie.';
}

function todayFatalMessage(code) {
  const messages = {
    INVALID_INPUT: 'Nie można przygotować planu z bieżących danych.',
    INVALID_BUDGET: 'Wybrany budżet czasu jest niepoprawny.',
    INVALID_AVAILABILITY: 'Konfiguracja dostępności jest niepoprawna.',
    TASK_SOURCES_UNAVAILABLE: 'Żadne źródło zadań nie jest obecnie dostępne.'
  };
  return messages[code] || 'Nie udało się bezpiecznie przygotować planu dnia.';
}

function todayExcludedMessage(reason) {
  if (reason === 'STATUS_DONE') return 'Ukończone w innym dniu.';
  if (reason === 'STATUS_SKIPPED') return 'Pominięte.';
  if (reason === 'INVALID_TASK') return 'Niepoprawne zadanie zostało bezpiecznie wykluczone.';
  return 'Zadanie zostało bezpiecznie wykluczone.';
}

function canOpenTodayTaskDetails(moduleId) {
  if (typeof moduleId !== 'string' || !moduleId) return false;
  const owner = ModuleRegistry.get(moduleId);
  const view = typeof getAppView === 'function' ? getAppView(moduleId) : null;
  return !!(owner && view);
}

function appendTodayTaskActions(parent, task, action) {
  const actions = createTodayNode('div', 'today-task-actions');
  if (action === 'complete' || action === 'undo') {
    const label = action === 'complete' ? 'Ukończ' : 'Cofnij ukończenie';
    const button = createTodayNode('button', action === 'complete' ? 'primary' : 'ghost', label);
    button.type = 'button';
    button.dataset.module = task.moduleId;
    button.dataset.task = task.taskId;
    button.dataset.action = action;
    button.setAttribute('aria-label', `${label}: ${task.title}`);
    todayTaskActionTargets.set(button, { moduleId: task.moduleId, taskId: task.taskId });
    actions.appendChild(button);
  }
  if (action === 'complete' && canOpenTodayTaskDetails(task.moduleId)) {
    const detailsButton = createTodayNode('button', 'ghost', 'Otwórz szczegóły');
    detailsButton.type = 'button';
    detailsButton.dataset.action = 'open-details';
    detailsButton.setAttribute('aria-label', `Otwórz szczegóły w obszarze ${task.moduleName || task.moduleId}`);
    todayDetailsActionTargets.set(detailsButton, { moduleId: task.moduleId });
    actions.appendChild(detailsButton);
  }
  if (actions.childElementCount) parent.appendChild(actions);
}

function appendTodayTaskSummary(parent, task, options = {}) {
  const row = createTodayNode('article', `today-plan-task${options.done ? ' done' : ''}${task.planningClass === 'urgent' ? ' urgent' : ''}${options.prominent ? ' prominent' : ''}`);
  const body = createTodayNode('div', 'today-plan-task-body');
  body.appendChild(createTodayNode(options.prominent ? 'h3' : 'div', 'today-plan-task-title', task.title || 'Zadanie bez tytułu'));
  const meta = createTodayNode('div', 'today-plan-task-meta');
  meta.appendChild(createTodayNode('span', '', task.moduleName || task.moduleId || 'Nieznana domena'));
  if (Number.isInteger(task.estimatedMinutes)) meta.appendChild(createTodayNode('span', '', `${task.estimatedMinutes} min`));
  if (options.showPlanningClass && task.planningClass) meta.appendChild(createTodayNode('span', '', todayPlanningClassLabel(task.planningClass)));
  if (options.scheduled && task.slot && typeof task.slot.start === 'string' && typeof task.slot.end === 'string') {
    meta.appendChild(createTodayNode('span', 'today-plan-slot', `${task.slot.start}–${task.slot.end}`));
  }
  if (options.showOrder && Number.isInteger(task.executionOrder)) meta.appendChild(createTodayNode('span', '', `Kolejność ${task.executionOrder}`));
  body.appendChild(meta);
  if (options.selectionReason) body.appendChild(createTodayNode('p', 'today-plan-selection-reason', todaySelectionReason(task.selectionReason)));
  if (typeof task.why === 'string' && task.why) {
    const why = createTodayNode('p', 'today-plan-why');
    why.appendChild(createTodayNode('strong', '', 'Cel: '));
    why.appendChild(document.createTextNode(task.why));
    body.appendChild(why);
  }
  if (options.message) body.appendChild(createTodayNode('div', 'today-plan-reason', options.message));
  row.appendChild(body);
  appendTodayTaskActions(row, task, options.action);
  parent.appendChild(row);
}

function delegateTodayTaskStatus(moduleId, taskId, status) {
  const owner = ModuleRegistry.get(moduleId);
  if (!owner || typeof owner.setTaskStatus !== 'function') return { ok: false, changed: false };

  let matchingEvent = false;
  const unsubscribe = EventBus.on('task:status', payload => {
    try {
      if (payload && payload.moduleId === moduleId && payload.taskId === taskId && payload.status === status) matchingEvent = true;
    } catch (error) { /* niezaufany payload nie może przerwać delegowania */ }
  });
  let result;
  try {
    result = owner.setTaskStatus(taskId, status);
  } catch (error) {
    return { ok: false, changed: false };
  } finally {
    unsubscribe();
  }
  if (matchingEvent) return { ok: true, changed: true };
  if (result && result.ok === false) return { ok: false, changed: false };
  return { ok: true, changed: false };
}

function renderTodayPlanResult(plan, container) {
  if (!container) return;
  clearTodayNode(container);
  const layout = container.id === 'today-tasks' ? container : createTodayNode('div', 'today-product-layout');
  if (container.id !== 'today-tasks') {
    layout.id = 'today-tasks';
    container.appendChild(layout);
  } else layout.className = 'today-product-layout';

  const warnings = Array.isArray(plan && plan.warnings) ? plan.warnings : [];
  const selected = Array.isArray(plan && plan.selected) ? plan.selected : [];
  const completed = Array.isArray(plan && plan.completedToday) ? plan.completedToday : [];
  const deferred = Array.isArray(plan && plan.deferred) ? plan.deferred : [];
  const excluded = Array.isArray(plan && plan.excluded) ? plan.excluded : [];
  const isSuccess = plan && plan.ok === true;

  const alerts = createTodayNode('section', 'today-alerts');
  alerts.id = 'today-action-alerts';
  alerts.setAttribute('aria-label', 'Ważne informacje na dziś');
  alerts.setAttribute('aria-live', 'polite');
  if (!isSuccess) {
    const fatal = createTodayNode('div', 'today-alert today-alert-error today-plan-fatal');
    fatal.setAttribute('role', 'alert');
    fatal.appendChild(createTodayNode('strong', '', 'Plan wymaga uwagi.'));
    fatal.appendChild(createTodayNode('p', '', todayFatalMessage(plan && plan.code)));
    const actions = createTodayNode('div', 'today-alert-actions');
    const retry = createTodayNode('button', 'ghost', 'Spróbuj ponownie');
    retry.type = 'button';
    retry.dataset.todayRetry = 'true';
    actions.appendChild(retry);
    if (plan && plan.code === 'INVALID_AVAILABILITY') {
      const settings = createTodayNode('button', 'ghost', 'Przejdź do ustawień');
      settings.type = 'button';
      settings.dataset.todayRoute = 'settings';
      actions.appendChild(settings);
    } else if (plan && plan.code === 'INVALID_BUDGET') {
      const budgetAction = createTodayNode('button', 'ghost', 'Wybierz budżet');
      budgetAction.type = 'button';
      budgetAction.dataset.todayFocus = 'today-budget';
      actions.appendChild(budgetAction);
    }
    fatal.appendChild(actions);
    alerts.appendChild(fatal);
  } else {
    if (plan.partial) {
      const partial = createTodayNode('div', 'today-alert today-alert-warning today-plan-partial');
      partial.setAttribute('role', 'status');
      partial.appendChild(createTodayNode('strong', '', 'Plan jest częściowy.'));
      partial.appendChild(createTodayNode('p', '', 'Możesz wykonać widoczną część planu. Co najmniej jedno źródło zadań wymaga sprawdzenia.'));
      alerts.appendChild(partial);
    }
    if (plan.energy && plan.energy.state === 'low') {
      const lowEnergy = createTodayNode('div', 'today-alert today-alert-warning today-low-energy');
      lowEnergy.appendChild(createTodayNode('strong', '', 'Dziś warto działać łagodniej.'));
      lowEnergy.appendChild(createTodayNode('p', '', 'Niska energia ograniczyła trudniejsze zadania. To informacja do dopasowania tempa, nie ocena Twojego dnia.'));
      alerts.appendChild(lowEnergy);
    }
    warnings.forEach(warning => {
      const warningCode = warning && warning.code;
      const warningElement = createTodayNode('div', 'today-alert today-alert-warning');
      warningElement.appendChild(createTodayNode('p', '', todayWarningMessage(warningCode)));
      if (warningCode === 'CHECK_IN_MISSING') {
        const action = createTodayNode('button', 'ghost', 'Uzupełnij check-in');
        action.type = 'button';
        action.dataset.todayFocus = 'today-checkin';
        warningElement.appendChild(action);
      }
      if (warningCode === 'AVAILABILITY_NOT_CONFIGURED') {
        const action = createTodayNode('button', 'ghost', 'Ustaw dostępność');
        action.type = 'button';
        action.dataset.todayRoute = 'settings';
        warningElement.appendChild(action);
      }
      alerts.appendChild(warningElement);
    });
    if (plan.energy && plan.energy.checkInCompleted === false && plan.availability && plan.availability.configured === false) {
      const guide = createTodayNode('div', 'today-alert today-start-guide');
      guide.appendChild(createTodayNode('strong', '', 'Dobry początek to trzy krótkie kroki:'));
      const list = createTodayNode('ol', 'today-start-list');
      [['Uzupełnij check-in', 'today-checkin'], ['Wybierz budżet', 'today-budget']].forEach(([label, target]) => {
        const item = createTodayNode('li');
        const action = createTodayNode('button', 'link-btn', label);
        action.type = 'button';
        action.dataset.todayFocus = target;
        item.appendChild(action);
        list.appendChild(item);
      });
      const item = createTodayNode('li');
      const settings = createTodayNode('button', 'link-btn', 'Skonfiguruj dostępność');
      settings.type = 'button';
      settings.dataset.todayRoute = 'settings';
      item.appendChild(settings);
      list.appendChild(item);
      guide.appendChild(list);
      alerts.appendChild(guide);
    }
  }
  const contexts = createTodayNode('div', 'today-context-notes');
  contexts.id = 'day-context-notes';
  alerts.appendChild(contexts);
  layout.appendChild(alerts);

  const checkIn = createTodayNode('section', 'card today-checkin-card');
  checkIn.id = 'today-checkin';
  checkIn.tabIndex = -1;
  checkIn.appendChild(createTodayNode('h2', '', 'Check-in i energia'));
  const checkInContent = createTodayNode('div', 'today-checkin-content');
  checkInContent.id = 'today-checkin-content';
  checkIn.appendChild(checkInContent);
  layout.appendChild(checkIn);

  const nowSection = createTodayNode('section', 'card today-now-card today-plan-selected');
  nowSection.appendChild(createTodayNode('h2', '', 'Teraz'));
  if (!isSuccess) {
    nowSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Najpierw popraw dane planu albo spróbuj ponownie.'));
  } else if (selected.length) {
    appendTodayTaskSummary(nowSection, selected[0], {
      action: 'complete',
      prominent: true,
      scheduled: plan.mode === 'scheduled',
      selectionReason: true
    });
  } else if (completed.length && deferred.length === 0) {
    const success = createTodayNode('div', 'today-all-done');
    success.appendChild(createTodayNode('strong', '', 'Wszystko na dziś zrobione.'));
    success.appendChild(createTodayNode('p', '', 'Dobra robota — ukończone zadania znajdziesz niżej.'));
    nowSection.appendChild(success);
  } else if (deferred.length) {
    nowSection.appendChild(createTodayNode('p', 'today-plan-empty', 'W bieżącej energii, dostępności lub budżecie nie ma zadania, które można bezpiecznie rozpocząć.'));
  } else {
    nowSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Brak otwartych zadań na dziś. Możesz spokojnie skupić się na nawykach albo odpoczynku.'));
  }
  layout.appendChild(nowSection);

  const nextSection = createTodayNode('section', 'card today-next-card today-plan-selected');
  nextSection.appendChild(createTodayNode('h2', '', 'Dalej'));
  if (isSuccess && selected.length > 1) {
    const nextTasks = selected.slice(1);
    nextTasks.slice(0, TODAY_NEXT_VISIBLE_LIMIT).forEach(task => appendTodayTaskSummary(nextSection, task, {
      action: 'complete',
      scheduled: plan.mode === 'scheduled',
      showOrder: true
    }));
    const hiddenNextTasks = nextTasks.slice(TODAY_NEXT_VISIBLE_LIMIT);
    if (hiddenNextTasks.length) {
      const more = createTodayNode('details', 'today-next-more');
      more.appendChild(createTodayNode('summary', '', `Pozostałe zadania (${hiddenNextTasks.length})`));
      const moreBody = createTodayNode('div', 'today-next-more-body');
      hiddenNextTasks.forEach(task => appendTodayTaskSummary(moreBody, task, {
        action: 'complete',
        scheduled: plan.mode === 'scheduled',
        showOrder: true
      }));
      more.appendChild(moreBody);
      nextSection.appendChild(more);
    }
  } else {
    nextSection.appendChild(createTodayNode('p', 'today-plan-empty', selected.length === 1
      ? 'To jedyne zadanie w bieżącym planie.'
      : 'Brak kolejnych zadań w bieżącym planie.'));
  }
  layout.appendChild(nextSection);

  const budgetSection = createTodayNode('section', 'card today-budget-card');
  budgetSection.id = 'today-budget';
  budgetSection.tabIndex = -1;
  budgetSection.appendChild(createTodayNode('h2', '', 'Budżet dnia'));
  const budgetButtons = createTodayNode('div', 'today-budget-options');
  budgetButtons.setAttribute('aria-label', 'Ręczny budżet czasu');
  const activeBudgetKey = isSuccess && plan.budget ? plan.budget.manualBudgetKey : null;
  TIME_BUDGETS.forEach(budget => {
    const button = createTodayNode('button', 'ghost time-btn', `${budget.minutes} min`);
    button.type = 'button';
    button.dataset.key = budget.key;
    button.classList.toggle('active', budget.key === activeBudgetKey);
    button.setAttribute('aria-pressed', budget.key === activeBudgetKey ? 'true' : 'false');
    budgetButtons.appendChild(button);
  });
  budgetSection.appendChild(budgetButtons);
  const totals = isSuccess && plan.totals ? plan.totals : {};
  const budget = isSuccess && plan.budget ? plan.budget : {};
  budgetSection.appendChild(createTodayNode('p', 'today-budget-summary', Number.isInteger(totals.plannedMinutes) && Number.isInteger(budget.effectiveBudgetMinutes)
    ? `Zaplanowano ${totals.plannedMinutes} z ${budget.effectiveBudgetMinutes} min dostępnego budżetu.`
    : 'Wybierz poprawny budżet, aby ponownie przygotować plan.'));
  layout.appendChild(budgetSection);

  const habitsSection = createTodayNode('section', 'card today-habits-card');
  habitsSection.appendChild(createTodayNode('h2', '', 'Nawyki'));
  const habits = createTodayNode('div', 'habit-list');
  habits.id = 'habit-list';
  habitsSection.appendChild(habits);
  layout.appendChild(habitsSection);

  const completedSection = createTodayNode('section', 'card today-plan-completed');
  completedSection.appendChild(createTodayNode('h2', '', 'Ukończone dzisiaj'));
  if (completed.length) completed.forEach(task => appendTodayTaskSummary(completedSection, task, { action: 'undo', done: true }));
  else completedSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Ukończone zadania pojawią się tutaj.'));
  layout.appendChild(completedSection);

  const details = createTodayNode('details', 'card today-plan-details');
  const detailsSummary = createTodayNode('summary', '', 'Szczegóły planu');
  details.appendChild(detailsSummary);
  const detailsBody = createTodayNode('div', 'today-plan-details-body');
  if (isSuccess) {
    detailsBody.appendChild(createTodayNode('p', 'today-plan-date', `Plan na ${plan.date} · ${plan.mode === 'scheduled' ? 'z godzinami' : 'bez przypisanych godzin'}`));
    if (plan.mode === 'scheduled' && Array.isArray(plan.planningWindows)) {
      const windows = plan.planningWindows
        .filter(interval => interval && typeof interval.start === 'string' && typeof interval.end === 'string')
        .map(interval => `${interval.start}–${interval.end}`);
      detailsBody.appendChild(createTodayNode('p', 'today-plan-windows', windows.length ? `Okna planowania: ${windows.join(', ')}` : 'Brak pozostałych okien planowania.'));
    }

    const deferredSection = createTodayNode('section', 'today-plan-section today-plan-deferred');
    deferredSection.appendChild(createTodayNode('h3', '', 'Odłożone'));
    if (deferred.length) deferred.forEach(task => appendTodayTaskSummary(deferredSection, task, {
      message: todayDeferredMessage(task.reason),
      showPlanningClass: true
    }));
    else deferredSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Brak odłożonych zadań.'));
    detailsBody.appendChild(deferredSection);

    const excludedSection = createTodayNode('section', 'today-plan-section today-plan-excluded');
    excludedSection.appendChild(createTodayNode('h3', '', 'Poza planem'));
    if (excluded.length) excluded.forEach(task => {
      if (typeof task.title === 'string') appendTodayTaskSummary(excludedSection, task, { message: todayExcludedMessage(task.reason), done: task.reason === 'STATUS_DONE' });
      else excludedSection.appendChild(createTodayNode('div', 'today-plan-reason', todayExcludedMessage(task.reason)));
    });
    else excludedSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Brak wykluczonych zadań.'));
    detailsBody.appendChild(excludedSection);

    const warningSection = createTodayNode('section', 'today-plan-section today-plan-warnings');
    warningSection.appendChild(createTodayNode('h3', '', 'Pełne ostrzeżenia'));
    if (warnings.length) warnings.forEach(warning => warningSection.appendChild(createTodayNode('p', 'today-plan-reason', todayWarningMessage(warning && warning.code))));
    else warningSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Brak ostrzeżeń planu.'));
    detailsBody.appendChild(warningSection);

    const metricsSection = createTodayNode('section', 'today-plan-section today-plan-metrics');
    metricsSection.appendChild(createTodayNode('h3', '', 'Metryki planu'));
    const metrics = createTodayNode('div', 'today-plan-summary');
    [
      ['Źródło budżetu', todayBudgetSourceLabel(budget.source)],
      ['Pełny budżet', Number.isInteger(budget.manualBudgetMinutes) ? `${budget.manualBudgetMinutes} min` : 'niedostępny'],
      ['Pełna dostępność', Number.isInteger(budget.availableMinutes) ? `${budget.availableMinutes} min` : 'brak konfiguracji'],
      ['Pozostała dostępność', Number.isInteger(budget.remainingAvailableMinutes) ? `${budget.remainingAvailableMinutes} min` : 'brak konfiguracji'],
      ['Efektywny budżet', Number.isInteger(budget.effectiveBudgetMinutes) ? `${budget.effectiveBudgetMinutes} min` : 'niedostępny'],
      ['Zaplanowano', Number.isInteger(totals.plannedMinutes) ? `${totals.plannedMinutes} min` : 'niedostępne'],
      ['Pozostały budżet', Number.isInteger(totals.unusedEffectiveMinutes) ? `${totals.unusedEffectiveMinutes} min` : 'niedostępny'],
      ['Nieprzydzielona dostępność', Number.isInteger(totals.uncommittedAvailabilityMinutes) ? `${totals.uncommittedAvailabilityMinutes} min` : 'brak konfiguracji']
    ].forEach(([label, value]) => {
      const item = createTodayNode('div', 'today-plan-summary-item');
      item.appendChild(createTodayNode('span', 'today-plan-summary-label', label));
      item.appendChild(createTodayNode('strong', '', value));
      metrics.appendChild(item);
    });
    metricsSection.appendChild(metrics);
    detailsBody.appendChild(metricsSection);
  } else {
    detailsBody.appendChild(createTodayNode('p', 'today-plan-reason', todayFatalMessage(plan && plan.code)));
    warnings.forEach(warning => detailsBody.appendChild(createTodayNode('p', 'today-plan-reason', todayWarningMessage(warning && warning.code))));
  }
  details.appendChild(detailsBody);
  layout.appendChild(details);

  const actionMessage = createTodayNode('div', 'today-plan-action-message');
  actionMessage.setAttribute('aria-live', 'polite');
  layout.appendChild(actionMessage);
}

function renderTodayContexts() {
  const notesEl = document.getElementById('day-context-notes');
  if (!notesEl) return;
  clearTodayNode(notesEl);
  ModuleRegistry.all().forEach(module => {
    let context;
    try {
      if (typeof module.getDayContext !== 'function') return;
      context = module.getDayContext();
    } catch (error) { return; }
    if (!context || typeof context.message !== 'string' || !context.message) return;
    notesEl.appendChild(createTodayNode('div', 'banner-warn', context.message));
  });
}

function renderTodayCheckIn(plan, date) {
  const host = document.getElementById('today-checkin-content');
  if (!host) return;
  let record;
  try {
    record = DayEngine.getRecord(date);
    if (record !== null && (!record || typeof record !== 'object' || Array.isArray(record))) {
      throw new TypeError('INVALID_DAY_RECORD');
    }
  } catch (error) {
    host.appendChild(createTodayNode('p', 'today-checkin-neutral', 'Nie można bezpiecznie odczytać zapisu check-inu. Pozostała część widoku nadal jest dostępna.'));
    return;
  }
  let energy = plan && plan.ok === true && plan.energy ? plan.energy : null;
  if (!energy && record && Object.prototype.hasOwnProperty.call(record, 'energyScore')
      && Number.isInteger(record.energyScore) && record.energyScore >= 0 && record.energyScore <= 100) {
    energy = { checkInCompleted: true, score: record.energyScore };
  }
  if (energy && energy.checkInCompleted) {
    const score = Number.isInteger(energy.score) ? energy.score : null;
    const summary = createTodayNode('div', 'today-energy-summary');
    summary.appendChild(createTodayNode('div', 'energy-num', score === null ? '—' : score));
    const body = createTodayNode('div');
    if (score !== null) {
      const advice = DayEngine.advice(score);
      body.appendChild(createTodayNode('div', `badge ${score >= 75 ? 'ok' : score >= 50 ? '' : 'warn'}`, `${advice.level} energia`));
      body.appendChild(createTodayNode('p', 'today-energy-advice', advice.text));
    } else body.appendChild(createTodayNode('p', 'today-energy-advice', 'Zapis energii wymaga sprawdzenia.'));
    if (record && Number.isFinite(record.sleepHours) && Number.isInteger(record.sleepQuality)) {
      body.appendChild(createTodayNode('p', 'today-energy-meta', `Sen: ${record.sleepHours} h · jakość ${record.sleepQuality}/5`));
    }
    summary.appendChild(body);
    host.appendChild(summary);
    const edit = createTodayNode('button', 'ghost', 'Zmień check-in');
    edit.type = 'button';
    edit.id = 'edit-checkin';
    edit.addEventListener('click', () => {
      const records = Store.get('dayRecords', {});
      const current = records && typeof records === 'object' && !Array.isArray(records) ? records[date] : null;
      if (!current || typeof current !== 'object' || Array.isArray(current)) return;
      const nextRecord = { ...current };
      delete nextRecord.sleepHours;
      delete nextRecord.sleepQuality;
      delete nextRecord.energyScore;
      Store.set('dayRecords', { ...records, [date]: nextRecord });
      todayPendingFocus = { type: 'checkin' };
      renderDzis();
    });
    host.appendChild(edit);
    return;
  }

  host.appendChild(createTodayNode('p', '', 'Ile spałeś i jak oceniasz jakość snu? Plan działa także bez check-inu, ale ta informacja pomaga dopasować trudność.'));
  const hoursRow = createTodayNode('div', 'field-row');
  const hoursLabel = createTodayNode('label', '', 'Godziny snu');
  hoursLabel.htmlFor = 'sleep-hours';
  const hoursInput = createTodayNode('input');
  hoursInput.type = 'number';
  hoursInput.id = 'sleep-hours';
  hoursInput.min = '0.5';
  hoursInput.max = '14';
  hoursInput.step = '0.5';
  hoursInput.placeholder = 'np. 7.5';
  hoursRow.append(hoursLabel, hoursInput);
  host.appendChild(hoursRow);

  const qualityGroup = createTodayNode('fieldset', 'today-quality-fieldset');
  qualityGroup.appendChild(createTodayNode('legend', '', 'Jakość snu od 1 do 5'));
  const qualityButtons = createTodayNode('div', 'quality-btns');
  let selectedQuality = 0;
  [1, 2, 3, 4, 5].forEach(value => {
    const button = createTodayNode('button', 'qbtn', value);
    button.type = 'button';
    button.dataset.q = String(value);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      selectedQuality = value;
      qualityButtons.querySelectorAll('.qbtn').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
    qualityButtons.appendChild(button);
  });
  qualityGroup.appendChild(qualityButtons);
  host.appendChild(qualityGroup);

  const save = createTodayNode('button', 'primary', 'Zapisz check-in');
  save.type = 'button';
  save.id = 'save-checkin';
  save.addEventListener('click', () => {
    const hours = Number(hoursInput.value);
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 14 || !selectedQuality) {
      alert('Podaj godziny snu od 0,5 do 14 i wybierz jakość od 1 do 5.');
      return;
    }
    todayPendingFocus = { type: 'checkin' };
    DayEngine.checkIn(hours, selectedQuality);
  });
  host.appendChild(save);
}

function restoreTodayPendingFocus() {
  if (!todayPendingFocus) return;
  const pending = todayPendingFocus;
  todayPendingFocus = null;
  if (pending.type === 'budget') {
    document.querySelector(`.time-btn[data-key="${pending.key}"]`)?.focus();
    return;
  }
  if (pending.type === 'checkin') {
    (document.getElementById('edit-checkin') || document.getElementById('sleep-hours'))?.focus();
    return;
  }
  if (pending.type === 'task') {
    let restored = false;
    document.querySelectorAll(`[data-action="${pending.action}"]`).forEach(button => {
      if (restored) return;
      const target = todayTaskActionTargets.get(button);
      if (target && target.moduleId === pending.moduleId && target.taskId === pending.taskId) {
        button.focus();
        restored = document.activeElement === button;
      }
    });
    if (!restored) document.querySelector('.today-plan-details > summary')?.focus();
  }
}

function wireTodayProductActions(plan) {
  const layout = document.getElementById('today-tasks');
  if (!layout) return;
  layout.querySelectorAll('[data-today-focus]').forEach(button => {
    button.addEventListener('click', () => {
      const section = document.getElementById(button.dataset.todayFocus);
      const firstControl = section && section.querySelector('input,button,select,textarea,summary');
      (firstControl || section)?.focus();
    });
  });
  layout.querySelectorAll('[data-today-route]').forEach(button => {
    button.addEventListener('click', () => navigateFromUser(button.dataset.todayRoute));
  });
  layout.querySelectorAll('[data-today-retry]').forEach(button => {
    button.addEventListener('click', () => renderTodayTasks());
  });
  layout.querySelectorAll('.time-btn').forEach(button => {
    button.addEventListener('click', () => {
      const currentKey = plan && plan.ok === true && plan.budget ? plan.budget.manualBudgetKey : null;
      if (button.dataset.key === currentKey) return;
      Store.set('ui:timeBudget', button.dataset.key);
      todayPendingFocus = { type: 'budget', key: button.dataset.key };
      renderTodayTasks();
    });
  });
  layout.querySelectorAll('[data-action="complete"],[data-action="undo"]').forEach(button => {
    button.addEventListener('click', () => {
      const target = todayTaskActionTargets.get(button);
      const complete = button.dataset.action === 'complete';
      todayPendingFocus = target ? {
        type: 'task',
        moduleId: target.moduleId,
        taskId: target.taskId,
        action: complete ? 'undo' : 'complete'
      } : null;
      const result = target
        ? delegateTodayTaskStatus(target.moduleId, target.taskId, complete ? 'done' : 'todo')
        : { ok: false, changed: false };
      if (!result.changed) {
        todayPendingFocus = null;
        const message = document.querySelector('.today-plan-action-message');
        if (message) message.textContent = result.ok
          ? 'Status zadania nie wymagał zmiany.'
          : complete ? 'Nie udało się zmienić statusu zadania.' : 'Nie udało się cofnąć statusu zadania.';
        button.focus();
      }
    });
  });
  layout.querySelectorAll('[data-action="open-details"]').forEach(button => {
    button.addEventListener('click', () => {
      const target = todayDetailsActionTargets.get(button);
      if (target && canOpenTodayTaskDetails(target.moduleId)) navigateFromUser(target.moduleId);
    });
  });
}

function renderTodayTasks(now = new Date()) {
  const today = localDateKey(now);
  const container = document.getElementById('view-dzis');
  if (!container) return null;
  const budgetKey = Store.get('ui:timeBudget', 'normal');
  const plan = PlanDayEngine.getPlanForToday(budgetKey, now);
  todayPlanLastRenderedDate = plan && plan.ok === true ? plan.date : today;
  renderTodayPlanResult(plan, container);
  renderTodayCheckIn(plan, todayPlanLastRenderedDate);
  renderTodayContexts();
  renderHabitList(todayPlanLastRenderedDate);
  wireTodayProductActions(plan);
  if (typeof updateTodayShellContext === 'function') updateTodayShellContext(plan);
  restoreTodayPendingFocus();
  return plan;
}

const TodayPlanLifecycle = (() => {
  let started = false;
  let midnightTimer = null;

  function clearMidnightTimer() {
    if (midnightTimer === null) return;
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }

  function scheduleMidnight(now) {
    clearMidnightTimer();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = Math.max(1, nextMidnight.getTime() - now.getTime());
    midnightTimer = setTimeout(() => {
      midnightTimer = null;
      const capturedNow = new Date();
      renderDzis(capturedNow);
      scheduleMidnight(capturedNow);
    }, delay);
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    const capturedNow = new Date();
    if (localDateKey(capturedNow) === todayPlanLastRenderedDate) return;
    renderDzis(capturedNow);
    scheduleMidnight(capturedNow);
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleMidnight(new Date());
  }

  function stop() {
    if (!started) return;
    started = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearMidnightTimer();
  }

  function getState() {
    return { started, timerScheduled: midnightTimer !== null, lastRenderedDate: todayPlanLastRenderedDate };
  }

  return Object.freeze({ start, stop, getState });
})();

function renderHabitList(date = DayEngine.todayKey()) {
  const el = document.getElementById('habit-list');
  if (!el) return;
  clearTodayNode(el);
  const defs = HabitEngine.defs();
  const habits = Array.isArray(defs) ? defs.filter(habit => habit && habit.active) : [];
  if (!habits.length) el.appendChild(createTodayNode('p', 'today-plan-empty', 'Brak aktywnych nawyków.'));
  habits.forEach(h => {
    const done = HabitEngine.isDone(h.id, date);
    const streak = HabitEngine.streak(h.id);
    const row = createTodayNode('div', 'habit-item');
    const checkbox = createTodayNode('input', 'cb');
    checkbox.type = 'checkbox';
    checkbox.checked = done;
    checkbox.setAttribute('aria-label', `Nawyk: ${h.label}`);
    todayHabitTargets.set(checkbox, { habitId: h.id });
    const label = createTodayNode('span', 'habit-label', h.label);
    if (h.goalPillar) {
      label.appendChild(document.createTextNode(' '));
      label.appendChild(createTodayNode('span', 'pillar-tag', `· ${h.goalPillar}`));
    }
    row.append(checkbox, label);
    if (streak > 0) row.appendChild(createTodayNode('span', `habit-streak${streak >= 7 ? ' hot' : ''}`, `${streak} dni serii`));
    if (Number.isFinite(h.xp)) row.appendChild(createTodayNode('span', 'badge', `+${h.xp} XP`));
    el.appendChild(row);
    checkbox.addEventListener('change', event => {
      const target = todayHabitTargets.get(checkbox);
      if (!target) return;
      HabitEngine.log(target.habitId, date, event.target.checked);
      renderHabitList(date);
    });
  });
}

/* ============================================================
   ENGINE / PriorityEngine
   Odpowiedzialność: jedna rzecz — z DOSTARCZONEJ puli zadań
   wybiera te, które mieszczą się w dostępnym czasie, sortując
   wg priorytetu. Celowo NIE pobiera zadań samodzielnie z
   ModuleRegistry (jak w Kroku 3) — to DecisionEngine decyduje,
   jaką pulę przekazać, co pozwala mu najpierw odfiltrować wg
   energii, a dopiero potem wypełniać budżet czasu. Gdyby budżet
   był wypełniany PRZED filtrem energii, trudne zadanie mogłoby
   zająć czas, który lekkie zadanie by się zmieściło — a potem
   trudne i tak zostałoby odrzucone, marnując ten czas. Kolejność
   ma znaczenie, więc PriorityEngine nie narzuca jej sam.
   ============================================================ */
const TIME_BUDGETS = [
  { key: 'short', label: 'Mało czasu (~30 min)', minutes: 30 },
  { key: 'normal', label: 'Normalnie (~60 min)', minutes: 60 },
  { key: 'long', label: 'Dużo czasu (2h+)', minutes: 150 }
];

const PriorityEngine = (() => {
  // Zadania w statusie 'todo' ze WSZYSTKICH zarejestrowanych
  // modułów — przez ModuleRegistry, nigdy przez odwołanie do
  // konkretnego modułu po nazwie.
  function collectOpenTasks(date) {
    assertPlanningDate(date);
    return ModuleRegistry.all().flatMap(mod =>
      mod.getTasks(date)
        .filter(t => t.status === 'todo')
        .map(t => ({ ...t, moduleId: mod.id, moduleName: mod.name }))
    );
  }

  // Przyjmuje GOTOWĄ pulę (już odfiltrowaną np. przez energię)
  // i mieści kolejne zadania wg priorytetu w budżecie czasu.
  function pickWithinBudget(tasks, minutesAvailable) {
    const sorted = [...tasks].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
    const picks = [];
    const deferredByTime = [];
    let remaining = minutesAvailable;
    for (const task of sorted) {
      const cost = task.estimatedMinutes ?? 15;
      if (cost <= remaining) { picks.push(task); remaining -= cost; }
      else deferredByTime.push(task);
    }
    return { picks, deferredByTime };
  }

  return { collectOpenTasks, pickWithinBudget };
})();

/* ============================================================
   ENGINE / DecisionEngine
   Odpowiedzialność: składa DayEngine (energia) + PriorityEngine
   (zadania w budżecie czasu) + HabitEngine (aktywne nawyki)
   w jedną, gotową listę na ekran "Dziś". To CZYSTA REGUŁA
   KOMPOZYCJI — deterministyczna i debugowalna, nie uczenie
   maszynowe.

   KOLEJNOŚĆ FILTROWANIA (poprawiona po recenzji Kroku 3):
   1. Najpierw energia odcina zadania zbyt trudne na dziś —
      CAŁKOWICIE usuwa je z puli, zanim budżet czasu zacznie
      się wypełniać.
   2. Dopiero POTEM PriorityEngine wypełnia budżet z tego, co
      zostało — więc czas zwolniony przez odrzucone trudne
      zadanie trafia do kolejnego w kolejności lekkiego zadania,
      zamiast się marnować.
   ============================================================ */
const DecisionEngine = (() => {
  const LOW_ENERGY_THRESHOLD = 50;
  const HIGH_DIFFICULTY_THRESHOLD = 4;

  function planToday(timeBudgetMinutes, date) {
    assertPlanningDate(date);
    const record = DayEngine.getRecord(date);
    const energy = record ? record.energyScore : null;

    const habits = HabitEngine.defs()
      .filter(h => h.active)
      .map(h => ({ ...h, done: HabitEngine.isDone(h.id, date) }));

    const allOpen = PriorityEngine.collectOpenTasks(date);

    // KROK 1: filtr energii — działa na CAŁEJ puli, przed budżetem czasu.
    let pool = allOpen;
    let deferredByEnergy = [];
    if (energy !== null && energy < LOW_ENERGY_THRESHOLD) {
      deferredByEnergy = allOpen.filter(t => (t.difficulty ?? 3) >= HIGH_DIFFICULTY_THRESHOLD);
      pool = allOpen.filter(t => (t.difficulty ?? 3) < HIGH_DIFFICULTY_THRESHOLD);
    }

    // KROK 2: dopiero teraz wypełniamy budżet czasu — z puli już
    // pozbawionej zadań odrzuconych przez energię, więc zwolniony
    // czas trafia do następnych w kolejności zadań, nie przepada.
    const { picks, deferredByTime } = PriorityEngine.pickWithinBudget(pool, timeBudgetMinutes);

    return {
      energy,
      habits,
      picks,
      deferred: [...deferredByTime, ...deferredByEnergy],
      reasonCounts: { time: deferredByTime.length, energy: deferredByEnergy.length }
    };
  }

  // Dwukierunkowa zmiana statusu — zastępuje jednokierunkowy
  // completeTask() z Kroku 3. Pozwala zarówno ukończyć zadanie,
  // jak i cofnąć błędne kliknięcie (status z powrotem na 'todo').
  function setTaskStatus(moduleId, taskId, status) {
    const mod = ModuleRegistry.get(moduleId);
    if (mod && mod.setTaskStatus) mod.setTaskStatus(taskId, status);
  }

  return { planToday, setTaskStatus };
})();

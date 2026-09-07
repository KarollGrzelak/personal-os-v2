import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApp, readTodaySource, toPlain } from './helpers/load-app.mjs';

const DATE = '2026-09-07';

function task(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Synthetic task',
    status: 'todo',
    priority: 40,
    estimatedMinutes: 15,
    difficulty: 2,
    planningClass: 'flexible',
    ...overrides
  };
}

function source(moduleId, tasks, moduleName = `Module ${moduleId}`) {
  return { moduleId, moduleName, tasks };
}

function intervalMinutes(interval) {
  const parse = value => value === '24:00'
    ? 1440
    : Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return parse(interval.end) - parse(interval.start);
}

function unconfiguredAvailability(date = DATE, weekday = 1) {
  return {
    ok: true,
    configured: false,
    date,
    weekday,
    source: 'unconfigured',
    status: 'unconfigured',
    intervals: [],
    availableMinutes: null
  };
}

function configuredAvailability(intervals, {
  date = DATE,
  source: availabilitySource = 'weekly',
  weekday = 1
} = {}) {
  return {
    ok: true,
    configured: true,
    date,
    weekday,
    source: availabilitySource,
    status: intervals.length ? 'available' : 'unavailable',
    intervals,
    availableMinutes: intervals.reduce((sum, item) => sum + intervalMinutes(item), 0)
  };
}

function planInput(overrides = {}) {
  return {
    date: DATE,
    manualBudgetKey: 'normal',
    manualBudgetMinutes: 60,
    checkInCompleted: true,
    energyScore: 80,
    availability: unconfiguredAvailability(),
    planningStartMinute: 0,
    sources: [source('alpha', [task()])],
    ...overrides
  };
}

function inWindow(app, value) {
  return app.window.JSON.parse(JSON.stringify(value));
}

function build(app, overrides = {}) {
  return toPlain(app.api.PlanDayEngine.buildPlan(inWindow(app, planInput(overrides))));
}

test('validateTask tworzy bezpieczną projekcję z deskryptora i nie ufa polom domenowym', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const sourceTask = inWindow(app, task({
    moduleId: 'spoofed', moduleName: 'Spoofed', why: 'Reason', xp: 7,
    dueDate: '2026-09-08', completedDate: null, domainNotes: 'must not escape'
  }));
  const before = JSON.stringify(sourceTask);
  const result = app.api.PlanDayEngine.validateTask(
    sourceTask,
    inWindow(app, { id: 'trusted', name: 'Trusted module' }),
    4
  );

  assert.equal(result.valid, true);
  assert.deepEqual(toPlain(result.task), {
    moduleId: 'trusted', moduleName: 'Trusted module', taskId: 'task-1', title: 'Synthetic task',
    why: 'Reason', xp: 7, status: 'todo', priority: 40, estimatedMinutes: 15,
    difficulty: 2, planningClass: 'flexible', dueDate: '2026-09-08', completedDate: null,
    sourceOrder: 4
  });
  assert.equal(JSON.stringify(sourceTask), before);
  result.task.title = 'changed';
  assert.equal(sourceTask.title, 'Synthetic task');
});

test('validateTask odrzuca granice Task v2, błędny deskryptor i sourceOrder bez ujawniania danych', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const descriptor = inWindow(app, { id: 'alpha', name: 'Alpha' });
  for (const candidate of [
    task({ id: 'x'.repeat(201) }),
    task({ title: 'x'.repeat(301) }),
    task({ priority: 1.5 }),
    task({ estimatedMinutes: 0 }),
    task({ difficulty: 6 }),
    task({ planningClass: 'other' })
  ]) {
    assert.deepEqual(toPlain(app.api.PlanDayEngine.validateTask(inWindow(app, candidate), descriptor, 0)), {
      valid: false,
      code: 'INVALID_TASK'
    });
  }
  assert.equal(app.api.PlanDayEngine.validateTask(inWindow(app, task()), inWindow(app, { id: '', name: 'Alpha' }), 0).valid, false);
  assert.equal(app.api.PlanDayEngine.validateTask(inWindow(app, task()), descriptor, -1).valid, false);
  assert.equal(app.api.PlanDayEngine.validateTask(inWindow(app, task()), descriptor, 500).valid, false);

  const accessor = inWindow(app, task());
  app.window.Object.defineProperty(accessor, 'title', { get() { throw new Error('UNTRUSTED_SENTINEL'); } });
  assert.deepEqual(toPlain(app.api.PlanDayEngine.validateTask(accessor, descriptor, 0)), {
    valid: false,
    code: 'INVALID_TASK'
  });
});

test('buildPlan odrzuca błędne wejście, budżet i Availability zamkniętymi kodami', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(build(app, { date: '2026-02-30' }).code, 'INVALID_INPUT');
  assert.equal(build(app, { planningStartMinute: -1 }).code, 'INVALID_INPUT');
  assert.equal(build(app, { planningStartMinute: 1441 }).code, 'INVALID_INPUT');
  assert.equal(build(app, { manualBudgetKey: 'other', manualBudgetMinutes: 60 }).code, 'INVALID_BUDGET');
  assert.equal(build(app, { manualBudgetMinutes: 61 }).code, 'INVALID_BUDGET');
  assert.equal(build(app, { availability: { ok: false, code: 'INVALID_STORED_DATA' } }).code, 'INVALID_AVAILABILITY');
  assert.equal(build(app, { availability: { ...unconfiguredAvailability(), weekday: 2 } }).code, 'INVALID_AVAILABILITY');
  assert.equal(build(app, {
    availability: configuredAvailability([{ start: '08:00', end: '09:00' }], { date: '2026-09-08' })
  }).code, 'INVALID_AVAILABILITY');
});

test('wyjątek podczas walidacji Availability pozostaje bezpiecznym INVALID_AVAILABILITY bez efektów', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const sentinel = 'AVAILABILITY_SENTINEL_SHOULD_NOT_LEAK';
  const input = inWindow(app, planInput());
  input.availability = new app.window.Proxy({}, {
    get() { throw new Error(sentinel); }
  });
  let storeWrites = 0;
  let emittedEvents = 0;
  app.api.Store.set = () => { storeWrites++; };
  app.api.EventBus.emit = () => { emittedEvents++; };

  const result = toPlain(app.api.PlanDayEngine.buildPlan(input));

  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_AVAILABILITY');
  assert.equal(JSON.stringify(result).includes(sentinel), false);
  assert.equal(storeWrites, 0);
  assert.equal(emittedEvents, 0);
});

test('brak konfiguracji zachowuje ręczny budżet, null minut i slotów oraz jest deterministyczny', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const input = planInput({
    manualBudgetKey: 'short', manualBudgetMinutes: 30, checkInCompleted: false, energyScore: null,
    sources: [source('alpha', [task({ id: 'first', estimatedMinutes: 20 }), task({ id: 'second', estimatedMinutes: 15 })])]
  });
  const windowInput = inWindow(app, input);
  const before = JSON.stringify(windowInput);
  const first = toPlain(app.api.PlanDayEngine.buildPlan(windowInput));
  const second = toPlain(app.api.PlanDayEngine.buildPlan(windowInput));

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(windowInput), before);
  assert.equal(first.ok, true);
  assert.equal(first.mode, 'unscheduled');
  assert.deepEqual(first.budget, {
    manualBudgetKey: 'short', manualBudgetMinutes: 30, availableMinutes: null,
    remainingAvailableMinutes: null, effectiveBudgetMinutes: 30, source: 'manual'
  });
  assert.equal(first.selected[0].slot, null);
  assert.equal(first.deferred[0].reason, 'BUDGET_EXHAUSTED');
  assert.deepEqual(first.warnings, [{ code: 'AVAILABILITY_NOT_CONFIGURED' }, { code: 'CHECK_IN_MISSING' }]);
  first.selected[0].title = 'mutated';
  assert.equal(toPlain(app.api.PlanDayEngine.buildPlan(windowInput)).selected[0].title, 'Synthetic task');
});

test('skonfigurowana Availability rozróżnia obie strony ograniczenia budżetu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const cases = [
    { intervals: [{ start: '08:00', end: '08:20' }], effective: 20, source: 'manual-capped-by-availability' },
    { intervals: [{ start: '08:00', end: '08:30' }], effective: 30, source: 'manual-within-availability' },
    { intervals: [{ start: '08:00', end: '09:00' }], effective: 30, source: 'manual-within-availability' }
  ];
  for (const item of cases) {
    const result = build(app, {
      manualBudgetKey: 'short', manualBudgetMinutes: 30,
      availability: configuredAvailability(item.intervals),
      sources: [source('alpha', [task({ estimatedMinutes: Math.min(15, item.effective) })])]
    });
    assert.equal(result.mode, 'scheduled');
    assert.equal(result.budget.effectiveBudgetMinutes, item.effective);
    assert.equal(result.budget.source, item.source);
    assert.equal(result.totals.uncommittedAvailabilityMinutes, item.intervals.reduce((sum, value) => sum + intervalMinutes(value), 0) - result.totals.plannedMinutes);
  }
  const exception = build(app, {
    availability: configuredAvailability([{ start: '08:00', end: '09:00' }], { source: 'exception' }),
    sources: [source('alpha', [])]
  });
  assert.deepEqual(exception.availability, { configured: true, source: 'exception', status: 'available' });
});

test('pełne zero i wyłącznie minione okna mają odrębne powody', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const noAvailability = build(app, {
    availability: configuredAvailability([]),
    sources: [source('alpha', [task()])]
  });
  assert.equal(noAvailability.deferred[0].reason, 'NO_AVAILABILITY');
  assert.equal(noAvailability.budget.availableMinutes, 0);
  assert.equal(noAvailability.budget.remainingAvailableMinutes, 0);

  const noRemaining = build(app, {
    planningStartMinute: 540,
    availability: configuredAvailability([{ start: '08:00', end: '09:00' }]),
    sources: [source('alpha', [task()])]
  });
  assert.equal(noRemaining.deferred[0].reason, 'NO_REMAINING_AVAILABILITY');
  assert.equal(noRemaining.budget.availableMinutes, 60);
  assert.equal(noRemaining.budget.remainingAvailableMinutes, 0);

  const endOfDay = build(app, {
    planningStartMinute: 1440,
    availability: configuredAvailability([{ start: '23:59', end: '24:00' }]),
    sources: [source('alpha', [task({ estimatedMinutes: 1 })])]
  });
  assert.equal(endOfDay.deferred[0].reason, 'NO_REMAINING_AVAILABILITY');
  assert.deepEqual(endOfDay.planningWindows, []);
});

test('przycinanie zachowuje sourceIntervals, łączy tylko stykające planningWindows i obsługuje 24:00', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const intervals = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '12:00', end: '24:00' }
  ];
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    planningStartMinute: 510,
    availability: configuredAvailability(intervals),
    sources: [source('alpha', [task({ estimatedMinutes: 90 })])]
  });

  assert.deepEqual(result.sourceIntervals, intervals);
  assert.deepEqual(result.planningWindows, [
    { start: '08:30', end: '10:00' },
    { start: '12:00', end: '24:00' }
  ]);
  assert.equal(result.budget.availableMinutes, 840);
  assert.equal(result.budget.remainingAvailableMinutes, 810);
  assert.deepEqual(result.selected[0].slot, { start: '08:30', end: '10:00' });
});

test('nominalny pełny dzień ma 1440 minut po obu zmianach DST Europe/Warsaw', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  for (const date of ['2026-03-29', '2026-10-25']) {
    const result = build(app, {
      date,
      availability: configuredAvailability([{ start: '00:00', end: '24:00' }], {
        date,
        weekday: app.api.weekdayFromLocalDate(date)
      }),
      sources: [source('alpha', [])]
    });
    assert.equal(result.budget.availableMinutes, 1440);
    assert.equal(result.budget.remainingAvailableMinutes, 1440);
    assert.deepEqual(result.planningWindows, [{ start: '00:00', end: '24:00' }]);
  }
});

test('energia ma stany missing, invalid oraz dokładne granice 49/50/74/75', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const hard = [source('alpha', [task({ difficulty: 5 })])];
  const missing = build(app, { checkInCompleted: false, energyScore: null, sources: hard });
  assert.equal(missing.energy.state, 'unknown');
  assert.equal(missing.selected.length, 1);
  assert.equal(missing.warnings.some(item => item.code === 'CHECK_IN_MISSING'), true);

  for (const invalid of [-1, 101, 50.5, null]) {
    const result = build(app, { checkInCompleted: true, energyScore: invalid, sources: hard });
    assert.equal(result.energy.state, 'unknown-invalid');
    assert.equal(result.energy.score, null);
    assert.equal(result.selected.length, 1);
    assert.equal(result.warnings.some(item => item.code === 'INVALID_ENERGY'), true);
    assert.equal(result.warnings.some(item => item.code === 'CHECK_IN_MISSING'), false);
  }

  for (const [score, state, selected] of [[49, 'low', 0], [50, 'medium', 1], [74, 'medium', 1], [75, 'high', 1]]) {
    const result = build(app, { energyScore: score, sources: hard });
    assert.equal(result.energy.state, state);
    assert.equal(result.selected.length, selected);
    if (!selected) assert.equal(result.deferred[0].reason, 'ENERGY_TOO_LOW');
  }
});

test('filtr energii ma pierwszeństwo także dla pilnego School bez override', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    energyScore: 49,
    availability: configuredAvailability([]),
    sources: [source('school', [
      task({ id: 'urgent-hard', priority: 25, difficulty: 4, planningClass: 'urgent' }),
      task({ id: 'flex-hard', difficulty: 5 })
    ], 'Szkoła')]
  });
  assert.deepEqual(result.deferred.map(item => [item.taskId, item.reason]), [
    ['urgent-hard', 'ENERGY_TOO_LOW'],
    ['flex-hard', 'ENERGY_TOO_LOW']
  ]);
});

test('statusy tworzą rozłączne selected, completedToday i excluded', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    energyScore: 0,
    availability: configuredAvailability([]),
    sources: [source('alpha', [
      task({ id: 'todo' }),
      task({ id: 'done-today', status: 'done', completedDate: DATE, difficulty: 5 }),
      task({ id: 'done-old', status: 'done', completedDate: '2026-09-06', difficulty: 5 }),
      task({ id: 'skipped', status: 'skipped', difficulty: 5 })
    ])]
  });
  assert.deepEqual(result.selected, []);
  assert.equal(result.deferred.find(item => item.taskId === 'todo').reason, 'NO_AVAILABILITY');
  assert.deepEqual(result.completedToday.map(item => [item.taskId, item.reason]), [['done-today', 'STATUS_DONE']]);
  assert.deepEqual(result.excluded.map(item => [item.taskId, item.reason]), [
    ['done-old', 'STATUS_DONE'], ['skipped', 'STATUS_SKIPPED']
  ]);
  const identities = [result.selected, result.deferred, result.excluded, result.completedToday]
    .flat().filter(item => item.taskId).map(item => `${item.moduleId}/${item.taskId}`);
  assert.equal(new Set(identities).size, identities.length);
});

test('fazy mają kolejność urgent, scheduled, fairness i global fill', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    sources: [
      source('a', [
        task({ id: 'urgent', priority: 25, planningClass: 'urgent', estimatedMinutes: 10 }),
        task({ id: 'scheduled', priority: 1, planningClass: 'scheduled', estimatedMinutes: 10 }),
        task({ id: 'flex-1', priority: 40, estimatedMinutes: 10 }),
        task({ id: 'flex-2', priority: 41, estimatedMinutes: 10 })
      ]),
      source('b', [task({ id: 'flex-b', priority: 39, estimatedMinutes: 10 })])
    ]
  });
  assert.deepEqual(result.selected.map(item => item.selectionReason), [
    'URGENT_PHASE', 'SCHEDULED_PHASE', 'DOMAIN_FAIRNESS_PHASE', 'DOMAIN_FAIRNESS_PHASE', 'GLOBAL_FILL_PHASE'
  ]);
  assert.deepEqual(result.selected.map(item => item.phase), [
    'urgent', 'scheduled', 'domain-fairness', 'domain-fairness', 'global-fill'
  ]);
});

test('urgent i scheduled używają dokładnego komparatora priority, dueDate, moduleId, sourceOrder', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    sources: [
      source('b', [task({ id: 'b', priority: 10, dueDate: '2026-09-09', planningClass: 'urgent', estimatedMinutes: 5 })]),
      source('a', [
        task({ id: 'a-later', priority: 10, dueDate: '2026-09-10', planningClass: 'urgent', estimatedMinutes: 5 }),
        task({ id: 'a-first', priority: 10, dueDate: '2026-09-09', planningClass: 'urgent', estimatedMinutes: 5 }),
        task({ id: 'a-second', priority: 10, dueDate: '2026-09-09', planningClass: 'urgent', estimatedMinutes: 5 }),
        task({ id: 'priority', priority: 9, dueDate: null, planningClass: 'urgent', estimatedMinutes: 5 })
      ])
    ]
  });
  assert.deepEqual(result.selected.map(item => item.taskId), ['priority', 'a-first', 'a-second', 'b', 'a-later']);
});

test('best-fit jest atomowy, osiąga remis wcześniejszym oknem i zachowuje osobny executionOrder', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    availability: configuredAvailability([
      { start: '08:00', end: '09:00' },
      { start: '10:00', end: '10:30' }
    ]),
    sources: [source('alpha', [
      task({ id: 'first-selected', planningClass: 'urgent', priority: 1, estimatedMinutes: 25 }),
      task({ id: 'second-selected', planningClass: 'urgent', priority: 2, estimatedMinutes: 30 })
    ])]
  });
  assert.deepEqual(result.selected.map(item => ({ id: item.taskId, rank: item.selectionRank, order: item.executionOrder, slot: item.slot })), [
    { id: 'second-selected', rank: 2, order: 1, slot: { start: '08:00', end: '08:30' } },
    { id: 'first-selected', rank: 1, order: 2, slot: { start: '10:00', end: '10:25' } }
  ]);

  const exact = build(app, {
    availability: configuredAvailability([{ start: '08:00', end: '08:15' }]),
    sources: [source('alpha', [task({ estimatedMinutes: 15 })])]
  });
  assert.deepEqual(exact.selected[0].slot, { start: '08:00', end: '08:15' });
});

test('duże niewykonalne zadanie nie blokuje krótszego i dostaje NO_FITTING_WINDOW', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    availability: configuredAvailability([
      { start: '08:00', end: '08:30' },
      { start: '09:00', end: '09:30' }
    ]),
    sources: [source('alpha', [
      task({ id: 'large', planningClass: 'urgent', priority: 1, estimatedMinutes: 40 }),
      task({ id: 'small', planningClass: 'urgent', priority: 2, estimatedMinutes: 20 })
    ])]
  });
  assert.deepEqual(result.selected.map(item => item.taskId), ['small']);
  assert.deepEqual(result.selected[0].slot, { start: '08:00', end: '08:20' });
  assert.equal(result.deferred.find(item => item.taskId === 'large').reason, 'NO_FITTING_WINDOW');
});

test('scheduled niewybrane w swojej fazie nie przechodzi do flexible', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    manualBudgetKey: 'short', manualBudgetMinutes: 30,
    sources: [source('alpha', [
      task({ id: 'training', planningClass: 'scheduled', priority: 30, estimatedMinutes: 40 }),
      task({ id: 'flex', planningClass: 'flexible', priority: 40, estimatedMinutes: 10 })
    ])]
  });
  assert.deepEqual(result.selected.map(item => item.taskId), ['flex']);
  assert.equal(result.deferred.find(item => item.taskId === 'training').reason, 'BUDGET_EXHAUSTED');
  assert.equal(result.selected.some(item => item.taskId === 'training'), false);
});

test('fairness rotuje leksykograficzne domeny przez civilDayOrdinal, także dla zera i jednej domeny', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const moduleIds = ['alpha', 'beta', 'gamma'];
  const sources = moduleIds.map(moduleId => source(moduleId, [task({ id: moduleId, estimatedMinutes: 5 })]));
  for (const date of [DATE, '2026-09-08']) {
    const result = build(app, {
      date,
      availability: unconfiguredAvailability(date, app.api.weekdayFromLocalDate(date)),
      sources
    });
    const offset = app.api.positiveModulo(app.api.civilDayOrdinal(date), moduleIds.length);
    const expected = [...moduleIds.slice(offset), ...moduleIds.slice(0, offset)];
    assert.deepEqual(result.selected.map(item => item.moduleId), expected);
  }
  assert.deepEqual(build(app, { sources: [source('alpha', [])] }).selected, []);
  assert.deepEqual(build(app, { sources: [source('only', [task({ id: 'only' })])] }).selected.map(item => item.moduleId), ['only']);
});

test('flexible w domenie i global fill respektują wyłącznie zaakceptowane komparatory', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const sources = [
    source('alpha', [
      task({ id: 'a-late', priority: 40, dueDate: '2026-09-10', estimatedMinutes: 5 }),
      task({ id: 'a-early', priority: 40, dueDate: '2026-09-09', estimatedMinutes: 5 }),
      task({ id: 'a-priority', priority: 39, dueDate: null, estimatedMinutes: 5 })
    ]),
    source('beta', [
      task({ id: 'b-first', priority: 39, dueDate: null, estimatedMinutes: 5 }),
      task({ id: 'b-second', priority: 40, dueDate: '2026-09-08', estimatedMinutes: 5 })
    ])
  ];
  const result = build(app, { sources, manualBudgetKey: 'long', manualBudgetMinutes: 150 });
  const firstByModule = new Map();
  for (const selected of result.selected.filter(item => item.phase === 'domain-fairness')) {
    firstByModule.set(selected.moduleId, selected.taskId);
  }
  assert.equal(firstByModule.get('alpha'), 'a-priority');
  assert.equal(firstByModule.get('beta'), 'b-first');
  assert.deepEqual(result.selected.filter(item => item.phase === 'global-fill').map(item => item.taskId), [
    'b-second', 'a-early', 'a-late'
  ]);
});

test('global fill rozstrzyga osiągalne remisy przez rotowaną domenę i sourceOrder', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const sources = ['alpha', 'beta'].map(moduleId => source(moduleId, [
    task({ id: `${moduleId}-fair`, priority: 1, estimatedMinutes: 1 }),
    task({ id: `${moduleId}-same-1`, priority: 40, dueDate: '2026-09-10', estimatedMinutes: 1 }),
    task({ id: `${moduleId}-same-2`, priority: 40, dueDate: '2026-09-10', estimatedMinutes: 1 })
  ]));
  const result = build(app, { sources, manualBudgetKey: 'long', manualBudgetMinutes: 150 });
  const rotated = result.selected.filter(item => item.phase === 'domain-fairness').map(item => item.moduleId);
  const expectedGlobal = rotated.flatMap(moduleId => [`${moduleId}-same-1`, `${moduleId}-same-2`]);
  assert.deepEqual(result.selected.filter(item => item.phase === 'global-fill').map(item => item.taskId), expectedGlobal);
});

test('globalna tożsamość moduleId + taskId pozwala na to samo taskId w różnych modułach', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    sources: [source('alpha', [task({ id: 'shared' })]), source('beta', [task({ id: 'shared' })])]
  });
  assert.equal(result.ok, true);
  assert.equal(result.partial, false);
  assert.deepEqual(result.selected.map(item => `${item.moduleId}/${item.taskId}`).sort(), ['alpha/shared', 'beta/shared']);
});

test('globalna tożsamość zachowuje rzeczywistą parę także przy znakach NUL', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const sources = [
    source('a', [
      task({ id: '\u0000b', priority: 10 }),
      task({ id: 'a-tail', priority: 30 })
    ]),
    source('a\u0000', [
      task({ id: 'helper', priority: 10 }),
      task({ id: 'b', priority: 20 })
    ])
  ];
  const result = build(app, { sources });
  const allRecords = [
    ...result.selected,
    ...result.deferred,
    ...result.excluded,
    ...result.completedToday
  ];
  const expectedPairs = [
    ['a', '\u0000b'],
    ['a', 'a-tail'],
    ['a\u0000', 'helper'],
    ['a\u0000', 'b']
  ];

  assert.equal(result.ok, true);
  assert.equal(result.selected.some(item => item.phase === 'global-fill'), true);
  assert.equal(allRecords.length, expectedPairs.length);
  for (const [moduleId, taskId] of expectedPairs) {
    assert.equal(allRecords.filter(item => item.moduleId === moduleId && item.taskId === taskId).length, 1);
  }
});

test('błędny Task i duplikat ID izolują cały moduł, pozostawiając bezpieczny partial plan', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  for (const badTasks of [
    [task({ id: 'valid-before' }), task({ id: 'bad', title: '' })],
    [task({ id: 'duplicate' }), task({ id: 'duplicate' })]
  ]) {
    const result = build(app, {
      sources: [source('bad-module', badTasks), source('good-module', [task({ id: 'good' })])]
    });
    assert.equal(result.ok, true);
    assert.equal(result.partial, true);
    assert.deepEqual(result.selected.map(item => item.taskId), ['good']);
    assert.deepEqual(result.warnings.map(item => item.code), ['MODULE_TASKS_UNAVAILABLE', 'INVALID_TASK', 'AVAILABILITY_NOT_CONFIGURED']);
    assert.deepEqual(result.excluded, [{ moduleId: 'bad-module', sourceOrder: 1, reason: 'INVALID_TASK' }]);
    assert.equal(JSON.stringify(result).includes('valid-before'), false);
  }
});

test('wyjątek, nie-tablica i limit 501 izolują źródło, a brak wszystkich źródeł jest fatalny', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const tooMany = Array.from({ length: 501 }, (_, index) => task({ id: `many-${index}` }));
  for (const badTasks of [null, { not: 'array' }, tooMany]) {
    const result = build(app, {
      sources: [source('bad', badTasks), source('good', [task({ id: 'good' })])]
    });
    assert.equal(result.ok, true);
    assert.equal(result.partial, true);
    assert.deepEqual(result.selected.map(item => item.taskId), ['good']);
    assert.equal(result.warnings[0].code, 'MODULE_TASKS_UNAVAILABLE');
  }
  assert.equal(build(app, { sources: [] }).code, 'TASK_SOURCES_UNAVAILABLE');
  assert.equal(build(app, { sources: [source('bad', null)] }).code, 'TASK_SOURCES_UNAVAILABLE');
});

test('limit 2000 rekordów i niezależny limit 100 selected są zachowane bez utraty częściowego planu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const sources = Array.from({ length: 4 }, (_, moduleIndex) => source(
    `module-${moduleIndex}`,
    Array.from({ length: 500 }, (_, taskIndex) => task({
      id: `task-${moduleIndex}-${taskIndex}`,
      estimatedMinutes: 1
    }))
  ));
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    sources
  });
  assert.equal(result.ok, true);
  assert.equal(result.selected.length, 100);
  assert.equal(result.selected.length + result.deferred.length + result.excluded.length + result.completedToday.length, 2000);
  assert.equal(result.totals.unusedEffectiveMinutes, 50);
  assert.equal(result.deferred.every(item => item.reason === 'SELECTION_LIMIT_REACHED'), true);
  assert.equal(result.deferred.every(item => item.details.selectedLimit === 100), true);

  const partial = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    sources: [...sources, source('overflow', [task({ id: 'overflow' })])]
  });
  assert.equal(partial.ok, true);
  assert.equal(partial.partial, true);
  assert.equal(partial.selected.length + partial.deferred.length + partial.excluded.length + partial.completedToday.length, 2000);
  assert.equal(partial.warnings.some(item => item.moduleId === 'overflow'), true);
});

test('DOMAIN_TURN_NOT_REACHED występuje tylko dla domen nieosiągniętych przez limit selected', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const urgent = Array.from({ length: 100 }, (_, index) => task({
    id: `urgent-${index}`, priority: 1, estimatedMinutes: 1, planningClass: 'urgent'
  }));
  const result = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    sources: [
      source('urgent', urgent),
      source('alpha', [task({ id: 'alpha-flex', estimatedMinutes: 1 })]),
      source('beta', [task({ id: 'beta-flex', estimatedMinutes: 1 })])
    ]
  });
  assert.equal(result.selected.length, 100);
  assert.deepEqual(result.deferred.map(item => item.reason), ['DOMAIN_TURN_NOT_REACHED', 'DOMAIN_TURN_NOT_REACHED']);

  const budgetAndLimit = build(app, {
    manualBudgetKey: 'long', manualBudgetMinutes: 150,
    availability: configuredAvailability([{ start: '00:00', end: '01:40' }]),
    sources: [
      source('urgent', urgent),
      source('alpha', [task({ id: 'alpha-flex', estimatedMinutes: 1 })]),
      source('beta', [task({ id: 'beta-flex', estimatedMinutes: 1 })])
    ]
  });
  assert.equal(budgetAndLimit.selected.length, 100);
  assert.deepEqual(budgetAndLimit.deferred.map(item => item.reason), ['BUDGET_EXHAUSTED', 'BUDGET_EXHAUSTED']);
  assert.equal(budgetAndLimit.deferred.every(item => item.details.remainingBudgetMinutes === 0), true);
});

test('fasada wywołuje każde publiczne źródło dokładnie raz i nie zapisuje Store ani nie emituje zdarzeń', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const calls = [];
  let dayRecordCalls = 0;
  let availabilityCalls = 0;
  const originalGetRecord = app.api.DayEngine.getRecord;
  const originalGetAvailability = app.api.AvailabilityEngine.getAvailabilityForDate;
  app.api.DayEngine.getRecord = date => {
    dayRecordCalls++;
    return originalGetRecord(date);
  };
  app.api.AvailabilityEngine.getAvailabilityForDate = date => {
    availabilityCalls++;
    return originalGetAvailability(date);
  };
  for (const module of app.api.ModuleRegistry.all()) {
    module.getTasks = date => {
      calls.push([module.id, date]);
      return [];
    };
  }
  const events = [];
  const unsubStore = app.api.EventBus.on('store:change', payload => events.push(['store', payload]));
  const unsubTasks = app.api.EventBus.on('tasks:changed', payload => events.push(['tasks', payload]));
  t.after(() => { unsubStore(); unsubTasks(); });
  app.storageControl.reset();

  const result = toPlain(app.api.PlanDayEngine.getPlanForDate(DATE, 'short', 123));
  assert.equal(result.ok, true);
  assert.deepEqual(calls, toPlain(app.api.ModuleRegistry.all().map(module => [module.id, DATE])));
  assert.equal(new Set(calls.map(([id]) => id)).size, app.api.ModuleRegistry.all().length);
  assert.equal(dayRecordCalls, 1);
  assert.equal(availabilityCalls, 1);
  assert.equal(app.storageControl.attempts.length, 0);
  assert.deepEqual(events, []);
});

test('getPlanForToday przechwytuje przekazany czas raz, ignoruje sekundy i poprawnie wyznacza lokalną datę', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  for (const module of app.api.ModuleRegistry.all()) module.getTasks = () => [];
  const now = new app.window.Date(2026, 8, 7, 13, 47, 59, 999);
  let getTimeCalls = 0;
  const originalGetTime = app.window.Date.prototype.getTime;
  app.window.Date.prototype.getTime = function countedGetTime() {
    if (this === now) getTimeCalls++;
    return originalGetTime.call(this);
  };

  const result = toPlain(app.api.PlanDayEngine.getPlanForToday('normal', now));
  assert.equal(getTimeCalls, 1);
  assert.equal(result.date, '2026-09-07');
  assert.equal(result.planningStartMinute, 13 * 60 + 47);
  assert.equal(app.api.PlanDayEngine.getPlanForToday('normal', new app.window.Date('invalid')).code, 'INVALID_INPUT');
});

test('getPlanForDate nie odczytuje zegara, a błędny budżet nie odpytuje modułów', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  let calls = 0;
  for (const module of app.api.ModuleRegistry.all()) module.getTasks = () => { calls++; return []; };
  const NativeDate = app.window.Date;
  app.window.Date = class ForbiddenDate extends NativeDate {
    constructor(...args) {
      if (!args.length) throw new Error('hidden clock');
      super(...args);
    }
    static now() { throw new Error('hidden clock'); }
  };
  assert.equal(app.api.PlanDayEngine.getPlanForDate(DATE, 'short', 0).ok, true);
  const beforeInvalidBudget = calls;
  assert.equal(app.api.PlanDayEngine.getPlanForDate(DATE, 'invalid', 0).code, 'INVALID_BUDGET');
  assert.equal(calls, beforeInvalidBudget);
});

test('awaria jednego modułu w fasadzie daje partial, a wszystkich TASK_SOURCES_UNAVAILABLE bez treści wyjątku', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const modules = app.api.ModuleRegistry.all();
  modules.forEach((module, index) => {
    module.getTasks = index === 0 ? () => { throw new Error('UNTRUSTED_SENTINEL'); } : () => [];
  });
  const partial = toPlain(app.api.PlanDayEngine.getPlanForDate(DATE, 'normal', 0));
  assert.equal(partial.ok, true);
  assert.equal(partial.partial, true);
  assert.equal(partial.warnings[0].code, 'MODULE_TASKS_UNAVAILABLE');
  assert.equal(JSON.stringify(partial).includes('UNTRUSTED_SENTINEL'), false);

  modules.forEach(module => { module.getTasks = () => { throw new Error('UNTRUSTED_SENTINEL'); }; });
  const fatal = toPlain(app.api.PlanDayEngine.getPlanForDate(DATE, 'normal', 0));
  assert.equal(fatal.ok, false);
  assert.equal(fatal.code, 'TASK_SOURCES_UNAVAILABLE');
  assert.equal(JSON.stringify(fatal).includes('UNTRUSTED_SENTINEL'), false);
});

test('buildPlan nie używa Store, DOM, EventBus, zegara ani losowości', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const windowInput = inWindow(app, planInput());
  const forbid = label => () => { throw new Error(`${label} forbidden`); };
  app.api.Store.get = forbid('Store.get');
  app.api.Store.set = forbid('Store.set');
  app.api.EventBus.emit = forbid('EventBus.emit');
  app.window.Math.random = forbid('Math.random');
  const NativeDate = app.window.Date;
  app.window.Date = class ForbiddenDate extends NativeDate {
    constructor() { throw new Error('Date forbidden'); }
    static now() { throw new Error('Date.now forbidden'); }
  };
  app.document.getElementById = forbid('DOM');

  assert.equal(app.api.PlanDayEngine.buildPlan(windowInput).ok, true);
});

test('produkcyjny Today nadal używa kompatybilnościowego DecisionEngine, nie PlanDayEngine', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const todaySource = await readTodaySource();
  assert.equal(todaySource.includes('PlanDayEngine'), false);
  assert.equal(todaySource.includes('DecisionEngine.planToday'), true);
  assert.doesNotThrow(() => app.document.querySelector('.time-btn[data-key="short"]').click());
  assert.equal(app.document.querySelector('#today-tasks') !== null, true);
  assert.deepEqual(app.errors.window, []);
  assert.deepEqual(app.errors.console, []);
});

test('publiczny wynik ma zamknięte powody, bezpieczne details i rozłączne głębokie kopie', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const result = build(app, {
    energyScore: 49,
    availability: configuredAvailability([{ start: '08:00', end: '08:20' }]),
    sources: [source('alpha', [
      task({ id: 'hard', difficulty: 4, why: 'safe public why', domainOnly: 'UNTRUSTED_FIELD' }),
      task({ id: 'too-long', estimatedMinutes: 30, difficulty: 2 })
    ])]
  });
  assert.equal(result.deferred[0].reason, 'ENERGY_TOO_LOW');
  assert.deepEqual(result.deferred[0].details, { energyState: 'low', difficulty: 4 });
  assert.equal(result.deferred[1].reason, 'BUDGET_EXHAUSTED');
  assert.deepEqual(Object.keys(result.deferred[1].details), ['remainingBudgetMinutes']);
  assert.equal(JSON.stringify(result).includes('UNTRUSTED_FIELD'), false);
  assert.equal('deferredReason' in result.deferred[0], false);
  assert.equal(result.totals.plannedMinutes, 0);
  assert.equal(result.totals.unusedEffectiveMinutes, 20);
  assert.equal(result.totals.uncommittedAvailabilityMinutes, 20);
});

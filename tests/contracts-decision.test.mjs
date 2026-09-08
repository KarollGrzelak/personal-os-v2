import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_MONDAY, schoolItem, trainingProfile } from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

const ALLOWED_TASK_STATUSES = new Set(['todo', 'done', 'skipped']);

function validTask(overrides = {}) {
  return {
    id: 'synthetic-task',
    title: 'Synthetic task',
    status: 'todo',
    priority: 40,
    estimatedMinutes: 30,
    difficulty: 2,
    planningClass: 'flexible',
    ...overrides
  };
}

function emptyModule(id) {
  return {
    id,
    name: `Synthetic replacement ${id}`,
    getTasks: date => {
      assert.equal(typeof date, 'string');
      return [];
    },
    getStats: () => ({ done: 0, total: 0, label: id }),
    render: () => {}
  };
}

function clearDomainTasks(api) {
  for (const id of ['training', 'it', 'school']) api.ModuleRegistry.register(emptyModule(id));
}

test('Core liczy daty cywilne, weekday i różnice dni bez wpływu granic miesiąca, roku i DST', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const api = app.api;

  for (const date of ['2024-02-29', '2026-03-29', '2026-10-25', '2026-12-31']) {
    assert.equal(api.isValidCalendarDateString(date), true);
    assert.equal(api.assertPlanningDate(date), date);
  }
  for (const date of [undefined, null, '', '2026-2-03', '2026-02-29', '0000-01-01']) {
    assert.equal(api.isValidCalendarDateString(date), false);
    assert.throws(() => api.assertPlanningDate(date), error => (
      error instanceof app.window.TypeError && error.code === 'INVALID_DATE'
    ));
  }

  assert.deepEqual(toPlain(api.parseCalendarDateString('2024-02-29')), { year: 2024, month: 2, day: 29 });
  assert.equal(api.parseCalendarDateString('2023-02-29'), null);
  assert.equal(api.differenceInCalendarDays('2024-02-28', '2024-03-01'), 2);
  assert.equal(api.differenceInCalendarDays('2025-12-31', '2026-01-01'), 1);
  assert.equal(api.differenceInCalendarDays('2026-03-28', '2026-03-30'), 2, 'wiosenna zmiana DST');
  assert.equal(api.differenceInCalendarDays('2026-10-24', '2026-10-26'), 2, 'jesienna zmiana DST');
  assert.equal(api.differenceInCalendarDays('2026-01-02', '2025-12-31'), -2);
  assert.equal(api.civilDayOrdinal('1970-01-01'), 0);
  assert.equal(api.positiveModulo(-1, 7), 6);

  const week = ['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'];
  assert.deepEqual(week.map(api.weekdayFromLocalDate), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(api.weekdayFromLocalDate('2026-02-29'), null, 'publiczny kontrakt Availability pozostaje null dla błędu');
});

test('cztery moduły odrzucają każdą brakującą lub błędną datę przed efektami ubocznymi', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const modules = ['training', 'it', 'school', 'english'].map(id => app.api.ModuleRegistry.get(id));
  const invalidArguments = [[], [undefined], [null], [''], ['20-08-2026'], ['2026-02-29']];
  const originalGet = app.api.Store.get;
  const originalSet = app.api.Store.set;
  let reads = 0;
  let writes = 0;
  let renders = 0;
  const events = [];
  app.api.Store.get = (...args) => { reads += 1; return originalGet(...args); };
  app.api.Store.set = (...args) => { writes += 1; return originalSet(...args); };
  const unsubs = ['tasks:changed', 'task:status'].map(name => app.api.EventBus.on(name, payload => events.push([name, payload])));

  for (const module of modules) {
    const originalRender = module.render;
    module.render = (...args) => { renders += 1; return originalRender(...args); };
    for (const args of invalidArguments) {
      assert.throws(() => module.getTasks(...args), error => (
        error instanceof app.window.TypeError && error.code === 'INVALID_DATE'
      ), `${module.id}: ${String(args[0])}`);
    }
    module.render = originalRender;
  }
  for (const args of invalidArguments) {
    assert.throws(() => app.api.PriorityEngine.collectOpenTasks(...args), error => (
      error instanceof app.window.TypeError && error.code === 'INVALID_DATE'
    ));
    assert.throws(() => app.api.DecisionEngine.planToday(60, ...args), error => (
      error instanceof app.window.TypeError && error.code === 'INVALID_DATE'
    ));
  }

  app.api.Store.get = originalGet;
  app.api.Store.set = originalSet;
  unsubs.forEach(unsub => unsub());
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.equal(renders, 0);
  assert.deepEqual(events, []);
});

test('widok Dziś przechwytuje jedną lokalną datę i przekazuje ją do pojedynczego odczytu PlanDay', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T22:30:00.000Z' });
  t.after(() => app.close());
  const dates = [];
  app.api.ModuleRegistry.register({
    ...emptyModule('synthetic-date-forwarding'),
    getTasks: date => {
      dates.push(date);
      return [];
    }
  });

  app.document.querySelector('.time-btn[data-key="short"]').click();

  assert.deepEqual(dates, ['2026-08-21']);
});

test('walidator Task v2 akceptuje wymagane, opcjonalne i dodatkowe bezpieczne pola na granicach', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const inWindow = value => app.window.JSON.parse(JSON.stringify(value));
  const boundaryTasks = [
    validTask({ id: 'x'.repeat(200), title: 'y'.repeat(300), priority: 0, estimatedMinutes: 1, difficulty: 1 }),
    validTask({ status: 'done', priority: 100, estimatedMinutes: 1440, difficulty: 5, planningClass: 'urgent' }),
    validTask({
      status: 'skipped', planningClass: 'scheduled', why: 'z'.repeat(2000), xp: 100000,
      dueDate: '2024-02-29', completedDate: null, extra: { synthetic: true }, moduleId: 'untrusted', moduleName: 'Untrusted'
    })
  ];
  for (const task of boundaryTasks) {
    const source = inWindow(task);
    const before = JSON.stringify(source);
    assert.deepEqual(toPlain(app.api.validateTaskV2(source)), { valid: true, errors: [] });
    assert.equal(JSON.stringify(source), before, 'walidacja nie zmienia źródła');
  }

  const nullPrototype = app.window.Object.assign(app.window.Object.create(null), inWindow(validTask()));
  assert.equal(app.api.validateTaskV2(nullPrototype).valid, true);
});

test('walidator Task v2 odrzuca braki, granice poza zakresem i niebezpieczne obiekty', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const inWindow = value => app.window.JSON.parse(JSON.stringify(value));
  const invalidOverrides = [
    { id: '' }, { id: 'x'.repeat(201) }, { title: ' ' }, { title: 'x'.repeat(301) },
    { status: 'unknown' }, { priority: -1 }, { priority: 101 }, { priority: 1.5 },
    { estimatedMinutes: 0 }, { estimatedMinutes: 1441 }, { difficulty: 0 }, { difficulty: 6 },
    { planningClass: 'other' }, { why: 'x'.repeat(2001) }, { xp: -1 }, { xp: 100001 },
    { dueDate: '2026-02-29' }, { completedDate: '2026-13-01' }
  ];
  for (const overrides of invalidOverrides) {
    assert.equal(app.api.validateTaskV2(inWindow(validTask(overrides))).valid, false, JSON.stringify(overrides));
  }
  for (const field of ['id', 'title', 'status', 'priority', 'estimatedMinutes', 'difficulty', 'planningClass']) {
    const task = inWindow(validTask());
    delete task[field];
    assert.equal(app.api.validateTaskV2(task).valid, false, `brak ${field}`);
  }
  for (const field of ['priority', 'estimatedMinutes', 'difficulty', 'xp']) {
    for (const value of [app.window.NaN, app.window.Infinity, -app.window.Infinity]) {
      assert.equal(app.api.validateTaskV2(app.window.Object.assign(inWindow(validTask({ xp: 0 })), { [field]: value })).valid, false, `${field}: ${value}`);
    }
  }

  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const dangerous = app.window.JSON.parse(JSON.stringify(validTask()).slice(0, -1) + `,"${key}":{}}`);
    assert.equal(app.api.validateTaskV2(dangerous).valid, false, key);
  }
  const customPrototype = app.window.Object.assign(app.window.Object.create({ synthetic: true }), inWindow(validTask()));
  assert.equal(app.api.validateTaskV2(customPrototype).valid, false);
  for (const kind of ['get', 'set']) {
    const accessor = inWindow(validTask());
    app.window.Object.defineProperty(accessor, 'title', kind === 'get'
      ? { configurable: true, enumerable: true, get() { throw new Error('must not run'); } }
      : { configurable: true, enumerable: true, set(value) {} });
    assert.equal(app.api.validateTaskV2(accessor).valid, false);
  }
  const hostile = new app.window.Proxy(inWindow(validTask()), {
    ownKeys() { throw new Error('synthetic trap'); }
  });
  assert.equal(app.api.validateTaskV2(hostile).valid, false);
});

test('awaria zapisu zatrzymuje tasks:changed przed emisją we wszystkich domenach', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const training = app.api.ModuleRegistry.get('training');
  const learning = app.api.ModuleRegistry.get('it');
  const school = app.api.ModuleRegistry.get('school');
  const english = app.api.ModuleRegistry.get('english');
  const firstStage = app.api.ROADMAP_STAGES[0];
  for (const criterion of firstStage.criteria) learning.setTaskStatus(criterion.id, 'done');
  app.api.Store.set('english:profile', app.window.JSON.parse(JSON.stringify({
    enabled: false, selfAssessedLevel: 'unknown', weeklyMinutes: 120, focus: 'balanced'
  })));
  const events = [];
  app.api.EventBus.on('tasks:changed', payload => events.push(toPlain(payload)));
  const originalSet = app.api.Store.set;
  app.api.Store.set = () => { throw new Error('Synthetic persistence failure'); };

  const mutations = [
    ['training', () => training.saveProfile(trainingProfile({ equipment: ['mata'], availableDays: [1, 3] }))],
    ['learning', () => app.api.RoadmapEngine.completeStage(firstStage.id)],
    ['school', () => school.addItem(schoolItem({ subject: 'Synthetic persistence item' }))],
    ['english', () => english.setEnabled(true)]
  ];
  for (const [domain, mutate] of mutations) assert.throws(mutate, /Synthetic persistence failure/, domain);

  app.api.Store.set = originalSet;
  assert.deepEqual(events, []);
});

test('zarejestrowane moduły mają unikalne identyfikatory i właściwy kontrakt', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const school = app.api.ModuleRegistry.get('school');
  assert.equal(school.addItem(schoolItem({ dueDate: '2026-08-18' })).ok, true);

  const modules = app.api.ModuleRegistry.all();
  const ids = modules.map(module => module.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const module of modules) {
    assert.equal(typeof module.id, 'string');
    assert.notEqual(module.id, '');
    assert.equal(typeof module.name, 'string');
    for (const method of ['getTasks', 'getStats', 'render']) assert.equal(typeof module[method], 'function');
    if ('setTaskStatus' in module) assert.equal(typeof module.setTaskStatus, 'function');

    const stats = module.getStats();
    assert.equal(typeof stats.done, 'number');
    assert.equal(typeof stats.total, 'number');
    assert.equal(typeof stats.label, 'string');

    for (const task of module.getTasks('2026-08-17')) {
      assert.deepEqual(toPlain(app.api.validateTaskV2(task)), { valid: true, errors: [] }, module.id);
      assert.equal(typeof task.id, 'string');
      assert.equal(typeof task.title, 'string');
      assert.equal(typeof task.priority, 'number');
      assert.equal(typeof task.estimatedMinutes, 'number');
      assert.equal(typeof task.difficulty, 'number');
      assert.equal(['urgent', 'scheduled', 'flexible'].includes(task.planningClass), true);
      assert.equal(typeof task.xp, 'number');
      assert.equal(ALLOWED_TASK_STATUSES.has(task.status), true, `${module.id}: status ${task.status}`);
      assert.equal(task.completedDate === null || typeof task.completedDate === 'string', true);
    }
  }
});

test('ModuleRegistry odrzuca moduł niespełniający aktualnego kontraktu', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  app.api.ModuleRegistry.register({ id: 'synthetic-invalid', name: 'Synthetic invalid module', getTasks: 'not-a-function' });

  assert.equal(app.api.ModuleRegistry.get('synthetic-invalid'), undefined);
  assert.equal(app.errors.console.length, 1);
  assert.match(String(app.errors.console[0][0]), /nie spełnia kontraktu/);
});

test('PriorityEngine zbiera wyłącznie todo z dowolnego poprawnego modułu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  clearDomainTasks(app.api);
  app.api.ModuleRegistry.register({
    ...emptyModule('synthetic-domain'),
    name: 'Synthetic domain',
    getTasks: date => [
      { id: 'open', title: 'Open', status: 'todo' },
      { id: 'finished', title: 'Finished', status: 'done' },
      { id: 'omitted', title: 'Omitted', status: 'skipped' }
    ]
  });

  const tasks = toPlain(app.api.PriorityEngine.collectOpenTasks('2026-08-20'));

  assert.deepEqual(tasks.map(task => task.id), ['open']);
  assert.equal(tasks[0].moduleId, 'synthetic-domain');
  assert.equal(tasks[0].moduleName, 'Synthetic domain');
});

test('PriorityEngine sortuje priorytety, respektuje granice budżetu i zwraca deferredByTime', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const tasks = [
    { id: 'third', priority: 3, estimatedMinutes: 1 },
    { id: 'second', priority: 2, estimatedMinutes: 10 },
    { id: 'first', priority: 1, estimatedMinutes: 20 }
  ];

  const exact = toPlain(app.api.PriorityEngine.pickWithinBudget(tasks, 30));
  assert.deepEqual(exact.picks.map(task => task.id), ['first', 'second']);
  assert.deepEqual(exact.deferredByTime.map(task => task.id), ['third']);

  const none = toPlain(app.api.PriorityEngine.pickWithinBudget(tasks, 0));
  assert.deepEqual(none.picks, []);
  assert.deepEqual(none.deferredByTime.map(task => task.id), ['first', 'second', 'third']);

  const defaultCost = toPlain(app.api.PriorityEngine.pickWithinBudget([{ id: 'default-cost' }], 15));
  assert.deepEqual(defaultCost.picks.map(task => task.id), ['default-cost']);
});

test('DecisionEngine filtruje energię przed budżetem i poprawnie liczy powody odroczenia', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  clearDomainTasks(app.api);
  app.api.ModuleRegistry.register({
    ...emptyModule('synthetic-decisions'),
    getTasks: date => [
      { id: 'hard-first', title: 'Hard', status: 'todo', priority: 1, estimatedMinutes: 20, difficulty: 4 },
      { id: 'light-fit', title: 'Light', status: 'todo', priority: 2, estimatedMinutes: 20, difficulty: 2 },
      { id: 'light-too-long', title: 'Long', status: 'todo', priority: 3, estimatedMinutes: 30, difficulty: 2 }
    ]
  });
  app.api.DayEngine.checkIn(3, 1);

  const plan = toPlain(app.api.DecisionEngine.planToday(20, '2026-08-17'));

  assert.deepEqual(plan.picks.map(task => task.id), ['light-fit']);
  assert.deepEqual(plan.deferred.map(task => task.id), ['light-too-long', 'hard-first']);
  assert.deepEqual(plan.reasonCounts, { time: 1, energy: 1 });
  assert.equal(plan.energy < 50, true);
});

test('DecisionEngine deleguje done i todo do właściwego, niezależnego modułu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  clearDomainTasks(app.api);
  const calls = [];
  app.api.ModuleRegistry.register({
    ...emptyModule('synthetic-delegation'),
    setTaskStatus: (taskId, status) => calls.push({ taskId, status })
  });

  app.api.DecisionEngine.setTaskStatus('synthetic-delegation', 'task-1', 'done');
  app.api.DecisionEngine.setTaskStatus('synthetic-delegation', 'task-1', 'todo');
  app.api.DecisionEngine.setTaskStatus('missing-module', 'task-1', 'done');

  assert.deepEqual(calls, [
    { taskId: 'task-1', status: 'done' },
    { taskId: 'task-1', status: 'todo' }
  ]);
});

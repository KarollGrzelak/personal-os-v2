import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_MONDAY, schoolItem } from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

const ALLOWED_TASK_STATUSES = new Set(['todo', 'done', 'skipped']);

function emptyModule(id) {
  return {
    id,
    name: `Synthetic replacement ${id}`,
    getTasks: () => [],
    getStats: () => ({ done: 0, total: 0, label: id }),
    render: () => {}
  };
}

function clearDomainTasks(api) {
  for (const id of ['training', 'it', 'school']) api.ModuleRegistry.register(emptyModule(id));
}

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

    for (const task of module.getTasks()) {
      assert.equal(typeof task.id, 'string');
      assert.equal(typeof task.title, 'string');
      assert.equal(typeof task.priority, 'number');
      assert.equal(typeof task.estimatedMinutes, 'number');
      assert.equal(typeof task.difficulty, 'number');
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
    getTasks: () => [
      { id: 'open', title: 'Open', status: 'todo' },
      { id: 'finished', title: 'Finished', status: 'done' },
      { id: 'omitted', title: 'Omitted', status: 'skipped' }
    ]
  });

  const tasks = toPlain(app.api.PriorityEngine.collectOpenTasks());

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
    getTasks: () => [
      { id: 'hard-first', title: 'Hard', status: 'todo', priority: 1, estimatedMinutes: 20, difficulty: 4 },
      { id: 'light-fit', title: 'Light', status: 'todo', priority: 2, estimatedMinutes: 20, difficulty: 2 },
      { id: 'light-too-long', title: 'Long', status: 'todo', priority: 3, estimatedMinutes: 30, difficulty: 2 }
    ]
  });
  app.api.DayEngine.checkIn(3, 1);

  const plan = toPlain(app.api.DecisionEngine.planToday(20));

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

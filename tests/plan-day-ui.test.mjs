import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadApp,
  readEnglishSource,
  readLearningSource,
  readSchoolSource,
  readTodaySource,
  readTrainingSource,
  toPlain
} from './helpers/load-app.mjs';

const PLAN_DATE = '2026-08-20';
const PLAN_NOW = '2026-08-20T08:00:00.000Z';

function task(overrides = {}) {
  return {
    id: 'synthetic-task',
    title: 'Synthetic task',
    status: 'todo',
    priority: 40,
    estimatedMinutes: 20,
    difficulty: 2,
    planningClass: 'flexible',
    why: 'Synthetic reason',
    xp: 10,
    completedDate: null,
    dueDate: null,
    ...overrides
  };
}

function moduleSource(id, tasksOrFactory = []) {
  return {
    id,
    name: `Synthetic ${id}`,
    getTasks: typeof tasksOrFactory === 'function' ? tasksOrFactory : () => tasksOrFactory,
    getStats: () => ({ done: 0, total: 0, label: id }),
    render: () => {}
  };
}

function replaceBuiltInSources(app, replacements = []) {
  for (const id of ['training', 'it', 'school', 'english']) app.api.ModuleRegistry.register(moduleSource(id));
  replacements.forEach(module => {
    const getTasks = module.getTasks;
    module.getTasks = date => {
      const result = getTasks.call(module, date);
      return Array.isArray(result) ? app.window.JSON.parse(JSON.stringify(result)) : result;
    };
    app.api.ModuleRegistry.register(module);
  });
}

function configuredThursday(app, intervals = [{ start: '10:00', end: '12:00' }]) {
  return app.window.JSON.parse(JSON.stringify({
    weeklySchedule: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      intervals: weekday === 4 ? intervals : []
    })),
    exceptions: []
  }));
}

function renderAtControlledNow(app) {
  return toPlain(app.api.renderTodayTasks(new app.window.Date(PLAN_NOW)));
}

test('produkcyjny Today używa jednego getPlanForToday, jednego now i jednego odczytu każdego źródła', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  const calls = new Map();
  for (const id of ['training', 'it', 'school', 'english']) {
    calls.set(id, []);
    app.api.ModuleRegistry.register(moduleSource(id, date => {
      calls.get(id).push(date);
      return id === 'school'
        ? app.window.JSON.parse(JSON.stringify([task({ id: 'done-today', status: 'done', completedDate: PLAN_DATE })]))
        : [];
    }));
  }

  const plan = renderAtControlledNow(app);
  const source = await readTodaySource();

  assert.equal((source.match(/PlanDayEngine\.getPlanForToday/g) || []).length, 1);
  assert.equal(source.includes('DecisionEngine.planToday'), false);
  assert.equal(source.includes('DecisionEngine.setTaskStatus'), false);
  assert.equal(plan.date, PLAN_DATE);
  assert.equal(plan.planningStartMinute, 600);
  assert.deepEqual([...calls.values()], [[PLAN_DATE], [PLAN_DATE], [PLAN_DATE], [PLAN_DATE]]);
  assert.equal(plan.completedToday.length, 1, 'completedToday pochodzi z tego samego pojedynczego przebiegu');
  assert.match(app.document.querySelector('.today-plan-completed').textContent, /done-today|Synthetic task/);
});

test('Today pokazuje harmonogram, kolejność, budżety i wszystkie kolekcje wyniku PlanDay', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  app.api.Store.set('availability:configuration', configuredThursday(app), { strict: true });
  app.api.Store.set('dayRecords', app.window.JSON.parse(JSON.stringify({ [PLAN_DATE]: { date: PLAN_DATE, energyScore: 80 } })));
  replaceBuiltInSources(app, [moduleSource('synthetic-ui', [
    task({ id: 'urgent', title: 'Pilne zadanie', priority: 10, planningClass: 'urgent', estimatedMinutes: 20, difficulty: 3 }),
    task({ id: 'flexible', title: 'Elastyczne zadanie', estimatedMinutes: 30 }),
    task({ id: 'deferred', title: 'Za długie zadanie', estimatedMinutes: 70 }),
    task({ id: 'done-today', title: 'Ukończone dzisiaj', status: 'done', completedDate: PLAN_DATE }),
    task({ id: 'done-before', title: 'Ukończone wcześniej', status: 'done', completedDate: '2026-08-19' }),
    task({ id: 'skipped', title: 'Pominięte zadanie', status: 'skipped' })
  ])]);

  const plan = renderAtControlledNow(app);
  const text = app.document.getElementById('today-tasks').textContent;

  assert.equal(plan.mode, 'scheduled');
  assert.equal(plan.selected.length, 2);
  assert.equal(app.document.querySelectorAll('.today-plan-selected .today-plan-slot').length, 2);
  for (const expected of [
    'Plan na 2026-08-20', 'budżet ręczny w granicach dostępności', 'Pełny budżet60 min',
    'Pełna dostępność120 min', 'Pozostała dostępność120 min', 'Efektywny budżet60 min', 'Zaplanowano50 min',
    'Pozostały budżet10 min', 'Nieprzydzielona dostępność70 min', 'Teraz', 'Dalej',
    'Okna planowania: 10:00–12:00', 'Pilne zadanie', '10:00–10:20', 'Kolejność 2',
    'Ukończone dzisiaj', 'Za długie zadanie', 'Ukończone wcześniej', 'Pominięte zadanie'
  ]) assert.match(text, new RegExp(expected));
  assert.equal(app.document.querySelectorAll('.today-plan-completed [data-action="undo"]').length, 1);
  assert.equal(app.document.querySelectorAll('.today-plan-deferred .today-plan-task').length, 1);
  assert.equal(app.document.querySelectorAll('.today-plan-excluded .today-plan-task').length, 2);
});

test('bez Availability Today pokazuje uporządkowaną listę bez sztucznych godzin', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  replaceBuiltInSources(app, [moduleSource('synthetic-unscheduled', [task({ title: 'Lista bez godziny' })])]);

  const plan = renderAtControlledNow(app);
  const host = app.document.getElementById('today-tasks');

  assert.equal(plan.mode, 'unscheduled');
  assert.equal(plan.selected[0].slot, null);
  assert.equal(host.querySelectorAll('.today-plan-slot').length, 0);
  assert.match(host.textContent, /Teraz/);
  assert.match(host.textContent, /bez przypisanych godzin/);
  assert.match(host.textContent, /Dostępność nie jest skonfigurowana/);
  assert.match(host.textContent, /budżet ręczny/);
});

test('partial, fatal, pilne odroczenie oraz nieznane kody mają krótkie bezpieczne komunikaty', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  app.api.Store.set('dayRecords', app.window.JSON.parse(JSON.stringify({ [PLAN_DATE]: { date: PLAN_DATE, energyScore: 20 } })));
  replaceBuiltInSources(app, [
    moduleSource('synthetic-good', [task({ id: 'hard-urgent', title: 'Pilne i trudne', planningClass: 'urgent', difficulty: 5 })]),
    moduleSource('synthetic-broken', () => null)
  ]);

  const partial = renderAtControlledNow(app);
  const host = app.document.getElementById('today-tasks');
  assert.equal(partial.partial, true);
  assert.match(host.textContent, /Plan jest częściowy/);
  assert.match(host.textContent, /źródeł zadań jest chwilowo niedostępne/);
  assert.match(host.textContent, /Pilne i trudne/);
  assert.match(host.textContent, /zbyt niskiej energii/);

  app.api.Store.set('ui:timeBudget', 'synthetic-invalid');
  const fatal = renderAtControlledNow(app);
  assert.equal(fatal.code, 'INVALID_BUDGET');
  assert.match(app.document.getElementById('today-tasks').textContent, /Wybrany budżet czasu jest niepoprawny/);

  app.api.renderTodayPlanResult({ ok: false, code: '<img src=x>', warnings: [{ code: '<svg onload=x>' }] }, host);
  assert.match(host.textContent, /Nie udało się bezpiecznie przygotować planu dnia/);
  assert.match(host.textContent, /dodatkowe ostrzeżenie/);
  assert.equal(host.querySelector('img,svg,script'), null);
});

test('Task, domena, powód, warning i kontekst dnia są renderowane wyłącznie jako tekst', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  const payloads = {
    title: '<img id="task-xss" src=x onerror=alert(1)>',
    module: '<svg id="module-xss" onload=alert(1)>',
    why: '<script id="why-xss">alert(1)</script>',
    context: '<img id="context-xss" src=x onerror=alert(1)>'
  };
  replaceBuiltInSources(app, [{
    ...moduleSource('synthetic-xss', [task({ title: payloads.title, why: payloads.why })]),
    name: payloads.module,
    getDayContext: () => ({ message: payloads.context })
  }]);

  renderAtControlledNow(app);
  const view = app.document.getElementById('view-dzis');
  for (const value of Object.values(payloads)) assert.equal(view.textContent.includes(value), true);
  assert.equal(view.querySelector('#task-xss,#module-xss,#why-xss,#context-xss'), null);
  assert.equal(view.querySelector('script,svg'), null);

  const host = app.document.getElementById('today-tasks');
  app.api.renderTodayPlanResult({
    ok: true,
    partial: false,
    date: PLAN_DATE,
    mode: 'unscheduled',
    budget: { source: '<img>', manualBudgetMinutes: 30, remainingAvailableMinutes: null, effectiveBudgetMinutes: 30 },
    totals: { plannedMinutes: 0, unusedEffectiveMinutes: 30, uncommittedAvailabilityMinutes: null },
    selected: [], completedToday: [], excluded: [],
    deferred: [task({ moduleId: 'synthetic-xss', moduleName: payloads.module, taskId: 'deferred', reason: '<img id="reason-xss">' })],
    warnings: [{ code: '<img id="warning-xss">' }]
  }, host);
  assert.match(host.textContent, /bezpiecznie ukrytego powodu/);
  assert.equal(host.querySelector('img,svg,script'), null);
  assert.equal(JSON.stringify(app.errors.console), '[]');
});

test('ukończenie i cofnięcie delegują dokładnie raz do właściciela bez bezpośredniego zapisu UI', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let status = 'todo';
  let completedDate = null;
  const calls = [];
  const owner = {
    ...moduleSource('synthetic\u0000owner', () => [task({ id: '\u0000owned', title: 'Delegowane', status, completedDate })]),
    setTaskStatus(taskId, nextStatus) {
      calls.push({ taskId, status: nextStatus });
      if (status === nextStatus) return;
      status = nextStatus;
      completedDate = nextStatus === 'done' ? PLAN_DATE : null;
      app.api.EventBus.emit('task:status', { moduleId: this.id, taskId, status: nextStatus });
    }
  };
  replaceBuiltInSources(app, [owner]);
  renderAtControlledNow(app);
  const originalSet = app.api.Store.set;
  let directWrites = 0;
  app.api.Store.set = (...args) => { directWrites++; return originalSet(...args); };

  const completeButton = app.document.querySelector('.today-plan-selected [data-action="complete"]');
  completeButton.click();
  assert.deepEqual(calls, [{ taskId: '\u0000owned', status: 'done' }]);
  assert.equal(status, 'done');
  assert.match(app.document.querySelector('.today-plan-completed').textContent, /Delegowane/);

  app.document.querySelector('.today-plan-completed [data-action="undo"]').click();
  assert.deepEqual(calls, [
    { taskId: '\u0000owned', status: 'done' },
    { taskId: '\u0000owned', status: 'todo' }
  ]);
  assert.equal(status, 'todo');
  assert.equal(directWrites, 0);
  app.api.Store.set = originalSet;
});

test('anulowanie, no-op i błąd właściciela nie zostawiają fałszywie ukończonej kontrolki ani nie ponawiają wywołania', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let mode = 'cancel';
  const calls = [];
  const owner = {
    ...moduleSource('synthetic-noop', [task({ id: 'noop-task' })]),
    setTaskStatus(taskId, status) {
      calls.push({ mode, status, taskId });
      if (mode === 'error') throw new Error('SYNTHETIC_PRIVATE_ERROR');
      return { ok: true, changed: false, cancelled: mode === 'cancel' };
    }
  };
  replaceBuiltInSources(app, [owner]);

  for (const nextMode of ['cancel', 'noop', 'error']) {
    mode = nextMode;
    renderAtControlledNow(app);
    const completeButton = app.document.querySelector('[data-action="complete"]');
    completeButton.click();
    assert.equal(completeButton.isConnected, true);
    assert.equal(app.document.querySelectorAll('[data-action="complete"]').length, 1);
    assert.equal(app.document.querySelector('.today-plan-action-message').textContent.includes('SYNTHETIC_PRIVATE_ERROR'), false);
  }
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.mode), ['cancel', 'noop', 'error']);
});

test('sam render planu nie zapisuje, nie emituje zdarzeń i nie zmienia statusów', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let statusCalls = 0;
  replaceBuiltInSources(app, [{
    ...moduleSource('synthetic-pure-render', [task()]),
    setTaskStatus() { statusCalls++; }
  }]);
  let writes = 0;
  let events = 0;
  const originalSet = app.api.Store.set;
  const originalEmit = app.api.EventBus.emit;
  app.api.Store.set = () => { writes++; };
  app.api.EventBus.emit = () => { events++; };

  assert.equal(renderAtControlledNow(app).ok, true);
  assert.equal(writes, 0);
  assert.equal(events, 0);
  assert.equal(statusCalls, 0);
  app.api.Store.set = originalSet;
  app.api.EventBus.emit = originalEmit;
  assert.deepEqual(app.resourceControl.blocked, []);
});

test('uzgodnione zdarzenia odświeżają plan dokładnie raz, a import zachowuje komunikat sukcesu', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let reads = 0;
  replaceBuiltInSources(app, [moduleSource('synthetic-refresh', date => {
    reads++;
    return [task({ id: `refresh-${date}` })];
  })]);
  const expectOneRender = action => {
    reads = 0;
    action();
    assert.equal(reads, 1);
  };

  expectOneRender(() => app.document.querySelector('.time-btn[data-key="short"]').click());
  expectOneRender(() => app.api.DayEngine.checkIn(8, 4));
  expectOneRender(() => app.api.EventBus.emit('task:status', { moduleId: 'synthetic-refresh', taskId: 'x', status: 'done' }));
  expectOneRender(() => app.api.EventBus.emit('tasks:changed', { moduleId: 'synthetic-refresh', change: 'updated' }));
  expectOneRender(() => app.api.EventBus.emit('availability:changed', { change: 'weekly-schedule' }));

  reads = 0;
  app.api.Store.set('habitDefs', app.window.JSON.parse(JSON.stringify([])));
  assert.equal(reads, 0, 'store:change nie odświeża planu');
  for (const eventName of ['school:itemAdded', 'training:log', 'english:activityChanged', 'roadmap:stageComplete', 'it:private']) {
    app.api.EventBus.emit(eventName, {});
  }
  assert.equal(reads, 0, 'prywatne zdarzenia domenowe nie odświeżają planu');

  const panel = app.document.getElementById('backup-import-panel');
  panel.textContent = '✅ Import zakończony sukcesem. Synthetic marker.';
  expectOneRender(() => app.api.EventBus.emit('backup:importCompleted', { appDataVersion: 7 }));
  assert.match(panel.textContent, /Import zakończony sukcesem\. Synthetic marker/);
});

test('warstwy domenowe nie wywołują już bezpośrednio renderTodayTasks obok zdarzeń', async () => {
  const sources = await Promise.all([readTrainingSource(), readLearningSource(), readSchoolSource(), readEnglishSource()]);
  sources.forEach(source => assert.equal(/renderTodayTasks\s*\(\s*\)/.test(source), false));
});

test('timer lokalnej północy odświeża raz, ustawia się ponownie i nie prowadzi sekundowego pollingu', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T21:59:30.000Z' });
  t.after(() => app.close());
  let reads = 0;
  replaceBuiltInSources(app, [moduleSource('synthetic-midnight', () => { reads++; return []; })]);

  assert.equal(app.api.TodayPlanLifecycle.getState().timerScheduled, true);
  assert.equal(app.timerControl.pending().length, 1);
  assert.equal(app.timerControl.pending()[0].delay, 30000);
  assert.equal(app.timerControl.calls.some(call => call.delay <= 1000), false);

  reads = 0;
  app.clockControl.setNow('2026-08-20T22:00:00.000Z');
  assert.equal(app.timerControl.runNext(), true);
  assert.equal(reads, 1);
  assert.equal(app.api.TodayPlanLifecycle.getState().lastRenderedDate, '2026-08-21');
  assert.equal(app.timerControl.pending().length, 1);
  assert.equal(app.timerControl.calls.at(-1).delay, 86400000);

  app.api.TodayPlanLifecycle.stop();
  assert.equal(app.timerControl.pending().length, 0);
  assert.equal(app.api.TodayPlanLifecycle.getState().started, false);
});

test('visibilitychange renderuje tylko po powrocie do widocznej karty z inną lokalną datą', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let visibility = 'visible';
  Object.defineProperty(app.document, 'visibilityState', { configurable: true, get: () => visibility });
  let reads = 0;
  replaceBuiltInSources(app, [moduleSource('synthetic-foreground', () => { reads++; return []; })]);

  reads = 0;
  app.clockControl.setNow('2026-08-20T18:00:00.000Z');
  app.document.dispatchEvent(new app.window.Event('visibilitychange'));
  assert.equal(reads, 0, 'ten sam dzień nie odświeża');

  visibility = 'hidden';
  app.clockControl.setNow('2026-08-20T22:01:00.000Z');
  app.document.dispatchEvent(new app.window.Event('visibilitychange'));
  assert.equal(reads, 0, 'ukryta karta nie odświeża');

  visibility = 'visible';
  app.document.dispatchEvent(new app.window.Event('visibilitychange'));
  assert.equal(reads, 1, 'nowy lokalny dzień odświeża dokładnie raz');
  assert.equal(app.api.TodayPlanLifecycle.getState().lastRenderedDate, '2026-08-21');
  assert.equal(app.timerControl.pending().length, 1, 'timer został bezpiecznie przełożony');
});

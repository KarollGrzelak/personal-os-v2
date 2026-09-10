import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApp, readStylesSource, readTodaySource } from './helpers/load-app.mjs';

const PLAN_DATE = '2026-08-20';
const PLAN_NOW = '2026-08-20T08:00:00.000Z';

function task(overrides = {}) {
  return {
    id: 'product-task',
    title: 'Zbuduj widok produktu',
    status: 'todo',
    priority: 40,
    estimatedMinutes: 20,
    difficulty: 2,
    planningClass: 'flexible',
    why: 'Zamknij jeden konkretny krok.',
    xp: 10,
    completedDate: null,
    dueDate: null,
    ...overrides
  };
}

function source(app, id, tasksOrFactory = [], overrides = {}) {
  const getTasks = typeof tasksOrFactory === 'function' ? tasksOrFactory : () => tasksOrFactory;
  return {
    id,
    name: overrides.name || ({ english: 'Angielski', it: 'Nauka IT', school: 'Szkoła', training: 'Trening' }[id] || `Obszar ${id}`),
    getTasks(date) {
      const result = getTasks(date);
      return Array.isArray(result) ? app.window.JSON.parse(JSON.stringify(result)) : result;
    },
    getStats: () => ({ done: 0, total: 0, label: id }),
    render: () => {},
    ...overrides
  };
}

function replaceSources(app, replacements = []) {
  for (const id of ['training', 'it', 'school', 'english']) app.api.ModuleRegistry.register(source(app, id));
  replacements.forEach(replacement => app.api.ModuleRegistry.register(replacement));
}

function availability(app, intervals = [{ start: '10:00', end: '13:00' }]) {
  return app.window.JSON.parse(JSON.stringify({
    weeklySchedule: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      intervals: weekday === 4 ? intervals : []
    })),
    exceptions: []
  }));
}

function setEnergy(app, score, extra = {}) {
  app.api.Store.set('dayRecords', app.window.JSON.parse(JSON.stringify({
    [PLAN_DATE]: { date: PLAN_DATE, energyScore: score, sleepHours: 8, sleepQuality: 4, ...extra }
  })));
}

function render(app) {
  return app.api.renderTodayTasks(new app.window.Date(PLAN_NOW));
}

test('produktowa hierarchia Dziś ma kolejność alerty → check-in → Teraz → Dalej → budżet → nawyki → ukończone → szczegóły', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  app.api.Store.set('availability:configuration', availability(app), { strict: true });
  setEnergy(app, 80);
  replaceSources(app, [source(app, 'it', [
    task({ id: 'now', title: 'Najważniejsze teraz', priority: 10, planningClass: 'urgent', estimatedMinutes: 25 }),
    task({ id: 'next', title: 'Następne w kolejności', estimatedMinutes: 20 }),
    task({ id: 'later', title: 'Odłożone na później', estimatedMinutes: 90 }),
    task({ id: 'done', title: 'Już ukończone', status: 'done', completedDate: PLAN_DATE }),
    task({ id: 'skipped', title: 'Poza planem', status: 'skipped' })
  ])]);

  const plan = render(app);
  const layout = app.document.getElementById('today-tasks');
  const children = [...layout.children];
  assert.deepEqual(children.map(element => {
    if (element.id === 'today-action-alerts') return 'alerts';
    if (element.id === 'today-checkin') return 'checkin';
    if (element.classList.contains('today-now-card')) return 'now';
    if (element.classList.contains('today-next-card')) return 'next';
    if (element.id === 'today-budget') return 'budget';
    if (element.classList.contains('today-habits-card')) return 'habits';
    if (element.classList.contains('today-plan-completed')) return 'completed';
    if (element.classList.contains('today-plan-details')) return 'details';
    return 'message';
  }), ['alerts', 'checkin', 'now', 'next', 'budget', 'habits', 'completed', 'details', 'message']);

  assert.equal(plan.mode, 'scheduled');
  assert.equal(layout.querySelector('.today-now-card .today-plan-task-title').textContent, 'Najważniejsze teraz');
  assert.match(layout.querySelector('.today-now-card').textContent, /Nauka IT.*25 min.*10:00–10:25/s);
  assert.match(layout.querySelector('.today-now-card').textContent, /pilne i ma pierwszeństwo/i);
  assert.equal(layout.querySelectorAll('.today-now-card [data-action="complete"]').length, 1);
  assert.equal(layout.querySelectorAll('.today-now-card [data-action="open-details"]').length, 1);
  assert.deepEqual([...layout.querySelectorAll('.today-next-card .today-plan-task-title')].map(node => node.textContent), ['Następne w kolejności']);
  assert.deepEqual([...layout.querySelectorAll('.time-btn')].map(button => [button.textContent, button.getAttribute('aria-pressed')]), [
    ['30 min', 'false'], ['60 min', 'true'], ['150 min', 'false']
  ]);
  assert.match(layout.querySelector('.today-budget-summary').textContent, /Zaplanowano 45 z 60 min/);
  assert.equal(layout.querySelector('.today-plan-details').open, false);
  assert.match(layout.querySelector('.today-plan-details').textContent, /Odłożone na później.*Poza planem.*Metryki planu/s);
  assert.equal(app.document.getElementById('app-view-context').textContent, 'Następne: Najważniejsze teraz');
});

test('pierwszy stan i brak check-inu prowadzą do istniejących kontrolek bez ukrywania planu', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  replaceSources(app, [source(app, 'it', [task({ title: 'Plan działa bez check-inu' })])]);
  render(app);

  const layout = app.document.getElementById('today-tasks');
  assert.match(layout.querySelector('.today-start-guide').textContent, /Uzupełnij check-in.*Wybierz budżet.*Skonfiguruj dostępność/s);
  assert.match(layout.querySelector('.today-now-card').textContent, /Plan działa bez check-inu/);
  assert.ok(layout.querySelector('#sleep-hours'));
  assert.equal(layout.querySelectorAll('.qbtn').length, 5);
  assert.deepEqual([...layout.querySelectorAll('.qbtn')].map(button => button.getAttribute('aria-pressed')), ['false', 'false', 'false', 'false', 'false']);

  layout.querySelector('[data-today-focus="today-checkin"]').click();
  assert.equal(app.document.activeElement, layout.querySelector('#sleep-hours'));
  layout.querySelector('[data-today-focus="today-budget"]').click();
  assert.equal(app.document.activeElement, layout.querySelector('.time-btn'));
});

test('brak Availability pozostaje uczciwym trybem unscheduled bez fikcyjnych godzin, materiałów i żądań', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let reads = 0;
  replaceSources(app, [source(app, 'it', date => {
    reads += 1;
    return [task({ id: date, title: 'Lista bez godziny' })];
  })]);
  const plan = render(app);
  const layout = app.document.getElementById('today-tasks');
  const readsAfterRender = reads;
  const urlBefore = app.window.location.href;
  app.storageControl.reset();

  assert.equal(plan.mode, 'unscheduled');
  assert.equal(layout.querySelectorAll('.today-plan-slot').length, 0);
  assert.match(layout.textContent, /bez przypisanych godzin/);
  assert.equal(layout.querySelector('a[href]'), null, 'Today nie tworzy fikcyjnych linków ani materiałów');
  layout.querySelector('[data-today-route="settings"]').click();
  assert.equal(app.api.Router.current(), 'settings');
  assert.equal(reads, readsAfterRender);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.equal(app.window.location.href, urlBefore);
  assert.deepEqual(app.resourceControl.blocked, []);
});

test('partial i fatal pokazują bezpieczne alerty, działającą część planu oraz właściwe akcje naprawcze', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  replaceSources(app, [
    source(app, 'it', [task({ title: 'Działająca część planu' })]),
    source(app, 'school', () => { throw new Error('PRIVATE_STACK_AND_DATA'); })
  ]);
  const partial = render(app);
  assert.equal(partial.partial, true);
  assert.equal(app.document.getElementById('app-view-context').textContent, 'Plan częściowy');
  assert.match(app.document.querySelector('.today-plan-partial').textContent, /Możesz wykonać widoczną część planu/);
  assert.match(app.document.querySelector('.today-now-card').textContent, /Działająca część planu/);
  assert.equal(app.document.getElementById('today-tasks').textContent.includes('PRIVATE_STACK_AND_DATA'), false);

  app.api.Store.set('ui:timeBudget', 'invalid-product-budget');
  const fatal = render(app);
  const fatalLayout = app.document.getElementById('today-tasks');
  assert.equal(fatal.ok, false);
  assert.equal(app.document.getElementById('app-view-context').textContent, 'Plan wymaga uwagi');
  assert.match(fatalLayout.querySelector('.today-plan-fatal').textContent, /Wybrany budżet czasu jest niepoprawny/);
  assert.ok(fatalLayout.querySelector('[data-today-retry]'));
  fatalLayout.querySelector('[data-today-focus="today-budget"]').click();
  assert.equal(app.document.activeElement, fatalLayout.querySelector('.time-btn'));
  assert.equal(JSON.stringify(app.errors.console), '[]');
});

test('fatal zachowuje poprawny check-in, a uszkodzone dayRecords daje neutralny stan bez efektów ubocznych', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  setEnergy(app, 82);
  app.api.Store.set('ui:timeBudget', 'invalid-product-budget');

  const fatal = render(app);
  assert.equal(fatal.code, 'INVALID_BUDGET');
  assert.match(app.document.querySelector('.today-plan-fatal').textContent, /Wybrany budżet czasu jest niepoprawny/);
  assert.match(app.document.querySelector('.today-energy-summary').textContent, /82.*Sen: 8 h.*jakość 4\/5/s);

  app.api.Store.set('dayRecords', null);
  app.storageControl.reset();
  let emitted = 0;
  const originalEmit = app.api.EventBus.emit;
  app.api.EventBus.emit = () => { emitted += 1; };
  assert.doesNotThrow(() => render(app));
  app.api.EventBus.emit = originalEmit;

  assert.match(app.document.querySelector('.today-plan-fatal').textContent, /Wybrany budżet czasu jest niepoprawny/);
  assert.match(app.document.querySelector('.today-checkin-neutral').textContent, /Nie można bezpiecznie odczytać/);
  assert.equal(app.api.Store.get('dayRecords', 'fallback'), null);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.equal(emitted, 0);
});

test('Zmień check-in usuwa tylko pola snu i energii, zachowując obciążenie oraz przyszłe dane jednym zapisem i renderem', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  const futureField = { version: 9, nested: ['synthetic', 42] };
  app.api.Store.set('dayRecords', app.window.JSON.parse(JSON.stringify({
    [PLAN_DATE]: {
      date: PLAN_DATE,
      sleepHours: 7.5,
      sleepQuality: 4,
      energyScore: 79,
      trainingLoad: 63,
      futureField
    }
  })));
  let reads = 0;
  replaceSources(app, [source(app, 'it', () => {
    reads += 1;
    return [task({ id: 'edit-checkin-render' })];
  })]);
  render(app);
  const readsBeforeEdit = reads;
  const storeEvents = [];
  let checkInEvents = 0;
  const unsubscribeStore = app.api.EventBus.on('store:change', payload => storeEvents.push(payload.key));
  const unsubscribeCheckIn = app.api.EventBus.on('day:checkin', () => { checkInEvents += 1; });
  app.storageControl.reset();

  app.document.getElementById('edit-checkin').click();
  unsubscribeStore();
  unsubscribeCheckIn();

  const saved = JSON.parse(JSON.stringify(app.api.Store.get('dayRecords', {})))[PLAN_DATE];
  assert.deepEqual(saved, { date: PLAN_DATE, trainingLoad: 63, futureField });
  assert.equal(Object.hasOwn(saved, 'sleepHours'), false);
  assert.equal(Object.hasOwn(saved, 'sleepQuality'), false);
  assert.equal(Object.hasOwn(saved, 'energyScore'), false);
  assert.equal(app.storageControl.attempts.length, 1);
  assert.equal(app.storageControl.attempts[0].key, 'v2:dayRecords');
  assert.deepEqual(storeEvents, ['dayRecords']);
  assert.equal(checkInEvents, 0);
  assert.equal(reads, readsBeforeEdit + 1);
  assert.equal(app.document.activeElement, app.document.getElementById('sleep-hours'));
});

test('niska energia jest wyjaśniona bez obwiniania, a trudne pilne zadanie pozostaje w szczegółach', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  setEnergy(app, 20);
  replaceSources(app, [source(app, 'school', [task({
    id: 'hard-urgent',
    title: 'Trudne pilne zadanie',
    planningClass: 'urgent',
    priority: 10,
    difficulty: 5
  })])]);

  const plan = render(app);
  const layout = app.document.getElementById('today-tasks');
  assert.equal(plan.energy.state, 'low');
  assert.equal(plan.selected.length, 0);
  assert.match(layout.querySelector('.today-low-energy').textContent, /dopasowania tempa, nie ocena/i);
  assert.match(layout.querySelector('.today-plan-deferred').textContent, /Trudne pilne zadanie.*zbyt niskiej energii/s);
  assert.equal(app.document.getElementById('app-view-context').textContent, 'Plan wymaga uwagi');
});

test('brak zadań jest spokojnym pustym stanem, a wszystko ukończone jednoznacznym sukcesem', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  replaceSources(app);
  render(app);
  assert.match(app.document.querySelector('.today-now-card').textContent, /Brak otwartych zadań na dziś/);
  assert.equal(app.document.getElementById('app-view-context').textContent, 'Brak otwartych zadań na dziś');
  assert.doesNotMatch(app.document.querySelector('.today-now-card').textContent, /awaria|błąd/i);

  replaceSources(app, [source(app, 'it', [task({ id: 'done', title: 'Zamknięty krok', status: 'done', completedDate: PLAN_DATE })])]);
  render(app);
  assert.match(app.document.querySelector('.today-all-done').textContent, /Wszystko na dziś zrobione/);
  assert.match(app.document.querySelector('.today-plan-completed').textContent, /Zamknięty krok/);
  assert.equal(app.document.getElementById('app-view-context').textContent, 'Wszystko na dziś zrobione');
});

test('Otwórz szczegóły używa tylko bezpiecznego moduleId i Routera bez odczytu Task, planowania, zapisu ani URL', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let reads = 0;
  replaceSources(app, [source(app, 'it', () => {
    reads += 1;
    return [task({ id: 'owned', title: 'Otwierane szczegóły' })];
  })]);
  app.document.getElementById('view-it').remove();
  render(app);
  const readsAfterRender = reads;
  const urlBefore = app.window.location.href;
  const requestsBefore = [...app.resourceControl.requests];
  app.storageControl.reset();

  app.document.querySelector('[data-action="open-details"]').click();
  await Promise.resolve();
  assert.equal(app.api.Router.current(), 'it');
  assert.equal(app.document.getElementById('app-view-title').textContent, 'Nauka IT');
  assert.equal(app.document.activeElement, app.document.getElementById('app-view-title'));
  assert.equal(reads, readsAfterRender);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.equal(app.window.location.href, urlBefore);
  assert.deepEqual(app.resourceControl.requests, requestsBefore);

  replaceSources(app, [source(app, 'synthetic-without-view', [task({ id: 'hidden' })])]);
  app.api.Router.go('dzis');
  render(app);
  assert.equal(app.document.querySelector('[data-action="open-details"]'), null);
});

test('długie i niezaufane treści pozostają tekstem, a długa lista zachowuje akcje i progresywne ujawnianie', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  const dangerousTitle = '<img id="today-product-xss" src=x onerror=alert(1)> ' + 'bardzo-długi-tekst-'.repeat(10);
  const dangerousWhy = '<script id="today-product-script">alert(1)</script> ' + 'cel '.repeat(40);
  const manyTasks = Array.from({ length: 25 }, (_, index) => task({
    id: `long-${index}`,
    title: index === 0 ? dangerousTitle : `Kolejne zadanie ${index} ` + 'bez-przerwy-'.repeat(8),
    why: index === 0 ? dangerousWhy : 'Bezpieczny cel',
    estimatedMinutes: 1
  }));
  let reads = 0;
  replaceSources(app, [source(app, 'it', () => {
    reads += 1;
    return manyTasks;
  }, { name: '<svg id="today-domain-xss" onload=alert(1)>' })]);
  render(app);
  const layout = app.document.getElementById('today-tasks');
  const next = layout.querySelector('.today-next-card');
  const more = next.querySelector('.today-next-more');

  assert.equal(layout.textContent.includes(dangerousTitle), true);
  assert.equal(layout.textContent.includes(dangerousWhy), true);
  assert.equal(layout.querySelector('#today-product-xss,#today-product-script,#today-domain-xss,script,svg,img'), null);
  assert.equal(next.querySelectorAll(':scope > .today-plan-task').length, 4);
  assert.equal(next.querySelectorAll(':scope > .today-plan-task [data-action="complete"]').length, 4);
  assert.equal(more.open, false);
  assert.match(more.querySelector('summary').textContent, /20/);
  const readsBeforeOpen = reads;
  app.storageControl.reset();
  more.querySelector('summary').click();
  assert.equal(more.open, true);
  assert.equal(layout.querySelectorAll('.today-plan-selected [data-action="complete"]').length, 25);
  assert.deepEqual([
    layout.querySelector('.today-now-card .today-plan-task-title').textContent,
    ...layout.querySelectorAll('.today-next-card .today-plan-task-title')
  ].map(node => typeof node === 'string' ? node : node.textContent), manyTasks.map(item => item.title));
  assert.equal(reads, readsBeforeOpen);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.equal(layout.querySelector('.today-plan-details').open, false);
  assert.equal(JSON.stringify(app.errors.console), '[]');

  const css = await readStylesSource();
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /@media\s*\(max-width:420px\)/);
});

test('budżet, disclosure i status mają pełne kontrolki klawiaturowe oraz zachowują sensowny fokus', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  let status = 'todo';
  let completedDate = null;
  const calls = [];
  const owner = source(app, 'it', () => [task({ id: 'focus-task', status, completedDate })], {
    setTaskStatus(taskId, nextStatus) {
      calls.push({ taskId, status: nextStatus });
      status = nextStatus;
      completedDate = nextStatus === 'done' ? PLAN_DATE : null;
      app.api.EventBus.emit('task:status', { moduleId: 'it', taskId, status: nextStatus });
      return { ok: true, changed: true };
    }
  });
  replaceSources(app, [owner]);
  render(app);

  const shortBudget = app.document.querySelector('.time-btn[data-key="short"]');
  shortBudget.focus();
  shortBudget.click();
  const activeShort = app.document.querySelector('.time-btn[data-key="short"]');
  assert.equal(activeShort.getAttribute('aria-pressed'), 'true');
  assert.equal(app.document.activeElement, activeShort);

  const disclosure = app.document.querySelector('.today-plan-details');
  const summary = disclosure.querySelector('summary');
  summary.focus();
  summary.click();
  assert.equal(disclosure.open, true);
  assert.equal(app.document.activeElement, summary);

  app.document.querySelector('[data-action="complete"]').click();
  assert.deepEqual(calls, [{ taskId: 'focus-task', status: 'done' }]);
  assert.equal(app.document.activeElement, app.document.querySelector('[data-action="undo"]'));
  assert.equal(app.document.querySelector('[data-action="undo"]').tagName, 'BUTTON');

  const css = await readStylesSource();
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:44px/);
});

test('fokus po cofnięciu trafia do szczegółów, gdy zadanie wraca jako deferred bez przycisku complete', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  app.api.Store.set('ui:timeBudget', 'short');
  let status = 'done';
  let completedDate = PLAN_DATE;
  const calls = [];
  replaceSources(app, [source(app, 'it', () => [task({
    id: 'deferred-after-undo',
    title: 'Za duże po cofnięciu',
    status,
    completedDate,
    estimatedMinutes: 45
  })], {
    setTaskStatus(taskId, nextStatus) {
      calls.push({ taskId, status: nextStatus });
      status = nextStatus;
      completedDate = nextStatus === 'done' ? PLAN_DATE : null;
      app.api.EventBus.emit('task:status', { moduleId: 'it', taskId, status: nextStatus });
      return { ok: true, changed: true };
    }
  })]);
  render(app);

  app.document.querySelector('[data-action="undo"]').click();

  assert.deepEqual(calls, [{ taskId: 'deferred-after-undo', status: 'todo' }]);
  assert.match(app.document.querySelector('.today-plan-deferred').textContent, /Za duże po cofnięciu/);
  assert.equal(app.document.querySelector('[data-action="complete"]'), null);
  assert.equal(app.document.activeElement, app.document.querySelector('.today-plan-details > summary'));
  assert.notEqual(app.document.activeElement, app.document.body);
});

test('pełny render Dziś ma jeden przebieg źródeł, zero zapisów i zdarzeń oraz zachowuje sukces importu', async t => {
  const app = await loadApp({ fixedNow: PLAN_NOW });
  t.after(() => app.close());
  const reads = new Map();
  replaceSources(app, ['training', 'it', 'school', 'english'].map(id => source(app, id, () => {
    reads.set(id, (reads.get(id) || 0) + 1);
    return id === 'it' ? [task()] : [];
  })));
  let emitted = 0;
  const originalEmit = app.api.EventBus.emit;
  app.api.EventBus.emit = () => { emitted += 1; };
  app.storageControl.reset();

  render(app);
  assert.deepEqual([...reads.values()], [1, 1, 1, 1]);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.equal(emitted, 0);
  app.api.EventBus.emit = originalEmit;

  const todaySource = await readTodaySource();
  assert.equal((todaySource.match(/PlanDayEngine\.getPlanForToday/g) || []).length, 1);

  const panel = app.document.getElementById('backup-import-panel');
  panel.textContent = 'Import zakończony sukcesem. Marker produktu.';
  reads.clear();
  app.api.EventBus.emit('backup:importCompleted', { appDataVersion: 7 });
  assert.deepEqual([...reads.values()], [1, 1, 1, 1]);
  assert.match(panel.textContent, /Import zakończony sukcesem\. Marker produktu/);
});

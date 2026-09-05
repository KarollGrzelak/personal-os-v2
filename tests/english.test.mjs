import assert from 'node:assert/strict';
import test from 'node:test';
import { englishActivity, englishProfile } from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function inWindow(app, value) {
  return app.window.JSON.parse(JSON.stringify(value));
}

function setEnglishState(app, profile, activities) {
  app.api.Store.set('english:profile', inWindow(app, profile));
  app.api.Store.set('english:activities', inWindow(app, activities));
}

test('profil English jest ścisły, normalizowany osobno i respektuje wszystkie granice', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const api = app.api;

  assert.equal(api.validateEnglishProfileValue(null).valid, true);
  for (const level of ['unknown', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    assert.equal(api.validateEnglishProfile(inWindow(app, englishProfile({ selfAssessedLevel: level }))).valid, true, level);
  }
  for (const focus of ['technical', 'balanced', 'general']) {
    assert.equal(api.validateEnglishProfile(inWindow(app, englishProfile({ focus }))).valid, true, focus);
  }
  assert.equal(api.validateEnglishProfile(inWindow(app, englishProfile({ weeklyMinutes: 15 }))).valid, true);
  assert.equal(api.validateEnglishProfile(inWindow(app, englishProfile({ weeklyMinutes: 840 }))).valid, true);
  for (const weeklyMinutes of [14, 841, 15.5, '120']) {
    assert.equal(api.validateEnglishProfile(inWindow(app, englishProfile({ weeklyMinutes }))).valid, false, String(weeklyMinutes));
  }
  for (const missingField of ['enabled', 'selfAssessedLevel', 'weeklyMinutes', 'focus']) {
    const missingProfile = englishProfile();
    delete missingProfile[missingField];
    assert.equal(api.validateEnglishProfile(inWindow(app, missingProfile)).valid, false, missingField);
  }
  assert.equal(api.validateEnglishProfile(inWindow(app, { ...englishProfile(), extra: true })).valid, false);
  assert.equal(api.validateEnglishProfile(inWindow(app, englishProfile({ enabled: 'true' }))).valid, false);

  assert.deepEqual(toPlain(api.normalizeEnglishProfile(inWindow(app, {
    enabled: true,
    selfAssessedLevel: ' B1 ',
    weeklyMinutes: ' 90 ',
    focus: ' technical '
  }))), englishProfile({ selfAssessedLevel: 'B1', weeklyMinutes: 90, focus: 'technical' }));
  for (const selfAssessedLevel of ['', '   ']) {
    assert.equal(api.normalizeEnglishProfile(inWindow(app, {
      enabled: true,
      selfAssessedLevel,
      weeklyMinutes: '90',
      focus: 'technical'
    })).selfAssessedLevel, 'unknown');
  }

  const malformedWeekly = api.normalizeEnglishProfile(inWindow(app, {
    enabled: true,
    selfAssessedLevel: '',
    weeklyMinutes: '60abc',
    focus: 'technical'
  }));
  assert.equal(Number.isNaN(malformedWeekly.weeklyMinutes), true);
  assert.equal(api.EnglishModule.saveProfile(inWindow(app, {
    enabled: true,
    selfAssessedLevel: '',
    weeklyMinutes: '60abc',
    focus: 'technical'
  })).ok, false);
  assert.equal(api.EnglishModule.getProfile(), null);

  const profileLevel = app.document.getElementById('english-profile-level');
  assert.equal(profileLevel.value, 'unknown');
  assert.equal(app.document.getElementById('english-profile-weekly').value, '');
  assert.equal(app.document.getElementById('english-profile-focus').value, '');
});

test('aktywność English ma ścisły model, wszystkie typy, bezpieczne URL i inwariant current', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const api = app.api;
  const types = ['technical-reading', 'general-reading', 'vocabulary', 'listening', 'writing', 'speaking'];

  for (const type of types) {
    assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ type }))).valid, true, type);
  }
  for (const estimatedMinutes of [4, 61, 5.5, '20']) {
    assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ estimatedMinutes }))).valid, false, String(estimatedMinutes));
  }
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ estimatedMinutes: 5 }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ estimatedMinutes: 60 }))).valid, true);
  for (const difficulty of [0, 6, 1.5, '2']) {
    assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ difficulty }))).valid, false, String(difficulty));
  }
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ difficulty: 1 }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ difficulty: 5 }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ id: '' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ id: 'i'.repeat(128) }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ id: 'i'.repeat(129) }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ title: '' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ title: '   ' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ objective: '' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ objective: '   ' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ title: 'x', objective: 'y' }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ title: 'x'.repeat(120) }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ title: 'x'.repeat(121) }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ objective: 'x'.repeat(500) }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ objective: 'x'.repeat(501) }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, { ...englishActivity(), unexpected: true })).valid, false);

  for (const resourceUrl of [null, 'http://example.test/a', 'https://example.test/a']) {
    assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ resourceUrl }))).valid, true, String(resourceUrl));
  }
  for (const resourceUrl of ['/relative', 'javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', ' https://example.test/a ']) {
    assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ resourceUrl }))).valid, false, resourceUrl);
  }
  const resourcePrefix = 'https://example.test/';
  const resourceAtLimit = resourcePrefix + 'a'.repeat(2048 - resourcePrefix.length);
  assert.equal(resourceAtLimit.length, 2048);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ resourceUrl: resourceAtLimit }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ resourceUrl: resourceAtLimit + 'a' }))).valid, false);
  assert.equal(api.normalizeEnglishActivityContent(inWindow(app, englishActivity({ resourceUrl: '   ' }))).resourceUrl, null);
  assert.equal(api.normalizeEnglishActivityContent(inWindow(app, englishActivity({ resourceUrl: ' https://example.test/a ' }))).resourceUrl, 'https://example.test/a');

  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ status: 'done', completedDate: '2026-08-20' }))).valid, true);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ status: 'done', completedDate: null }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ status: 'todo', completedDate: '2026-08-20' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ status: 'done', completedDate: '2026-02-30' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ status: 'skipped', completedDate: '2026-08-20' }))).valid, false);
  assert.equal(api.validateEnglishActivity(inWindow(app, englishActivity({ status: 'done', completedDate: '2026-08-20', current: true }))).valid, false);

  const duplicate = englishActivity();
  assert.equal(api.validateEnglishActivities(inWindow(app, [duplicate, duplicate])).valid, false);
  assert.equal(api.validateEnglishActivities(inWindow(app, [
    englishActivity({ id: 'a', current: true }),
    englishActivity({ id: 'b', current: true })
  ])).valid, false);
});

test('profil i treść aktywności zapisują się tylko po rzeczywistej poprawnej zmianie', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  const storeEvents = [];
  const profileEvents = [];
  const activityEvents = [];
  app.api.EventBus.on('store:change', event => storeEvents.push(toPlain(event)));
  app.api.EventBus.on('english:profileChanged', event => profileEvents.push(toPlain(event)));
  app.api.EventBus.on('english:activityChanged', event => activityEvents.push(toPlain(event)));

  const saved = module.saveProfile(inWindow(app, englishProfile()));
  assert.equal(saved.ok, true);
  assert.equal(saved.changed, true);
  assert.deepEqual(toPlain(module.getProfile()), englishProfile());
  assert.deepEqual(profileEvents, [{ action: 'saved', enabled: true }]);

  const englishMarker = app.document.createElement('span');
  const todayMarker = app.document.createElement('span');
  app.document.getElementById('view-english').appendChild(englishMarker);
  app.document.getElementById('today-tasks').appendChild(todayMarker);
  const countsBeforeIdempotent = [storeEvents.length, profileEvents.length];
  assert.deepEqual(toPlain(module.saveProfile(inWindow(app, englishProfile()))).changed, false);
  assert.deepEqual([storeEvents.length, profileEvents.length], countsBeforeIdempotent);
  assert.equal(englishMarker.isConnected, true);
  assert.equal(todayMarker.isConnected, true);
  assert.equal(module.setEnabled('false').ok, false);
  assert.deepEqual([storeEvents.length, profileEvents.length], countsBeforeIdempotent);
  assert.equal(englishMarker.isConnected, true);
  assert.equal(todayMarker.isConnected, true);

  assert.equal(module.setEnabled(false).changed, true);
  assert.equal(englishMarker.isConnected, false);
  assert.equal(todayMarker.isConnected, false);
  assert.equal(module.setEnabled(false).changed, false);
  assert.equal(module.setEnabled(true).changed, true);
  assert.equal(module.getProfile().enabled, true);

  const created = module.createActivity(inWindow(app, {
    type: 'writing',
    title: '  Synthetic writing  ',
    objective: '  Write one short technical summary  ',
    resourceUrl: '   ',
    estimatedMinutes: '15',
    difficulty: '3'
  }));
  assert.equal(created.ok, true);
  assert.match(created.activity.id, /^eng-[a-z0-9]+-0\.[a-z0-9]+$/);
  assert.deepEqual(toPlain(created.activity), englishActivity({
    id: created.activity.id,
    type: 'writing',
    title: 'Synthetic writing',
    objective: 'Write one short technical summary',
    resourceUrl: null,
    estimatedMinutes: 15,
    difficulty: 3
  }));

  const edited = module.editActivity(created.activity.id, inWindow(app, {
    type: 'listening',
    title: 'Synthetic listening',
    objective: 'Listen for key technical terms',
    resourceUrl: ' https://example.test/listening ',
    estimatedMinutes: '20',
    difficulty: '2',
    status: 'done',
    current: true
  }));
  assert.equal(edited.ok, true);
  assert.equal(edited.activity.status, 'todo');
  assert.equal(edited.activity.current, false);
  assert.equal(edited.activity.completedDate, null);
  assert.equal(activityEvents.length, 2);
  assert.equal(activityEvents.every(event => !('title' in event) && !('objective' in event)), true);
});

test('wyczerpanie 100 prób kolizji ID nie zapisuje, nie emituje zdarzeń i nie renderuje ponownie', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T08:00:00.000Z' });
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  app.window.Math.random = () => 0.25;
  const collidingId = `eng-${app.window.Date.now().toString(36)}-${app.window.Math.random().toString(36)}`;
  setEnglishState(app, englishProfile(), [englishActivity({ id: collidingId })]);

  const storeEvents = [];
  const activityEvents = [];
  const taskEvents = [];
  app.api.EventBus.on('store:change', event => storeEvents.push(toPlain(event)));
  app.api.EventBus.on('english:activityChanged', event => activityEvents.push(toPlain(event)));
  app.api.EventBus.on('task:status', event => taskEvents.push(toPlain(event)));
  const englishMarker = app.document.createElement('span');
  const todayMarker = app.document.createElement('span');
  app.document.getElementById('view-english').appendChild(englishMarker);
  app.document.getElementById('today-tasks').appendChild(todayMarker);

  const result = module.createActivity(inWindow(app, englishActivity({ id: 'ignored-content-id' })));

  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.match(result.errors.join(' '), /unikalnego ID/);
  assert.deepEqual(toPlain(module.getActivities()), [englishActivity({ id: collidingId })]);
  assert.deepEqual(storeEvents, []);
  assert.deepEqual(activityEvents, []);
  assert.deepEqual(taskEvents, []);
  assert.equal(englishMarker.isConnected, true);
  assert.equal(todayMarker.isConnected, true);
});

test('maszyna stanów Q/C/D/S, zmiana current i cofanie zachowują wszystkie inwarianty', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T22:30:00.000Z' });
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  setEnglishState(app, englishProfile(), [
    englishActivity({ id: 'q-one', resourceUrl: null }),
    englishActivity({ id: 'q-two', resourceUrl: null })
  ]);
  const activityEvents = [];
  const taskEvents = [];
  app.api.EventBus.on('english:activityChanged', event => activityEvents.push(toPlain(event)));
  app.api.EventBus.on('task:status', event => taskEvents.push(toPlain(event)));

  assert.equal(module.setCurrentActivity('q-one').changed, true);
  assert.equal(module.setCurrentActivity('q-one').changed, false);
  assert.equal(activityEvents.length, 1);
  assert.equal(module.setCurrentActivity('q-two').changed, true);
  let activities = toPlain(module.getActivities());
  assert.equal(activities.find(item => item.id === 'q-one').current, false);
  assert.equal(activities.find(item => item.id === 'q-two').current, true);

  const done = module.setTaskStatus('q-two', 'done');
  assert.equal(done.changed, true);
  assert.equal(done.activity.current, false);
  assert.equal(done.activity.completedDate, '2026-08-21', 'data pochodzi z lokalnej strefy Europe/Warsaw');
  assert.equal(module.setTaskStatus('q-two', 'skipped').ok, false);
  assert.equal(module.setTaskStatus('q-two', 'done').changed, false);

  const restoredDone = module.setTaskStatus('q-two', 'todo');
  assert.equal(restoredDone.activity.current, true);
  assert.equal(restoredDone.activity.completedDate, null);
  assert.equal(module.setTaskStatus('q-one', 'skipped').changed, true);
  const restoredSkipped = module.setTaskStatus('q-one', 'todo');
  assert.equal(restoredSkipped.activity.current, false);
  assert.equal(module.setTaskStatus('q-one', 'synthetic').ok, false);
  assert.equal(module.setTaskStatus('missing', 'done').ok, false);

  assert.equal(module.setEnabled(false).changed, true);
  assert.equal(module.getActivities().find(item => item.id === 'q-two').current, true);
  assert.equal(module.setEnabled(true).changed, true);
  assert.equal(module.getActivities().find(item => item.id === 'q-two').current, true);
  assert.equal(taskEvents.length, 4);
});

test('cofanie done respektuje istniejące current i stan profilu, a usunięcie nie promuje kolejki', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T08:00:00.000Z' });
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  const doneActivity = englishActivity({ id: 'done-to-restore', status: 'done', completedDate: '2026-08-20' });

  setEnglishState(app, englishProfile(), [
    doneActivity,
    englishActivity({ id: 'other-current', current: true })
  ]);
  const restoredBesideCurrent = module.setTaskStatus('done-to-restore', 'todo');
  assert.equal(restoredBesideCurrent.changed, true);
  assert.equal(restoredBesideCurrent.activity.status, 'todo');
  assert.equal(restoredBesideCurrent.activity.completedDate, null);
  assert.equal(restoredBesideCurrent.activity.current, false);

  for (const profile of [englishProfile({ enabled: false }), null, { synthetic: 'invalid-profile' }]) {
    setEnglishState(app, profile, [doneActivity]);
    const restoredWithoutEnabledProfile = module.setTaskStatus('done-to-restore', 'todo');
    assert.equal(restoredWithoutEnabledProfile.changed, true);
    assert.equal(restoredWithoutEnabledProfile.activity.status, 'todo');
    assert.equal(restoredWithoutEnabledProfile.activity.completedDate, null);
    assert.equal(restoredWithoutEnabledProfile.activity.current, false);
  }

  setEnglishState(app, englishProfile(), [
    englishActivity({ id: 'delete-current', current: true }),
    englishActivity({ id: 'stay-queued-one' }),
    englishActivity({ id: 'stay-queued-two' })
  ]);
  app.dialogs.enqueueConfirm(true);
  const removed = module.deleteActivity('delete-current');
  assert.equal(removed.changed, true);
  assert.deepEqual(toPlain(module.getActivities().map(activity => ({ id: activity.id, current: activity.current }))), [
    { id: 'stay-queued-one', current: false },
    { id: 'stay-queued-two', current: false }
  ]);
});

test('błędy, no-opy i anulowanie nie zapisują, nie emitują i nie renderują ponownie', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  setEnglishState(app, englishProfile(), [
    englishActivity({ id: 'already-current', current: true }),
    englishActivity({ id: 'already-skipped', status: 'skipped' })
  ]);
  const storeEvents = [];
  const activityEvents = [];
  const taskEvents = [];
  const poolEvents = [];
  app.api.EventBus.on('store:change', event => storeEvents.push(toPlain(event)));
  app.api.EventBus.on('english:activityChanged', event => activityEvents.push(toPlain(event)));
  app.api.EventBus.on('task:status', event => taskEvents.push(toPlain(event)));
  app.api.EventBus.on('tasks:changed', event => poolEvents.push(toPlain(event)));
  const englishMarker = app.document.createElement('span');
  const todayMarker = app.document.createElement('span');
  app.document.getElementById('view-english').appendChild(englishMarker);
  app.document.getElementById('today-tasks').appendChild(todayMarker);

  assert.equal(module.setCurrentActivity('already-current').changed, false);
  assert.equal(module.setTaskStatus('already-current', 'todo').changed, false);
  assert.equal(module.setTaskStatus('already-skipped', 'done').ok, false);
  assert.deepEqual(toPlain(module.deleteActivity('already-current')), { ok: true, changed: false, cancelled: true });

  assert.deepEqual(storeEvents, []);
  assert.deepEqual(activityEvents, []);
  assert.deepEqual(taskEvents, []);
  assert.deepEqual(poolEvents, []);
  assert.equal(englishMarker.isConnected, true);
  assert.equal(todayMarker.isConnected, true);
  assert.equal(app.dialogs.confirms.length, 1);
});

test('przycisk cofnij w widoku Dziś deleguje done-today do EnglishModule', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T08:00:00.000Z' });
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  setEnglishState(app, englishProfile(), [englishActivity({ id: 'today-undo', current: true })]);
  assert.equal(module.setTaskStatus('today-undo', 'done').changed, true);

  const calls = [];
  const originalSetTaskStatus = module.setTaskStatus.bind(module);
  module.setTaskStatus = (activityId, status) => {
    calls.push({ activityId, status });
    return originalSetTaskStatus(activityId, status);
  };
  const undoButton = app.document.querySelector('#today-tasks [data-module="english"][data-task="today-undo"][data-action="undo"]');
  assert.ok(undoButton);

  undoButton.click();

  assert.deepEqual(calls, [{ activityId: 'today-undo', status: 'todo' }]);
  assert.deepEqual(toPlain(module.getActivities()[0]), englishActivity({ id: 'today-undo', current: true }));
  assert.equal(app.document.querySelector('#today-tasks [data-module="english"][data-task="today-undo"][data-action="undo"]'), null);
});

test('niepoprawny kontener blokuje każdą mutację aktywności bez zapisu, zdarzeń i potwierdzenia', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  const invalid = inWindow(app, { synthetic: 'do not overwrite' });
  app.api.Store.set('english:activities', invalid);
  const storeEvents = [];
  const activityEvents = [];
  const taskEvents = [];
  app.api.EventBus.on('store:change', event => storeEvents.push(toPlain(event)));
  app.api.EventBus.on('english:activityChanged', event => activityEvents.push(toPlain(event)));
  app.api.EventBus.on('task:status', event => taskEvents.push(toPlain(event)));

  const content = inWindow(app, englishActivity());
  for (const result of [
    module.createActivity(content),
    module.editActivity('synthetic', content),
    module.setCurrentActivity('synthetic'),
    module.setTaskStatus('synthetic', 'done'),
    module.deleteActivity('synthetic')
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
  }
  assert.deepEqual(toPlain(module.getActivities()), { synthetic: 'do not overwrite' });
  assert.deepEqual(storeEvents, []);
  assert.deepEqual(activityEvents, []);
  assert.deepEqual(taskEvents, []);
  assert.deepEqual(app.dialogs.confirms, []);
});

test('getTasks wystawia jedno current i done-today także przy wyłączonym lub błędnym profilu', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T08:00:00.000Z' });
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  const activities = [
    englishActivity({ id: 'current', current: true }),
    englishActivity({ id: 'queued' }),
    englishActivity({ id: 'done-today', status: 'done', completedDate: '2026-08-20' }),
    englishActivity({ id: 'done-old', status: 'done', completedDate: '2026-08-19' }),
    englishActivity({ id: 'skipped', status: 'skipped' })
  ];
  setEnglishState(app, englishProfile(), activities);

  assert.deepEqual(toPlain(module.getTasks('2026-08-20').map(task => task.id)), ['current', 'done-today']);
  assert.deepEqual(toPlain(module.getTasks('2026-08-19').map(task => task.id)), ['current', 'done-old']);
  const task = toPlain(module.getTasks('2026-08-20')[0]);
  assert.deepEqual(task, {
    id: 'current',
    moduleId: 'english',
    goalId: 'english',
    title: activities[0].title,
    why: activities[0].objective,
    estimatedMinutes: 20,
    difficulty: 2,
    xp: 15,
    priority: 39,
    planningClass: 'flexible',
    status: 'todo',
    completedDate: null,
    extra: { englishActivityType: 'technical-reading' }
  });
  assert.deepEqual(toPlain(app.api.validateTaskV2(module.getTasks('2026-08-20')[0])), { valid: true, errors: [] });
  assert.deepEqual(toPlain(module.getStats()), { done: 2, total: 5, label: 'Angielski' });

  for (const profile of [englishProfile({ enabled: false }), null, { synthetic: 'invalid' }]) {
    app.api.Store.set('english:profile', inWindow(app, profile));
    assert.deepEqual(toPlain(module.getTasks('2026-08-20').map(item => item.id)), ['done-today']);
  }
  app.api.Store.set('english:activities', inWindow(app, { synthetic: 'invalid' }));
  assert.deepEqual(toPlain(module.getTasks('2026-08-20')), []);
  assert.deepEqual(toPlain(module.getStats()), { done: 0, total: 0, label: 'Angielski' });
});

test('całkowity priorytet English 39 współdziała deterministycznie z budżetami i filtrem niskiej energii', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T08:00:00.000Z' });
  t.after(() => app.close());
  const english = { id: 'english', priority: 39, estimatedMinutes: 20 };
  const itTasks = [
    { id: 'it-40', priority: 40, estimatedMinutes: 40 },
    { id: 'it-30-a', priority: 40, estimatedMinutes: 30 },
    { id: 'it-30-b', priority: 40, estimatedMinutes: 30 },
    { id: 'it-45', priority: 40, estimatedMinutes: 45 }
  ];
  const training = { id: 'training', priority: 30, estimatedMinutes: 45 };
  const urgentSchool = { id: 'school-urgent', priority: 25, estimatedMinutes: 30 };
  const calmHomework = { id: 'school-calm-homework', priority: 42, estimatedMinutes: 30 };
  const scenarios = [
    {
      name: 'IT + English',
      tasks: [english, ...itTasks],
      expected: {
        30: { picks: ['english'], deferred: ['it-40', 'it-30-a', 'it-30-b', 'it-45'] },
        60: { picks: ['english', 'it-40'], deferred: ['it-30-a', 'it-30-b', 'it-45'] },
        150: { picks: ['english', 'it-40', 'it-30-a', 'it-30-b'], deferred: ['it-45'] }
      }
    },
    {
      name: 'Training + IT + English',
      tasks: [training, english, ...itTasks],
      expected: {
        30: { picks: ['english'], deferred: ['training', 'it-40', 'it-30-a', 'it-30-b', 'it-45'] },
        60: { picks: ['training'], deferred: ['english', 'it-40', 'it-30-a', 'it-30-b', 'it-45'] },
        150: { picks: ['training', 'english', 'it-40', 'it-30-a'], deferred: ['it-30-b', 'it-45'] }
      }
    },
    {
      name: 'pilna School + IT + English',
      tasks: [urgentSchool, english, ...itTasks],
      expected: {
        30: { picks: ['school-urgent'], deferred: ['english', 'it-40', 'it-30-a', 'it-30-b', 'it-45'] },
        60: { picks: ['school-urgent', 'english'], deferred: ['it-40', 'it-30-a', 'it-30-b', 'it-45'] },
        150: { picks: ['school-urgent', 'english', 'it-40', 'it-30-a', 'it-30-b'], deferred: ['it-45'] }
      }
    },
    {
      name: 'pełna pula',
      tasks: [urgentSchool, training, english, ...itTasks, calmHomework],
      expected: {
        30: { picks: ['school-urgent'], deferred: ['training', 'english', 'it-40', 'it-30-a', 'it-30-b', 'it-45', 'school-calm-homework'] },
        60: { picks: ['school-urgent', 'english'], deferred: ['training', 'it-40', 'it-30-a', 'it-30-b', 'it-45', 'school-calm-homework'] },
        150: { picks: ['school-urgent', 'training', 'english', 'it-40'], deferred: ['it-30-a', 'it-30-b', 'it-45', 'school-calm-homework'] }
      }
    }
  ];
  for (const scenario of scenarios) {
    for (const budget of [30, 60, 150]) {
      const result = app.api.PriorityEngine.pickWithinBudget(inWindow(app, scenario.tasks), budget);
      assert.deepEqual(toPlain(result.picks.map(task => task.id)), scenario.expected[budget].picks, `${scenario.name}, ${budget} min — picks`);
      assert.deepEqual(toPlain(result.deferredByTime.map(task => task.id)), scenario.expected[budget].deferred, `${scenario.name}, ${budget} min — deferred`);
    }
  }

  const energyTasks = [1, 2, 3, 4, 5].map(difficulty => ({
    id: `energy-${difficulty}`,
    title: `Synthetic difficulty ${difficulty}`,
    why: 'Synthetic energy matrix',
    estimatedMinutes: 10,
    difficulty,
    xp: 0,
    priority: 1,
    status: 'todo',
    completedDate: null
  }));
  app.api.ModuleRegistry.register({
    id: 'synthetic-energy-matrix',
    name: 'Synthetic energy matrix',
    getTasks: date => energyTasks,
    getStats: () => ({ done: 0, total: energyTasks.length, label: 'Synthetic energy matrix' }),
    render: () => {}
  });
  app.api.Store.set('dayRecords', inWindow(app, {
    '2026-08-20': { date: '2026-08-20', energyScore: 40 }
  }));
  const plan = app.api.DecisionEngine.planToday(1000, '2026-08-20');
  assert.deepEqual(toPlain(plan.picks.filter(task => task.id.startsWith('energy-')).map(task => task.id)), [
    'energy-1', 'energy-2', 'energy-3'
  ]);
  assert.deepEqual(toPlain(plan.deferred.filter(task => task.id.startsWith('energy-')).map(task => task.id)), [
    'energy-4', 'energy-5'
  ]);
  assert.equal(plan.reasonCounts.energy >= 2, true);
});

test('English emituje pełne mapowanie minimalnego tasks:changed bez duplikatu dla statusu', async t => {
  const app = await loadApp({ fixedNow: '2026-08-20T08:00:00.000Z' });
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  const poolEvents = [];
  const statusEvents = [];
  app.api.EventBus.on('tasks:changed', payload => poolEvents.push(toPlain(payload)));
  app.api.EventBus.on('task:status', payload => statusEvents.push(toPlain(payload)));

  assert.equal(module.saveProfile(inWindow(app, { ...englishProfile(), weeklyMinutes: 14 })).ok, false);
  assert.equal(module.saveProfile(inWindow(app, englishProfile())).changed, true);
  assert.equal(module.saveProfile(inWindow(app, englishProfile())).changed, false);
  assert.equal(module.saveProfile(inWindow(app, englishProfile({ weeklyMinutes: 121 }))).changed, true);
  assert.equal(module.setEnabled(false).changed, true);
  assert.equal(module.setEnabled(false).changed, false);
  assert.equal(module.setEnabled(true).changed, true);

  const created = module.createActivity(inWindow(app, englishActivity({ id: 'ignored' })));
  assert.equal(created.changed, true);
  const content = {
    type: created.activity.type,
    title: created.activity.title,
    objective: created.activity.objective,
    resourceUrl: created.activity.resourceUrl,
    estimatedMinutes: created.activity.estimatedMinutes,
    difficulty: created.activity.difficulty
  };
  assert.equal(module.editActivity(created.activity.id, inWindow(app, content)).changed, false);
  assert.equal(module.editActivity(created.activity.id, inWindow(app, { ...content, title: 'Changed synthetic title' })).changed, true);
  assert.equal(module.setCurrentActivity(created.activity.id).changed, true);
  assert.equal(module.setCurrentActivity(created.activity.id).changed, false);
  assert.equal(module.setTaskStatus(created.activity.id, 'done').changed, true);
  assert.equal(module.setTaskStatus(created.activity.id, 'done').changed, false);
  app.dialogs.enqueueConfirm(false);
  assert.equal(module.deleteActivity(created.activity.id).cancelled, true);
  app.dialogs.enqueueConfirm(true);
  assert.equal(module.deleteActivity(created.activity.id).changed, true);

  assert.deepEqual(poolEvents, [
    { moduleId: 'english', change: 'configuration' },
    { moduleId: 'english', change: 'configuration' },
    { moduleId: 'english', change: 'configuration' },
    { moduleId: 'english', change: 'created' },
    { moduleId: 'english', change: 'updated' },
    { moduleId: 'english', change: 'selection' },
    { moduleId: 'english', change: 'deleted' }
  ]);
  assert.equal(poolEvents.every(payload => Object.keys(payload).sort().join(',') === 'change,moduleId'), true);
  assert.deepEqual(statusEvents, [{ moduleId: 'english', taskId: created.activity.id, status: 'done' }]);
});

test('UI escapuje treść, ponownie waliduje link, nie uruchamia sieci i usuwa dopiero po potwierdzeniu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const module = app.api.EnglishModule;
  const xss = '<img id="english-xss" src=x onerror="globalThis.englishExecuted=true">';
  setEnglishState(app, englishProfile(), [englishActivity({
    id: 'safe-render',
    title: xss,
    objective: '<script>globalThis.englishExecuted=true</script>',
    resourceUrl: 'https://example.test/synthetic-english'
  })]);
  const beforeRequests = [...app.resourceControl.requests];
  const container = app.document.getElementById('view-english');
  module.render(container);

  assert.equal(app.window.englishExecuted, undefined);
  assert.equal(container.querySelector('script, img, [onerror]'), null);
  assert.match(container.textContent, /<img id="english-xss"/);
  const link = container.querySelector('a[href="https://example.test/synthetic-english"]');
  assert.ok(link);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.deepEqual(app.resourceControl.requests, beforeRequests);
  assert.doesNotMatch(app.api.renderEnglishResource(inWindow(app, { resourceUrl: 'javascript:alert(1)' })), /href=/);

  const storeEvents = [];
  app.api.EventBus.on('store:change', event => storeEvents.push(toPlain(event)));
  const cancelled = module.deleteActivity('safe-render');
  assert.deepEqual(toPlain(cancelled), { ok: true, changed: false, cancelled: true });
  assert.equal(module.getActivities().length, 1);
  assert.deepEqual(storeEvents, []);
  assert.equal(app.dialogs.confirms.length, 1);

  app.dialogs.enqueueConfirm(true);
  const removed = module.deleteActivity('safe-render');
  assert.equal(removed.changed, true);
  assert.deepEqual(toPlain(module.getActivities()), []);
  assert.equal(storeEvents.length, 1);
});

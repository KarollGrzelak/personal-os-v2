import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_MONDAY, trainingProfile } from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function training(api) {
  return api.ModuleRegistry.get('training');
}

test('TrainingModule odrzuca błędny profil i zapisuje poprawny profil syntetyczny', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);

  const wrongShape = toPlain(module.saveProfile([]));
  const duplicatedDays = toPlain(module.saveProfile(trainingProfile({ availableDays: [1, 1] })));
  assert.equal(wrongShape.ok, false);
  assert.equal(duplicatedDays.ok, false);
  assert.equal(module.getProfile(), null);

  const profile = trainingProfile();
  assert.deepEqual(toPlain(module.saveProfile(profile)), { ok: true, errors: [] });
  assert.deepEqual(toPlain(module.getProfile()), profile);
});

test('plan domyślny przechodzi w plan generowany z zamiennikami sprzętowymi', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);

  const defaultPlan = toPlain(module.getActivePlan());
  assert.equal(defaultPlan.source, 'default');
  assert.equal(defaultPlan.days.length, 4);

  module.saveProfile(trainingProfile({ equipment: ['mata'] }));
  const generated = toPlain(module.getActivePlan());
  const firstDay = generated.days.find(day => day.id === 'day-a');

  assert.equal(generated.source, 'generated');
  assert.equal(generated.days.length, 3);
  assert.deepEqual(firstDay.weekdays, [1]);
  assert.deepEqual(firstDay.exercises.map(exercise => exercise.id), ['squat-bodyweight', 'pushup', 'plank']);
  assert.equal(firstDay.exercises.every(exercise => exercise.sets === 2), true);
  assert.equal(generated.notes.some(note => /brak hantli/.test(note)), true);
});

test('plan generowany respektuje ograniczenie kolana i sygnalizuje ręczną weryfikację', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  module.saveProfile(trainingProfile({ limitations: 'synthetic ból kolana' }));

  const plan = toPlain(module.getActivePlan());
  const exerciseIds = plan.days.flatMap(day => day.exercises.map(exercise => exercise.id));

  assert.equal(plan.needsManualReview, true);
  for (const excluded of ['squat-goblet', 'bulgarian-split-squat', 'walking-lunge']) {
    assert.equal(exerciseIds.includes(excluded), false);
  }
  assert.equal(plan.notes.some(note => /fizjoterapeutą/.test(note)), true);
});

test('log ćwiczenia jest walidowany, nadpisywany per data i zasila rekord osobisty', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);

  assert.equal(module.upsertExerciseLog('unknown-exercise', '2026-08-17', {}).ok, false);
  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-17', { sets: 0, reps: 10, weight: 10, rpe: 5 }).ok, false);
  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-17', { sets: 3, reps: 10, weight: 501, rpe: 5 }).ok, false);

  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-16', { sets: 3, reps: 10, weight: 10, rpe: 6 }).ok, true);
  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-17', { sets: 3, reps: 10, weight: 11, rpe: 7 }).ok, true);
  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-17', { sets: 4, reps: 12, weight: 12, rpe: 8 }).ok, true);

  const history = toPlain(module.getExerciseHistory('squat-goblet'));
  assert.equal(history.length, 2);
  assert.deepEqual(history[0], {
    date: '2026-08-17', sets: 4, reps: 12, durationSeconds: null, weight: 12, rpe: 8
  });
  assert.deepEqual(toPlain(module.getExercisePR('squat-goblet')), { type: 'weight', value: 12, unit: 'kg' });
});

test('obciążenie treningowe wynika z liczby serii i średniego RPE', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const date = '2026-08-17';

  module.upsertExerciseLog('squat-goblet', date, { sets: 3, reps: 10, weight: 10, rpe: 8 });
  module.upsertExerciseLog('pushup', date, { sets: 2, reps: 8, rpe: 6 });

  assert.equal(module._computeLoadForDate(date), 35);
  assert.equal(app.api.DayEngine.getTrainingLoad(date), 35);
});

test('sesja przechodzi przez planned, in_progress, partial, completed i skipped oraz respektuje cofnięcie', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const date = '2026-08-17';
  const taskId = `day-a:${date}`;
  const observed = [];
  const currentTask = () => toPlain(module.getTasks(date)[0]);

  observed.push(currentTask().sessionStatus);
  assert.equal(currentTask().status, 'todo');

  module.upsertExerciseLog('squat-goblet', date, { sets: 3, reps: 10, weight: 10, rpe: 7 });
  observed.push(currentTask().sessionStatus);

  module.setTaskStatus(taskId, 'done');
  const partial = currentTask();
  observed.push(partial.sessionStatus);
  assert.equal(partial.status, 'todo');
  assert.match(partial.title, /^Dokończ:/);

  module.upsertExerciseLog('pushup', date, { sets: 3, reps: 10, rpe: 7 });
  module.upsertExerciseLog('row-db', date, { sets: 3, reps: 10, weight: 10, rpe: 7 });
  module.upsertExerciseLog('plank', date, { sets: 3, durationSeconds: 30, rpe: 7 });
  const completed = currentTask();
  observed.push(completed.sessionStatus);
  assert.equal(completed.status, 'done');
  assert.equal(completed.completedDate, date);

  module.setTaskStatus(taskId, 'todo');
  assert.equal(currentTask().sessionStatus, 'completed', 'pełne logi ponownie uzgadniają sesję jako completed');

  for (const exerciseId of ['squat-goblet', 'pushup', 'row-db', 'plank']) module.deleteExerciseLog(exerciseId, date);
  assert.equal(currentTask().sessionStatus, 'planned');

  module.setTaskStatus(taskId, 'skipped');
  const skipped = currentTask();
  observed.push(skipped.sessionStatus);
  assert.equal(skipped.status, 'skipped');

  module.setTaskStatus(taskId, 'todo');
  assert.equal(currentTask().sessionStatus, 'planned');
  assert.deepEqual(observed, ['planned', 'in_progress', 'partial', 'completed', 'skipped']);
});

test('Training wyznacza sesję i ID wyłącznie z jawnej daty dla weekday 0–6', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const dates = ['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'];
  const expectedDayIds = [null, 'day-a', 'day-mobility', 'day-b', null, 'day-c', null];

  dates.forEach((date, weekday) => {
    assert.equal(app.api.weekdayFromLocalDate(date), weekday);
    const tasks = toPlain(module.getTasks(date));
    if (expectedDayIds[weekday] === null) {
      assert.deepEqual(tasks, []);
      return;
    }
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, `${expectedDayIds[weekday]}:${date}`);
    assert.equal(tasks[0].priority, 30);
    assert.equal(tasks[0].planningClass, 'scheduled');
    assert.deepEqual(toPlain(app.api.validateTaskV2(module.getTasks(date)[0])), { valid: true, errors: [] });
  });
  assert.equal(module.getTasks('2026-08-19')[0].id.endsWith('2026-08-19'), true, 'wynik nie używa zamrożonego poniedziałku');
});

test('Training emituje minimalne tasks:changed tylko gdy mutacja zmienia projekcję Task', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const taskEvents = [];
  const statusEvents = [];
  app.api.EventBus.on('tasks:changed', payload => taskEvents.push(toPlain(payload)));
  app.api.EventBus.on('task:status', payload => statusEvents.push(toPlain(payload)));

  assert.equal(module.saveProfile([]).ok, false);
  assert.equal(module.saveProfile(trainingProfile()).ok, true);
  assert.equal(module.saveProfile(trainingProfile()).ok, true);
  assert.deepEqual(taskEvents, [{ moduleId: 'training', change: 'configuration' }]);

  taskEvents.length = 0;
  const log = { sets: 3, reps: 10, weight: 10, rpe: 7 };
  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-17', log).ok, true);
  assert.equal(module.upsertExerciseLog('squat-goblet', '2026-08-17', { ...log, weight: 11 }).ok, true);
  module.deleteExerciseLog('squat-goblet', '2026-08-17');
  module.deleteExerciseLog('squat-goblet', '2026-08-17');
  assert.deepEqual(taskEvents, [
    { moduleId: 'training', change: 'updated' },
    { moduleId: 'training', change: 'updated' }
  ]);

  taskEvents.length = 0;
  module.setTaskStatus('day-a:2026-08-17', 'skipped');
  module.setTaskStatus('day-a:2026-08-17', 'skipped');
  module.setTaskStatus('day-a:2026-08-17', 'todo');
  module.setTaskStatus('day-a:2026-08-17', 'todo');
  app.dialogs.enqueueConfirm(false);
  module.setTaskStatus('day-a:2026-08-17', 'done');
  assert.deepEqual(taskEvents, [], 'jawna zmiana statusu nie dubluje wspólnego zdarzenia');
  assert.deepEqual(statusEvents, [
    { moduleId: 'training', taskId: 'day-a:2026-08-17', status: 'skipped' },
    { moduleId: 'training', taskId: 'day-a:2026-08-17', status: 'todo' }
  ]);
});

test('produktowy Trening eksponuje bieżącą sesję i główną akcję przed planem oraz profilem', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const view = app.document.getElementById('view-training');

  module.render(view);

  const current = view.querySelector('.training-current-session');
  const plan = view.querySelector('.training-plan-card');
  const profile = view.querySelector('.training-profile-details');
  assert.ok(current);
  assert.ok(plan);
  assert.ok(profile);
  assert.equal(
    current.compareDocumentPosition(plan) & app.window.Node.DOCUMENT_POSITION_FOLLOWING,
    app.window.Node.DOCUMENT_POSITION_FOLLOWING
  );
  assert.equal(
    plan.compareDocumentPosition(profile) & app.window.Node.DOCUMENT_POSITION_FOLLOWING,
    app.window.Node.DOCUMENT_POSITION_FOLLOWING
  );
  assert.match(current.textContent, /Bieżąca sesja/);
  assert.match(current.textContent, /Full Body A/);
  assert.match(current.textContent, /Rozpocznij — pokaż ćwiczenia/);

  const currentDay = view.querySelector('[data-training-day="day-a"]');
  assert.equal(currentDay.open, false);
  view.querySelector('#training-main-action').click();
  assert.equal(currentDay.open, true);
  assert.equal(app.document.activeElement, currentDay.querySelector(':scope > summary'));
});

test('plan Treningu używa rozwinięć oraz nazw pomiarów i dni zrozumiałych dla użytkownika', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const view = app.document.getElementById('view-training');

  module.render(view);

  const dayPanels = [...view.querySelectorAll('.training-day-panel')];
  const exercisePanels = [...view.querySelectorAll('.exercise-card')];
  assert.equal(dayPanels.length, 4);
  assert.equal(dayPanels.every(panel => panel.tagName === 'DETAILS'), true);
  assert.equal(exercisePanels.length > 0, true);
  assert.equal(exercisePanels.every(panel => panel.tagName === 'DETAILS'), true);
  assert.match(view.textContent, /Poniedziałek/);
  assert.match(view.textContent, /Ciężar i powtórzenia/);
  assert.match(view.textContent, /Powtórzenia z masą ciała/);
  assert.match(view.textContent, /Czas utrzymania/);
  assert.match(view.textContent, /Czas mobilności/);
  assert.doesNotMatch(view.textContent, /weight_reps|bodyweight_reps|\bduration\b|\bmobility\b/);

  const firstExercise = exercisePanels[0];
  assert.match(firstExercise.textContent, /Cel/);
  assert.match(firstExercise.textContent, /Rozgrzewka/);
  assert.match(firstExercise.textContent, /Technika/);
  assert.match(firstExercise.textContent, /Materiał do techniki/);
  assert.match(firstExercise.textContent, /Historia ćwiczenia/);
});

test('formularze profilu i dziennika Treningu mają pełne etykiety, a bezpieczeństwo planu pozostaje widoczne', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const view = app.document.getElementById('view-training');
  module.saveProfile(trainingProfile({ limitations: 'synthetic ból kolana' }));

  module.render(view);

  assert.match(view.querySelector('.training-alerts').textContent, /nie jest poradą medyczną/i);
  assert.match(view.querySelector('.training-alerts').textContent, /fizjoterapeutą/i);
  const controls = [...view.querySelectorAll('#training-profile-form input, #training-profile-form select, #training-profile-form textarea, .log-form input, .log-form select')];
  assert.equal(controls.length > 0, true);
  for (const control of controls) {
    assert.ok(control.id, 'każda kontrolka ma identyfikator');
    const label = view.querySelector(`label[for="${control.id}"]`);
    assert.ok(label, `brak etykiety dla ${control.id}`);
    assert.equal(label.textContent.trim().length > 0, true, `pusta etykieta dla ${control.id}`);
  }
  assert.deepEqual(
    [...view.querySelectorAll('[name="pf-available-day"]')].map(input => input.nextElementSibling.textContent),
    ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']
  );
  assert.doesNotMatch(view.querySelector('#training-profile-panel').textContent, /numery 0-6|1=pon/i);

  view.querySelector('#training-profile-form').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));

  const restoredProfilePanel = view.querySelector('#training-profile-panel');
  assert.equal(restoredProfilePanel.open, true);
  assert.equal(app.document.activeElement, restoredProfilePanel.querySelector(':scope > summary'));
  assert.notEqual(app.document.activeElement, app.document.body);
});

test('dziennik w rozwinięciu zapisuje wynik i wraca do tej samej sesji oraz ćwiczenia', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const view = app.document.getElementById('view-training');
  module.render(view);
  view.querySelector('#training-main-action').click();
  const exercise = view.querySelector('[data-training-day="day-a"] [data-ex="squat-goblet"]');
  exercise.open = true;
  const form = exercise.querySelector('.log-form');
  form.querySelector('.lf-sets').value = '3';
  form.querySelector('.lf-reps').value = '10';
  form.querySelector('.lf-weight').value = '12';
  form.querySelector('.lf-rpe').value = '7';

  form.dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));

  assert.equal(module.getExerciseHistory('squat-goblet').length, 1);
  assert.equal(view.querySelector('[data-training-day="day-a"]').open, true);
  assert.equal(view.querySelector('[data-training-day="day-a"] [data-ex="squat-goblet"]').open, true);
  const history = view.querySelector('[data-ex="squat-goblet"] .training-history');
  assert.equal(history.open, true);
  assert.match(history.textContent, /2026-08-17/);
  assert.equal(app.document.activeElement, history.querySelector(':scope > summary'));
  assert.notEqual(app.document.activeElement, app.document.body);
});

test('finish, skip i undo sesji Treningu przywracają fokus do właściwej nowej akcji', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const view = app.document.getElementById('view-training');
  module.render(view);

  app.dialogs.enqueueConfirm(true);
  view.querySelector('#finish-day').click();

  assert.equal(module.getTasks('2026-08-17')[0].sessionStatus, 'partial');
  assert.equal(app.document.activeElement, view.querySelector('#finish-day'));
  assert.notEqual(app.document.activeElement, app.document.body);

  view.querySelector('#skip-day').click();

  assert.equal(module.getTasks('2026-08-17')[0].sessionStatus, 'skipped');
  assert.equal(app.document.activeElement, view.querySelector('#undo-day'));
  assert.notEqual(app.document.activeElement, app.document.body);

  view.querySelector('#undo-day').click();

  assert.equal(module.getTasks('2026-08-17')[0].sessionStatus, 'planned');
  assert.equal(app.document.activeElement, view.querySelector('#training-main-action'));
  assert.notEqual(app.document.activeElement, app.document.body);
});

test('12 wpisów historii Treningu ujawnia 8 najnowszych i wszystkie starsze bez efektów ubocznych', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = training(app.api);
  const view = app.document.getElementById('view-training');
  for (let day = 1; day <= 12; day++) {
    const date = `2026-08-${String(day).padStart(2, '0')}`;
    assert.equal(module.upsertExerciseLog('squat-goblet', date, {
      sets: 3,
      reps: 10,
      weight: day,
      rpe: 6
    }).ok, true);
  }
  module.render(view);
  const history = view.querySelector('[data-ex="squat-goblet"] .training-history');
  const more = history.querySelector('.training-history-more');
  const stateBefore = {
    logs: toPlain(app.api.Store.get('training:exerciseLogs', {})),
    sessions: toPlain(app.api.Store.get('training:sessions', {})),
    days: toPlain(app.api.Store.get('dayRecords', {}))
  };
  const observedEvents = [];
  ['store:change', 'training:log', 'tasks:changed', 'task:status'].forEach(type => {
    app.api.EventBus.on(type, payload => observedEvents.push({ type, payload: toPlain(payload) }));
  });
  app.storageControl.reset();

  history.querySelector(':scope > summary').click();

  assert.equal(history.open, true);
  assert.equal(history.querySelectorAll(':scope > .training-history-body > .history-row').length, 8);
  assert.equal(more.open, false);
  assert.equal(more.querySelectorAll('.history-row').length, 4);
  const orderBefore = [...history.querySelectorAll('.history-row')].map(row => row.firstElementChild.textContent);

  more.querySelector(':scope > summary').click();

  assert.equal(more.open, true);
  assert.equal(history.querySelectorAll('.history-row').length, 12);
  assert.equal(history.querySelectorAll('.edit-log').length, 12);
  assert.equal(history.querySelectorAll('.del-log').length, 12);
  assert.deepEqual([...history.querySelectorAll('.history-row')].map(row => row.firstElementChild.textContent), orderBefore);
  assert.deepEqual({
    logs: toPlain(app.api.Store.get('training:exerciseLogs', {})),
    sessions: toPlain(app.api.Store.get('training:sessions', {})),
    days: toPlain(app.api.Store.get('dayRecords', {}))
  }, stateBefore);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.deepEqual(observedEvents, []);
});

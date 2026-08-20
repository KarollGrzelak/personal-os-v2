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
  const currentTask = () => toPlain(module.getTasks()[0]);

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

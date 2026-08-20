import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_MONDAY, FIXED_THURSDAY } from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

test('lokalna data Europe/Warsaw przechodzi na kolejny dzień o właściwej granicy', async t => {
  const beforeMidnight = await loadApp({ fixedNow: '2026-08-19T21:59:59.999Z' });
  const afterMidnight = await loadApp({ fixedNow: '2026-08-19T22:00:00.000Z' });
  t.after(() => beforeMidnight.close());
  t.after(() => afterMidnight.close());

  assert.equal(beforeMidnight.api.DayEngine.todayKey(), '2026-08-19');
  assert.equal(afterMidnight.api.DayEngine.todayKey(), '2026-08-20');
});

test('check-in tworzy i aktualizuje rekord dnia z wpływem wczorajszego obciążenia', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const events = [];
  app.api.EventBus.on('day:checkin', record => events.push(toPlain(record)));
  app.api.DayEngine.recordTrainingLoad('2026-08-16', 50);
  app.api.DayEngine.recordTrainingLoad('2026-08-17', 12);

  const record = toPlain(app.api.DayEngine.checkIn(9, 5));

  assert.deepEqual(record, {
    date: '2026-08-17',
    trainingLoad: 12,
    sleepHours: 9,
    sleepQuality: 5,
    energyScore: 90
  });
  assert.deepEqual(toPlain(app.api.DayEngine.getRecord('2026-08-17')), record);
  assert.deepEqual(events, [record]);
  assert.equal(app.api.DayEngine.getTrainingLoad('2026-08-16'), 50);
});

test('DayEngine aktualizuje obciążenie bez utraty istniejących pól rekordu', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  app.api.DayEngine.checkIn(7, 4);

  app.api.DayEngine.recordTrainingLoad('2026-08-17', 33);

  assert.deepEqual(toPlain(app.api.DayEngine.getRecord('2026-08-17')), {
    date: '2026-08-17',
    sleepHours: 7,
    sleepQuality: 4,
    energyScore: 78,
    trainingLoad: 33
  });
});

test('HabitEngine loguje, cofa wpis i izoluje dane między dniami', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const events = [];
  app.api.EventBus.on('habit:change', event => events.push(toPlain(event)));

  app.api.HabitEngine.log('synthetic-habit', '2026-08-19', true);
  app.api.HabitEngine.log('synthetic-habit', '2026-08-20', true);
  assert.equal(app.api.HabitEngine.isDone('synthetic-habit', '2026-08-19'), true);
  assert.equal(app.api.HabitEngine.isDone('synthetic-habit', '2026-08-20'), true);

  app.api.HabitEngine.log('synthetic-habit', '2026-08-20', false);

  assert.equal(app.api.HabitEngine.isDone('synthetic-habit', '2026-08-20'), false);
  assert.equal(app.api.HabitEngine.isDone('synthetic-habit', '2026-08-19'), true);
  assert.equal(app.api.HabitEngine.isDone('another-habit', '2026-08-19'), false);
  assert.equal(events.length, 3);
  assert.deepEqual(events.at(-1), { habitId: 'synthetic-habit', date: '2026-08-20', done: false });
});

test('HabitEngine podtrzymuje streak od wczoraj i rozszerza go po wpisie dzisiejszym', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  app.api.HabitEngine.log('synthetic-streak', '2026-08-18', true);
  app.api.HabitEngine.log('synthetic-streak', '2026-08-19', true);

  assert.equal(app.api.HabitEngine.streak('synthetic-streak'), 2);

  app.api.HabitEngine.log('synthetic-streak', '2026-08-20', true);
  assert.equal(app.api.HabitEngine.streak('synthetic-streak'), 3);

  app.api.HabitEngine.log('synthetic-streak', '2026-08-19', false);
  assert.equal(app.api.HabitEngine.streak('synthetic-streak'), 1);
});

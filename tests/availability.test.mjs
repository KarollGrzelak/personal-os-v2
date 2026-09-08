import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availabilityConfiguration,
  availabilityException,
  availabilityInterval,
  availabilityWeeklySchedule,
  cloneJson
} from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function emptyWeek() {
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday, intervals: [] }));
}

test('walidator czasu obsługuje granice 00:00–24:00 i zabrania północy oraz obcych pól', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const { validateAvailabilityInterval: validate } = app.api;

  for (const interval of [
    { start: '00:00', end: '00:01' },
    { start: '00:00', end: '23:59' },
    { start: '23:59', end: '24:00' },
    { start: '00:00', end: '24:00' }
  ]) assert.equal(validate(interval).valid, true, JSON.stringify(interval));

  for (const interval of [
    { start: '24:00', end: '24:00' },
    { start: '10:00', end: '10:00' },
    { start: '23:00', end: '01:00' },
    { start: '00:00', end: '00:00' },
    { start: '9:00', end: '10:00' },
    { start: '09:60', end: '10:00' },
    { start: '09:00', end: '24:01' },
    { start: null, end: '10:00' },
    { start: '09:00', end: '10:00', extra: true }
  ]) assert.equal(validate(interval).valid, false, JSON.stringify(interval));
  assert.doesNotThrow(() => app.api.AvailabilityEngine.saveWeeklySchedule([{ weekday: 0, intervals: [{ start: null, end: '10:00' }] }]));
});

test('normalizacja kontrolowanego wejścia sortuje, ale walidator Store wymaga już porządku kanonicznego', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const unorderedIntervals = [
    { start: '18:00', end: '19:00' },
    { start: '08:00', end: '09:00' }
  ];
  assert.deepEqual(toPlain(app.api.normalizeAvailabilityIntervals(unorderedIntervals)), [
    { start: '08:00', end: '09:00' },
    { start: '18:00', end: '19:00' }
  ]);

  const configuration = availabilityConfiguration({
    weeklySchedule: availabilityWeeklySchedule({ byWeekday: { 1: unorderedIntervals } }),
    exceptions: [
      availabilityException({ date: '2026-08-21' }),
      availabilityException({ date: '2026-08-20' })
    ]
  });
  assert.equal(app.api.validateAvailabilityConfigurationValue(configuration).valid, false);
  const duplicatedDate = availabilityConfiguration({
    exceptions: [availabilityException(), availabilityException()]
  });
  assert.equal(app.api.validateAvailabilityConfigurationValue(duplicatedDate).valid, false);

  const sortedWeek = app.api.normalizeWeeklySchedule([...configuration.weeklySchedule].reverse());
  assert.deepEqual(toPlain(sortedWeek.map(day => day.weekday)), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(toPlain(sortedWeek[1].intervals), [
    { start: '08:00', end: '09:00' },
    { start: '18:00', end: '19:00' }
  ]);
});

test('tydzień ma dokładnie unikalne dni 0..6; styk jest legalny, nakładanie i duplikat nie', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const touching = emptyWeek();
  touching[1].intervals = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' }
  ];
  assert.equal(app.api.validateWeeklySchedule(touching).valid, true);

  for (const intervals of [
    [{ start: '08:00', end: '10:00' }, { start: '09:59', end: '11:00' }],
    [{ start: '08:00', end: '10:00' }, { start: '08:00', end: '10:00' }]
  ]) {
    const week = emptyWeek();
    week[1].intervals = intervals;
    assert.equal(app.api.validateWeeklySchedule(week).valid, false);
  }

  const duplicate = emptyWeek();
  duplicate[6].weekday = 5;
  assert.equal(app.api.validateWeeklySchedule(duplicate).valid, false);
  assert.equal(app.api.validateWeeklySchedule(emptyWeek().slice(0, 6)).valid, false);
});

test('limity ośmiu przedziałów i 366 wyjątków mają jednoznaczne wyniki', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const eight = emptyWeek();
  eight[0].intervals = Array.from({ length: 8 }, (_, index) => ({
    start: `0${index}:00`, end: `0${index}:30`
  }));
  assert.equal(app.api.AvailabilityEngine.saveWeeklySchedule(eight).ok, true);

  const nine = emptyWeek();
  nine[0].intervals = Array.from({ length: 9 }, (_, index) => ({
    start: `0${index}:00`, end: `0${index}:30`
  }));
  assert.equal(app.api.AvailabilityEngine.saveWeeklySchedule(nine).code, 'LIMIT_EXCEEDED');

  const exceptions = Array.from({ length: 366 }, (_, index) => {
    const date = new Date(2026, 0, index + 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, kind: 'unavailable', intervals: [] };
  });
  app.api.Store.set('availability:configuration', { weeklySchedule: emptyWeek(), exceptions }, { strict: true });
  assert.equal(app.api.AvailabilityEngine.saveException(availabilityException({ date: '2027-01-02' })).code, 'LIMIT_EXCEEDED');
  assert.equal(app.api.AvailabilityEngine.saveException(exceptions[0]).changed, false, 'edycja istniejącej daty nie przekracza limitu');
});

test('wyjątki unavailable/custom są ścisłe, unikalne i całkowicie zastępują dzień tygodniowy', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const week = emptyWeek();
  week[4].intervals = [{ start: '08:00', end: '12:00' }];
  assert.equal(app.api.AvailabilityEngine.saveWeeklySchedule(week).changed, true);

  assert.equal(app.api.AvailabilityEngine.saveException({ date: '2026-08-20', kind: 'unavailable', intervals: [] }).changed, true);
  assert.deepEqual(toPlain(app.api.AvailabilityEngine.getAvailabilityForDate('2026-08-20')), {
    ok: true, configured: true, date: '2026-08-20', weekday: 4,
    source: 'exception', status: 'unavailable', intervals: [], availableMinutes: 0
  });

  assert.equal(app.api.AvailabilityEngine.saveException({
    date: '2026-08-20', kind: 'custom', intervals: [{ start: '18:00', end: '19:15' }]
  }).changed, true);
  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-20').availableMinutes, 75);
  assert.equal(app.api.AvailabilityEngine.getAvailabilityForDate('2026-08-27').availableMinutes, 240);
  assert.equal(app.api.AvailabilityEngine.saveException(availabilityException({ date: '2025-01-01' })).changed, true);
  assert.deepEqual(toPlain(app.api.AvailabilityEngine.getExceptions().exceptions.map(item => item.date)), ['2025-01-01', '2026-08-20']);
  assert.equal(app.api.AvailabilityEngine.deleteException('2026-08-20').changed, true);
  assert.equal(app.api.AvailabilityEngine.getAvailabilityForDate('2026-08-20').source, 'weekly');
  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-20').availableMinutes, 240);

  for (const invalid of [
    { date: '2026-02-29', kind: 'unavailable', intervals: [] },
    { date: '2026-08-21', kind: 'unavailable', intervals: [availabilityInterval()] },
    { date: '2026-08-21', kind: 'custom', intervals: [] },
    { date: '2026-08-21', kind: 'custom', intervals: [availabilityInterval()], extra: true }
  ]) assert.equal(app.api.validateAvailabilityException(invalid).valid, false);
});

test('brak konfiguracji jest odróżniony od świadomie pustego harmonogramu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  assert.deepEqual(toPlain(app.api.AvailabilityEngine.getConfiguration()), {
    ok: true, configured: false, configuration: null
  });
  assert.deepEqual(toPlain(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-20')), {
    ok: true, configured: false, date: '2026-08-20', availableMinutes: null
  });
  assert.equal(app.api.AvailabilityEngine.getExceptions().configured, false);
  assert.equal(app.api.AvailabilityEngine.saveException(availabilityException()).code, 'NOT_CONFIGURED');
  assert.equal(app.api.AvailabilityEngine.deleteException('2026-08-20').code, 'NOT_CONFIGURED');
  assert.equal(app.api.AvailabilityEngine.clearConfiguration().changed, false);

  assert.equal(app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek()).changed, true);
  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-20').availableMinutes, 0);
  assert.equal(app.api.AvailabilityEngine.getConfiguration().configured, true);
});

test('mutacje emitują store:change przed minimalnym availability:changed, a błędy i no-opy niczego nie emitują', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const events = [];
  const storeCalls = [];
  const originalStoreSet = app.api.Store.set;
  app.api.Store.set = (key, value, options) => {
    storeCalls.push({ key, options: toPlain(options) });
    return originalStoreSet(key, value, options);
  };
  app.api.EventBus.on('store:change', payload => {
    if (payload.key === 'availability:configuration') events.push(['store:change', Object.keys(payload).sort()]);
  });
  app.api.EventBus.on('availability:changed', payload => events.push(['availability:changed', toPlain(payload)]));

  const first = app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek());
  assert.equal(first.changed, true);
  assert.deepEqual(events, [
    ['store:change', ['key', 'value']],
    ['availability:changed', { change: 'weekly-schedule' }]
  ]);
  assert.deepEqual(storeCalls, [{ key: 'availability:configuration', options: { strict: true } }]);
  assert.equal(app.storageControl.attempts.filter(attempt => attempt.key === 'v2:availability:configuration').length, 1);

  events.length = 0;
  const writesBeforeNoOps = app.storageControl.attempts.length;
  assert.equal(app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek()).changed, false);
  assert.equal(app.api.AvailabilityEngine.deleteException('2026-08-20').changed, false);
  assert.equal(app.api.AvailabilityEngine.saveException({ date: 'broken', kind: 'unavailable', intervals: [] }).code, 'INVALID_INPUT');
  assert.deepEqual(events, []);
  assert.equal(app.storageControl.attempts.length, writesBeforeNoOps);
  assert.equal(storeCalls.length, 1);
});

test('wyjątki i clear emitują dokładne payloady, po jednym ścisłym zapisie, a no-opy i błędy pozostają bez efektów', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek());

  const storeCalls = [];
  const events = [];
  const originalStoreSet = app.api.Store.set;
  app.api.Store.set = (key, value, options) => {
    storeCalls.push({ key, options: toPlain(options) });
    return originalStoreSet(key, value, options);
  };
  app.api.EventBus.on('store:change', payload => {
    if (payload.key === 'availability:configuration') events.push({ event: 'store:change', payload: toPlain(payload) });
  });
  app.api.EventBus.on('availability:changed', payload => events.push({ event: 'availability:changed', payload: toPlain(payload) }));

  function resetObservations() {
    storeCalls.length = 0;
    events.length = 0;
  }

  function assertChanged(action, change) {
    resetObservations();
    const result = action();
    assert.equal(result.ok, true, change);
    assert.equal(result.changed, true, change);
    assert.deepEqual(storeCalls, [{ key: 'availability:configuration', options: { strict: true } }], change);
    assert.equal(events.length, 2, change);
    assert.equal(events[0].event, 'store:change', change);
    assert.deepEqual(events[0].payload, {
      key: 'availability:configuration',
      value: toPlain(result.configuration)
    }, change);
    assert.deepEqual(events[1], {
      event: 'availability:changed',
      payload: { change }
    }, change);
    return result;
  }

  function assertNoEffect(action, expectedCode) {
    resetObservations();
    const result = action();
    assert.equal(result.changed, false);
    if (expectedCode) assert.equal(result.code, expectedCode);
    assert.deepEqual(storeCalls, []);
    assert.deepEqual(events, []);
  }

  const unavailable = { date: '2026-08-20', kind: 'unavailable', intervals: [] };
  const custom = { date: '2026-08-20', kind: 'custom', intervals: [{ start: '18:00', end: '19:00' }] };
  assertChanged(() => app.api.AvailabilityEngine.saveException(unavailable), 'exception-added');
  assertNoEffect(() => app.api.AvailabilityEngine.saveException(unavailable));
  assertChanged(() => app.api.AvailabilityEngine.saveException(custom), 'exception-updated');
  assertNoEffect(() => app.api.AvailabilityEngine.saveException(custom));
  assertNoEffect(() => app.api.AvailabilityEngine.saveException({ date: '2026-08-21', kind: 'custom', intervals: [] }), 'INVALID_INPUT');
  assertNoEffect(() => app.api.AvailabilityEngine.deleteException('2026-08-21'));
  assertChanged(() => app.api.AvailabilityEngine.deleteException('2026-08-20'), 'exception-deleted');
  assertNoEffect(() => app.api.AvailabilityEngine.deleteException('2026-08-20'));
  assertChanged(() => app.api.AvailabilityEngine.clearConfiguration(), 'configuration-cleared');
  assertNoEffect(() => app.api.AvailabilityEngine.clearConfiguration());
  assertNoEffect(() => app.api.AvailabilityEngine.saveException(unavailable), 'NOT_CONFIGURED');
});

test('awaria strict Store daje PERSISTENCE_FAILED bez zmiany cache i bez obu zdarzeń', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const events = [];
  app.api.EventBus.on('store:change', payload => {
    if (payload.key === 'availability:configuration') events.push('store');
  });
  app.api.EventBus.on('availability:changed', () => events.push('domain'));
  app.storageControl.failWhen(attempt => attempt.key === 'v2:availability:configuration');

  const result = toPlain(app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek()));

  assert.equal(result.code, 'PERSISTENCE_FAILED');
  assert.equal(app.api.AvailabilityEngine.getConfiguration().configured, false);
  assert.deepEqual(events, []);
});

test('uszkodzony Store zwraca tylko INVALID_STORED_DATA, a potwierdzony reset może go usunąć', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  app.api.Store.set('availability:configuration', { privateSyntheticValue: '<not exposed>' }, { strict: true });

  for (const result of [
    app.api.AvailabilityEngine.getConfiguration(),
    app.api.AvailabilityEngine.getExceptions(),
    app.api.AvailabilityEngine.getAvailabilityForDate('2026-08-20'),
    app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek())
  ]) {
    assert.equal(result.code, 'INVALID_STORED_DATA');
    assert.doesNotMatch(JSON.stringify(toPlain(result)), /privateSyntheticValue|not exposed/);
  }
  assert.equal(app.api.AvailabilityEngine.clearConfiguration().changed, true);
  assert.equal(app.api.AvailabilityEngine.getConfiguration().configured, false);
});

test('wszystkie odczyty są głębokimi kopiami, nie referencjami z cache Store', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const configuration = availabilityConfiguration();
  app.api.Store.set('availability:configuration', configuration, { strict: true });

  const first = app.api.AvailabilityEngine.getConfiguration();
  first.configuration.weeklySchedule[1].intervals[0].start = '00:00';
  first.configuration.exceptions.length = 0;
  const second = app.api.AvailabilityEngine.getConfiguration();
  assert.deepEqual(toPlain(second.configuration), configuration);

  const day = app.api.AvailabilityEngine.getAvailabilityForDate('2026-08-17');
  day.intervals[0].end = '00:01';
  assert.deepEqual(toPlain(app.api.AvailabilityEngine.getAvailabilityForDate('2026-08-17').intervals), [availabilityInterval()]);
});

test('daty lokalne obejmują poniedziałek–niedzielę, odrzucają nieistniejące dni i izolują daty', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  for (const [date, weekday] of [
    ['2026-08-16', 0], ['2026-08-17', 1], ['2026-08-18', 2], ['2026-08-19', 3],
    ['2026-08-20', 4], ['2026-08-21', 5], ['2026-08-22', 6]
  ]) assert.equal(app.api.weekdayFromLocalDate(date), weekday, date);
  for (const date of ['2026-02-29', '2026-13-01', '2026-00-01', '2026-04-31', '20-01-01']) {
    assert.equal(app.api.weekdayFromLocalDate(date), null, date);
    assert.equal(app.api.AvailabilityEngine.getAvailableMinutes(date).code, 'INVALID_INPUT');
  }
  assert.equal(app.api.weekdayFromLocalDate('2024-02-29'), 4);

  app.api.Store.set('availability:configuration', availabilityConfiguration(), { strict: true });
  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-20').availableMinutes, 0);
  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-27').availableMinutes, 240);
});

test('nominalne minuty Europe/Warsaw są niezależne od obu zmian DST', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const week = emptyWeek();
  week[0].intervals = [{ start: '00:00', end: '24:00' }];
  app.api.Store.set('availability:configuration', { weeklySchedule: week, exceptions: [] }, { strict: true });

  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-03-29').availableMinutes, 1440);
  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-10-25').availableMinutes, 1440);
});

test('UI pokazuje poniedziałek–niedzielę i pozwala rzeczywiście zapisać koniec 24:00', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  assert.match(app.document.getElementById('availability-settings-card').textContent, /nie jest skonfigurowana/i);
  app.document.getElementById('availability-save-weekly').click();

  const days = [...app.document.querySelectorAll('[data-availability-weekday]')];
  assert.deepEqual(days.map(day => day.querySelector('.ex-name').textContent), [
    'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'
  ]);
  const monday = app.document.querySelector('[data-availability-weekday="1"]');
  monday.querySelector('[data-availability-add-interval]').click();
  const updatedMonday = app.document.querySelector('[data-availability-weekday="1"]');
  updatedMonday.querySelector('[data-availability-start]').value = '23:00';
  const end = updatedMonday.querySelector('[data-availability-end]');
  assert.equal(end.type, 'text');
  end.value = '24:00';
  app.document.getElementById('availability-save-weekly').click();

  assert.equal(app.api.AvailabilityEngine.getAvailableMinutes('2026-08-17').availableMinutes, 60);
  assert.equal(app.document.querySelector('datalist#availability-end-times option[value="24:00"]') !== null, true);
});

test('UI resetuje konfigurację tylko po potwierdzeniu i rozpoznaje anulowanie', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  app.api.AvailabilityEngine.saveWeeklySchedule(emptyWeek());
  app.storageControl.reset();

  app.dialogs.enqueueConfirm(false);
  app.document.getElementById('availability-clear').click();
  assert.equal(app.api.AvailabilityEngine.getConfiguration().configured, true);
  assert.equal(app.storageControl.attempts.length, 0);

  app.dialogs.enqueueConfirm(true);
  app.document.getElementById('availability-clear').click();
  assert.equal(app.api.AvailabilityEngine.getConfiguration().configured, false);
  assert.equal(app.storageControl.attempts.length, 1);
});

test('UI anuluje albo zatwierdza reset uszkodzonej konfiguracji bez automatycznej naprawy', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  app.api.Store.set('availability:configuration', { syntheticInvalid: true }, { strict: true });
  app.api.renderAvailabilitySettings();
  app.storageControl.reset();
  const events = [];
  app.api.EventBus.on('store:change', payload => {
    if (payload.key === 'availability:configuration') events.push(['store:change', payload.key]);
  });
  app.api.EventBus.on('availability:changed', payload => events.push(['availability:changed', toPlain(payload)]));

  app.dialogs.enqueueConfirm(false);
  app.document.getElementById('availability-clear-invalid').click();
  assert.equal(app.document.getElementById('availability-clear-invalid') !== null, true);
  assert.equal(app.api.AvailabilityEngine.getConfiguration().code, 'INVALID_STORED_DATA');
  assert.equal(app.storageControl.attempts.length, 0);
  assert.deepEqual(events, []);

  app.dialogs.enqueueConfirm(true);
  app.document.getElementById('availability-clear-invalid').click();
  assert.deepEqual(toPlain(app.api.AvailabilityEngine.getConfiguration()), {
    ok: true, configured: false, configuration: null
  });
  assert.equal(app.storageControl.attempts.length, 1);
  assert.equal(app.storageControl.attempts[0].key, 'v2:availability:configuration');
  assert.match(app.document.getElementById('availability-settings-card').textContent, /nie jest skonfigurowana/i);
  assert.deepEqual(events, [
    ['store:change', 'availability:configuration'],
    ['availability:changed', { change: 'configuration-cleared' }]
  ]);
});

test('zapis Availability nie zmienia budżetu ani starszych silników, ale odświeża plan Today', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const tasks = [
    { id: 'synthetic-first', priority: 1, estimatedMinutes: 30 },
    { id: 'synthetic-second', priority: 2, estimatedMinutes: 40 }
  ];
  const budgetBefore = app.api.Store.get('ui:timeBudget', null);
  const budgetButtonsBefore = [...app.document.querySelectorAll('.time-btn')].map(button => ({
    active: button.classList.contains('active'),
    key: button.dataset.key,
    text: button.textContent
  }));
  const priorityBefore = toPlain(app.api.PriorityEngine.pickWithinBudget(tasks, 60));
  const decisionBefore = toPlain(app.api.DecisionEngine.planToday(60, '2026-08-20'));
  const todayBefore = app.document.getElementById('view-dzis').innerHTML;
  const moduleIdsBefore = toPlain(app.api.ModuleRegistry.all().map(module => module.id));

  const week = emptyWeek();
  week[4].intervals = [{ start: '17:00', end: '18:30' }];
  assert.equal(app.api.AvailabilityEngine.saveWeeklySchedule(week).changed, true);

  assert.equal(app.api.Store.get('ui:timeBudget', null), budgetBefore);
  assert.deepEqual([...app.document.querySelectorAll('.time-btn')].map(button => ({
    active: button.classList.contains('active'),
    key: button.dataset.key,
    text: button.textContent
  })), budgetButtonsBefore);
  assert.deepEqual(toPlain(app.api.PriorityEngine.pickWithinBudget(tasks, 60)), priorityBefore);
  assert.deepEqual(toPlain(app.api.DecisionEngine.planToday(60, '2026-08-20')), decisionBefore);
  assert.notEqual(app.document.getElementById('view-dzis').innerHTML, todayBefore);
  assert.match(app.document.getElementById('today-tasks').textContent, /budżet ręczny w granicach dostępności/i);
  assert.deepEqual(toPlain(app.api.ModuleRegistry.all().map(module => module.id)), moduleIdsBefore);
  assert.deepEqual(moduleIdsBefore, ['training', 'it', 'school', 'english']);
});

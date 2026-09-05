import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIXED_THURSDAY,
  availabilityConfiguration,
  backupEnvelope,
  cloneJson,
  englishActivity,
  englishProfile,
  populatedBackupEnvelope
} from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function localStorageSnapshot(window) {
  return Object.fromEntries(
    Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .sort()
      .map(key => [key, window.localStorage.getItem(key)])
  );
}

function storeSnapshot(api) {
  return Object.fromEntries(api.KNOWN_NAMESPACES.map(namespace => [
    namespace,
    toPlain(api.Store.get(namespace, api.NAMESPACE_DEFAULTS[namespace]))
  ]));
}

test('eksport tworzy poprawną kopertę wyłącznie ze znanych namespace’ów i nie zmienia danych', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  app.api.Store.set('dayRecords', { '2026-08-20': { date: '2026-08-20', energyScore: 80 } });
  app.window.localStorage.setItem('v2:synthetic-foreign-key', JSON.stringify({ mustStayPrivate: true }));
  const before = localStorageSnapshot(app.window);

  const envelope = toPlain(app.api.exportBackup());

  assert.equal(envelope.backupFormat, 'personal-os-v2-backup');
  assert.equal(envelope.backupVersion, 1);
  assert.equal(envelope.appDataVersion, 7);
  assert.equal(envelope.exportedAt, FIXED_THURSDAY);
  assert.deepEqual(
    Object.keys(envelope.data).sort(),
    toPlain(app.api.KNOWN_NAMESPACES).filter(namespace => namespace !== 'it:lessonGuidesRecoveredContainer').sort()
  );
  assert.equal('synthetic-foreign-key' in envelope.data, false);
  assert.equal('v2:synthetic-foreign-key' in envelope.data, false);
  assert.equal('it:lessonGuidesRecoveredContainer' in envelope.data, false);
  assert.deepEqual(localStorageSnapshot(app.window), before);
});

test('eksport uwzględnia poprawny recovery container, ale pomija wartość null', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  assert.equal('it:lessonGuidesRecoveredContainer' in app.api.exportBackup().data, false);
  const recovered = {
    recoveredAt: FIXED_THURSDAY,
    originalValue: { syntheticBrokenContainer: true }
  };

  app.api.Store.set('it:lessonGuidesRecoveredContainer', recovered);

  assert.deepEqual(toPlain(app.api.exportBackup().data['it:lessonGuidesRecoveredContainer']), recovered);
});

test('pobranie backupu tworzy JSON Blob, nazwę pliku, kliknięcie i zawsze zwalnia URL', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());

  const envelope = toPlain(app.api.downloadBackupFile());

  assert.equal(app.downloads.length, 1);
  assert.equal(app.downloads[0].blob instanceof app.window.Blob, true);
  assert.equal(app.downloads[0].blob.type, 'application/json');
  assert.equal(
    app.downloads[0].blob.size,
    new app.window.TextEncoder().encode(JSON.stringify(envelope, null, 2)).length
  );
  assert.equal(app.downloads[0].revoked, true);
  assert.equal(app.anchorClicks.length, 1);
  assert.equal(app.anchorClicks[0].download, 'personal-os-backup-2026-08-20.json');
  assert.equal(app.anchorClicks[0].href, app.downloads[0].url);
  assert.equal(app.anchorClicks[0].isConnected, true);
});

test('preview aktualnego backupu zwraca statystyki i staging bez dotykania prawdziwego Store', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  app.api.Store.set('dayRecords', { '2026-08-19': { date: '2026-08-19', energyScore: 40 } });
  const envelope = populatedBackupEnvelope(app.api);
  const storageBefore = localStorageSnapshot(app.window);
  const storeEvents = [];
  app.api.EventBus.on('store:change', event => storeEvents.push(toPlain(event)));

  const preview = app.api.previewBackupFile(JSON.stringify(envelope));

  assert.equal(preview.ok, true);
  assert.deepEqual(toPlain(preview.stats), {
    trainingSessions: 1,
    criteriaDone: 1,
    schoolItems: 1,
    lessonGuides: 1,
    availabilityConfigured: true,
    availabilityWeeklyIntervals: 2,
    availabilityExceptions: 1,
    englishActivities: 2,
    englishActivitiesDone: 1
  });
  assert.deepEqual(toPlain(preview.staging.get('dayRecords', null)), envelope.data.dayRecords);
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', null)), {
    '2026-08-19': { date: '2026-08-19', energyScore: 40 }
  });
  assert.deepEqual(localStorageSnapshot(app.window), storageBefore);
  assert.deepEqual(storeEvents, []);
});

test('backup v7 zachowuje wcześniejszy kontrakt długich danych School bez przycinania', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const longId = 'synthetic-school-' + 'i'.repeat(210);
  const longSubject = 'S'.repeat(180);
  const longTitle = 'T'.repeat(180);
  const schoolRecord = {
    id: longId,
    type: 'homework',
    subject: longSubject,
    title: longTitle,
    dueDate: '2026-08-21',
    estimatedMinutes: 30,
    difficulty: 2,
    notes: 'Synthetic compatibility record',
    status: 'todo',
    completedDate: null,
    activeDuringVacation: false
  };
  const envelope = backupEnvelope(app.api);
  envelope.data['school:items'] = [schoolRecord];
  let importCompletedEvents = 0;
  app.api.EventBus.on('backup:importCompleted', () => importCompletedEvents++);

  const staged = app.api.stageAndValidateBackup(envelope);

  assert.equal(staged.ok, true);
  assert.deepEqual(toPlain(staged.staging.get('school:items', null)), [schoolRecord]);
  app.api.Store.set('school:items', [schoolRecord]);
  const exported = toPlain(app.api.exportBackup());
  assert.deepEqual(exported.data['school:items'], [schoolRecord]);

  const preview = app.api.previewBackupFile(JSON.stringify(exported));

  assert.equal(preview.ok, true);
  assert.deepEqual(toPlain(preview.staging.get('school:items', null)), [schoolRecord]);
  assert.equal(preview.staging.get('school:items', [])[0].id.length > 200, true);
  assert.equal(preview.staging.get('school:items', [])[0].subject, longSubject);
  assert.equal(preview.staging.get('school:items', [])[0].title, longTitle);
  assert.equal(importCompletedEvents, 0, 'staging, eksport i preview nie wykonują Replace');
});

test('starszy backup dostaje legalne defaults i przechodzi rzeczywiste migracje 1→7', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const criterionId = app.api.ROADMAP_STAGES[0].criteria[0].id;
  const envelope = {
    backupFormat: 'personal-os-v2-backup',
    backupVersion: 1,
    appDataVersion: 1,
    exportedAt: FIXED_THURSDAY,
    data: {
      'sandbox:tasks': [{ id: 'synthetic-old-task', title: 'Synthetic old task', done: true }],
      'it:criteriaDone': { [criterionId]: true }
    }
  };

  const parsed = app.api.parseAndValidateBackupFile(JSON.stringify(envelope));
  assert.equal(parsed.ok, true);
  const staged = app.api.stageAndValidateBackup(parsed.envelope);

  assert.equal(staged.ok, true);
  assert.equal(staged.staging.get('meta:schemaVersion', null), 7);
  assert.deepEqual(toPlain(staged.staging.get('sandbox:tasks', null)), [{
    id: 'synthetic-old-task', title: 'Synthetic old task', status: 'done', completedDate: null
  }]);
  assert.deepEqual(toPlain(staged.staging.get('it:criteriaDone', null)), {
    [criterionId]: { status: 'done', completedDate: null }
  });
  assert.equal(staged.staging.get('school:mode', null), 'school_year');
  assert.deepEqual(toPlain(staged.staging.get('school:items', null)), []);
  assert.equal(staged.staging.get('english:profile', 'missing'), null);
  assert.deepEqual(toPlain(staged.staging.get('english:activities', null)), []);
  assert.equal(staged.staging.get('availability:configuration', 'missing'), null);
  assert.deepEqual(toPlain(staged.staging.get('it:stageStatuses', null)), toPlain(app.api.RoadmapEngine.deriveInitialStatuses()));
});

test('staging wymaga danych v7, odrzuca stageStatuses null i oczyszcza błędny opcjonalny recovery container', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());

  const missingRequired = populatedBackupEnvelope(app.api);
  delete missingRequired.data.dayRecords;
  const missingResult = app.api.stageAndValidateBackup(missingRequired);
  assert.equal(missingResult.ok, false);
  assert.match(toPlain(missingResult.errors).join(' '), /wymaganych danych.*dayRecords/);

  const nullStatuses = populatedBackupEnvelope(app.api);
  nullStatuses.data['it:stageStatuses'] = null;
  const nullResult = app.api.stageAndValidateBackup(nullStatuses);
  assert.equal(nullResult.ok, false);
  assert.match(toPlain(nullResult.errors).join(' '), /stageStatuses.*null niedozwolone/);

  const optionalRecovery = populatedBackupEnvelope(app.api);
  optionalRecovery.data['it:lessonGuidesRecoveredContainer'] = { recoveredAt: 'not-iso' };
  const recoveryResult = app.api.stageAndValidateBackup(optionalRecovery);
  assert.equal(recoveryResult.ok, true);
  assert.equal(recoveryResult.staging.get('it:lessonGuidesRecoveredContainer', 'missing'), null);
});

test('backup v5 może nie zawierać English, a v6 wymaga obu namespace’ów i akceptuje profil null', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());

  const versionFive = backupEnvelope(app.api);
  versionFive.appDataVersion = 5;
  delete versionFive.data['english:profile'];
  delete versionFive.data['english:activities'];
  const oldResult = app.api.stageAndValidateBackup(versionFive);
  assert.equal(oldResult.ok, true);
  assert.equal(oldResult.staging.get('meta:schemaVersion', null), 7);
  assert.equal(oldResult.staging.get('english:profile', 'missing'), null);
  assert.deepEqual(toPlain(oldResult.staging.get('english:activities', null)), []);

  const missingProfile = backupEnvelope(app.api);
  delete missingProfile.data['english:profile'];
  const missingProfileResult = toPlain(app.api.stageAndValidateBackup(missingProfile));
  assert.equal(missingProfileResult.ok, false);
  assert.match(missingProfileResult.errors.join(' '), /wymaganych danych.*english:profile/);

  const missingActivities = backupEnvelope(app.api);
  delete missingActivities.data['english:activities'];
  const missingActivitiesResult = toPlain(app.api.stageAndValidateBackup(missingActivities));
  assert.equal(missingActivitiesResult.ok, false);
  assert.match(missingActivitiesResult.errors.join(' '), /wymaganych danych.*english:activities/);

  const nullProfile = backupEnvelope(app.api);
  nullProfile.data['english:profile'] = null;
  assert.equal(app.api.stageAndValidateBackup(nullProfile).ok, true);

  const storageBeforeInvalidVariants = localStorageSnapshot(app.window);
  const profileMissingFocus = englishProfile();
  delete profileMissingFocus.focus;
  for (const invalidProfile of [
    profileMissingFocus,
    englishProfile({ enabled: 'true' }),
    englishProfile({ weeklyMinutes: 14 })
  ]) {
    const invalidEnvelope = backupEnvelope(app.api);
    invalidEnvelope.data['english:profile'] = invalidProfile;
    const invalidResult = toPlain(app.api.stageAndValidateBackup(invalidEnvelope));
    assert.equal(invalidResult.ok, false);
    assert.match(invalidResult.errors.join(' '), /english:profile/);
  }
  for (const invalidActivities of [
    [englishActivity({ status: 'done', completedDate: null })],
    [englishActivity({ id: 'first-current', current: true }), englishActivity({ id: 'second-current', current: true })],
    { synthetic: 'invalid-container' }
  ]) {
    const invalidEnvelope = backupEnvelope(app.api);
    invalidEnvelope.data['english:activities'] = invalidActivities;
    const invalidResult = toPlain(app.api.stageAndValidateBackup(invalidEnvelope));
    assert.equal(invalidResult.ok, false);
    assert.match(invalidResult.errors.join(' '), /english:activities/);
  }
  assert.deepEqual(localStorageSnapshot(app.window), storageBeforeInvalidVariants);
});

test('backup v6 dostaje Availability null, a v7 wymaga namespace’u i jego ścisłej walidacji', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());

  const versionSix = backupEnvelope(app.api);
  versionSix.appDataVersion = 6;
  delete versionSix.data['availability:configuration'];
  const migrated = app.api.stageAndValidateBackup(versionSix);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.staging.get('meta:schemaVersion', null), 7);
  assert.equal(migrated.staging.get('availability:configuration', 'missing'), null);

  const missingCurrent = backupEnvelope(app.api);
  delete missingCurrent.data['availability:configuration'];
  const missingResult = toPlain(app.api.stageAndValidateBackup(missingCurrent));
  assert.equal(missingResult.ok, false);
  assert.match(missingResult.errors.join(' '), /wymaganych danych.*availability:configuration/);

  const currentNull = backupEnvelope(app.api);
  currentNull.data['availability:configuration'] = null;
  assert.equal(app.api.stageAndValidateBackup(currentNull).ok, true);

  const invalidCurrent = backupEnvelope(app.api);
  const invalidConfiguration = availabilityConfiguration();
  invalidConfiguration.weeklySchedule[1].intervals = [
    { start: '18:00', end: '19:00' },
    { start: '08:00', end: '09:00' }
  ];
  invalidCurrent.data['availability:configuration'] = invalidConfiguration;
  const invalidResult = toPlain(app.api.stageAndValidateBackup(invalidCurrent));
  assert.equal(invalidResult.ok, false);
  assert.match(invalidResult.errors.join(' '), /availability:configuration.*kanonicznej/);
});

test('commit Replace zapisuje wszystkie namespace’y strict+silent i emituje jedno zdarzenie zbiorcze', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const envelope = populatedBackupEnvelope(app.api);
  const staged = app.api.stageAndValidateBackup(envelope);
  assert.equal(staged.ok, true);
  app.api.Store.set('dayRecords', { '2026-08-01': { date: '2026-08-01', energyScore: 1 } });
  const calls = [];
  const originalSet = app.api.Store.set;
  app.api.Store.set = (namespace, value, options) => {
    calls.push({ namespace, options: toPlain(options) });
    return originalSet(namespace, value, options);
  };
  let completedEvents = 0;
  let storeEvents = 0;
  app.api.EventBus.on('backup:importCompleted', () => completedEvents++);
  app.api.EventBus.on('store:change', () => storeEvents++);

  const result = toPlain(app.api.commitStagedImport(staged.staging));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map(call => call.namespace), toPlain(app.api.KNOWN_NAMESPACES));
  assert.equal(calls.every(call => call.options.strict === true && call.options.silent === true), true);
  for (const namespace of app.api.KNOWN_NAMESPACES) {
    assert.deepEqual(
      toPlain(app.api.Store.get(namespace, app.api.NAMESPACE_DEFAULTS[namespace])),
      toPlain(staged.staging.get(namespace, app.api.NAMESPACE_DEFAULTS[namespace]))
    );
  }
  assert.equal('2026-08-01' in app.api.Store.get('dayRecords', {}), false, 'Replace nie zachowuje starych rekordów jak Merge');
  assert.equal(completedEvents, 1);
  assert.equal(storeEvents, 0);
});

test('pełny import od surowego JSON zastępuje stan końcowy bez Merge', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  app.api.Store.set('dayRecords', { '2026-08-01': { date: '2026-08-01', energyScore: 10 } });
  const envelope = populatedBackupEnvelope(app.api);
  let completedEvents = 0;
  app.api.EventBus.on('backup:importCompleted', () => completedEvents++);

  const result = toPlain(app.api.importBackup(JSON.stringify(envelope)));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', null)), envelope.data.dayRecords);
  assert.equal(completedEvents, 1);
});

test('awaria w środku commita przywraca wszystkie namespace’y i zwraca ROLLBACK_OK', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  app.api.Store.set('dayRecords', { '2026-08-01': { date: '2026-08-01', energyScore: 20 } });
  const before = storeSnapshot(app.api);
  const staged = app.api.stageAndValidateBackup(populatedBackupEnvelope(app.api));
  let completedEvents = 0;
  app.api.EventBus.on('backup:importCompleted', () => completedEvents++);
  app.storageControl.reset();
  app.storageControl.failWhen(attempt => attempt.index === 3);

  const result = toPlain(app.api.commitStagedImport(staged.staging));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'IMPORT_FAILED_ROLLBACK_OK');
  assert.equal(completedEvents, 0);
  assert.equal(app.storageControl.attempts.length, 3 + app.api.KNOWN_NAMESPACES.length);
  assert.deepEqual(
    app.storageControl.attempts.slice(3).map(attempt => attempt.key),
    toPlain(app.api.KNOWN_NAMESPACES).map(namespace => `v2:${namespace}`)
  );
  assert.deepEqual(storeSnapshot(app.api), before);
});

test('awaria commita dokładnie na namespace’ach English przywraca oba z rollbacku', async () => {
  for (const failingNamespace of ['english:profile', 'english:activities']) {
    const app = await loadApp({ fixedNow: FIXED_THURSDAY });
    try {
      app.api.Store.set('english:profile', englishProfile({ enabled: false, weeklyMinutes: 15, focus: 'general' }));
      app.api.Store.set('english:activities', [englishActivity({ id: 'english-before-import' })]);
      const before = storeSnapshot(app.api);
      const staged = app.api.stageAndValidateBackup(populatedBackupEnvelope(app.api));
      assert.equal(staged.ok, true);
      const commitFailureIndex = app.api.KNOWN_NAMESPACES.indexOf(failingNamespace) + 1;
      app.storageControl.reset();
      app.storageControl.failWhen(attempt => attempt.index === commitFailureIndex);

      const result = toPlain(app.api.commitStagedImport(staged.staging));

      assert.equal(result.ok, false, failingNamespace);
      assert.equal(result.status, 'IMPORT_FAILED_ROLLBACK_OK', failingNamespace);
      assert.equal(app.storageControl.attempts[commitFailureIndex - 1].key, `v2:${failingNamespace}`);
      assert.equal(app.storageControl.attempts.length, commitFailureIndex + app.api.KNOWN_NAMESPACES.length);
      assert.deepEqual(storeSnapshot(app.api), before, failingNamespace);
      assert.deepEqual(toPlain(app.api.Store.get('english:profile', null)), before['english:profile'], failingNamespace);
      assert.deepEqual(toPlain(app.api.Store.get('english:activities', null)), before['english:activities'], failingNamespace);
    } finally {
      app.close();
    }
  }
});

test('awaria commita na Availability przywraca atomową konfigurację z rollbacku', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const beforeConfiguration = availabilityConfiguration({ exceptions: [] });
  app.api.Store.set('availability:configuration', beforeConfiguration, { strict: true });
  const before = storeSnapshot(app.api);
  const staged = app.api.stageAndValidateBackup(populatedBackupEnvelope(app.api));
  assert.equal(staged.ok, true);
  const commitFailureIndex = app.api.KNOWN_NAMESPACES.indexOf('availability:configuration') + 1;
  app.storageControl.reset();
  app.storageControl.failWhen(attempt => attempt.index === commitFailureIndex);

  const result = toPlain(app.api.commitStagedImport(staged.staging));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'IMPORT_FAILED_ROLLBACK_OK');
  assert.equal(app.storageControl.attempts[commitFailureIndex - 1].key, 'v2:availability:configuration');
  assert.deepEqual(storeSnapshot(app.api), before);
});

test('częściowo nieudany rollback raportuje dokładnie Availability', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const beforeConfiguration = availabilityConfiguration({ exceptions: [] });
  app.api.Store.set('availability:configuration', beforeConfiguration, { strict: true });
  const staged = app.api.stageAndValidateBackup(populatedBackupEnvelope(app.api));
  assert.equal(staged.ok, true);
  const commitFailureIndex = app.api.KNOWN_NAMESPACES.indexOf('english:profile') + 1;
  const rollbackFailureIndex = commitFailureIndex
    + app.api.KNOWN_NAMESPACES.indexOf('availability:configuration') + 1;
  app.storageControl.reset();
  app.storageControl.failWhen(attempt => [commitFailureIndex, rollbackFailureIndex].includes(attempt.index));

  const result = toPlain(app.api.commitStagedImport(staged.staging));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'IMPORT_FAILED_ROLLBACK_FAILED');
  assert.deepEqual(result.failedNamespaces, ['availability:configuration']);
  assert.deepEqual(
    toPlain(app.api.Store.get('availability:configuration', null)),
    toPlain(staged.staging.get('availability:configuration', null))
  );
});

test('częściowo nieudany rollback raportuje dokładny namespace English', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const profileBefore = englishProfile({ enabled: false, weeklyMinutes: 15, focus: 'general' });
  const activitiesBefore = [englishActivity({ id: 'english-before-partial-rollback' })];
  app.api.Store.set('english:profile', profileBefore);
  app.api.Store.set('english:activities', activitiesBefore);
  const staged = app.api.stageAndValidateBackup(populatedBackupEnvelope(app.api));
  assert.equal(staged.ok, true);
  const activitiesCommitFailureIndex = app.api.KNOWN_NAMESPACES.indexOf('english:activities') + 1;
  const profileRollbackFailureIndex = activitiesCommitFailureIndex
    + app.api.KNOWN_NAMESPACES.indexOf('english:profile') + 1;
  app.storageControl.reset();
  app.storageControl.failWhen(attempt => [activitiesCommitFailureIndex, profileRollbackFailureIndex].includes(attempt.index));

  const result = toPlain(app.api.commitStagedImport(staged.staging));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'IMPORT_FAILED_ROLLBACK_FAILED');
  assert.deepEqual(result.failedNamespaces, ['english:profile']);
  assert.deepEqual(
    toPlain(app.api.Store.get('english:profile', null)),
    toPlain(staged.staging.get('english:profile', null)),
    'nieudany rollback profilu pozostawia wartość ze stagingu'
  );
  assert.deepEqual(toPlain(app.api.Store.get('english:activities', null)), activitiesBefore);
});

test('awarie rollbacku zwracają dokładne namespace’y i UI nie sugeruje pełnego odzyskania', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const staged = app.api.stageAndValidateBackup(populatedBackupEnvelope(app.api));
  let completedEvents = 0;
  app.api.EventBus.on('backup:importCompleted', () => completedEvents++);
  app.storageControl.reset();
  app.storageControl.failWhen(attempt => [3, 5, 8].includes(attempt.index));

  const result = toPlain(app.api.commitStagedImport(staged.staging));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'IMPORT_FAILED_ROLLBACK_FAILED');
  assert.deepEqual(result.failedNamespaces, [app.api.KNOWN_NAMESPACES[1], app.api.KNOWN_NAMESPACES[4]]);
  assert.equal(completedEvents, 0);
  assert.equal(app.storageControl.attempts.length, 3 + app.api.KNOWN_NAMESPACES.length);

  app.api.renderImportCommitFailure(result);
  const message = app.document.getElementById('backup-import-panel').textContent;
  assert.match(message, /KRYTYCZNY BŁĄD/);
  assert.doesNotMatch(message, /poprzedni stan został przywrócony|dane.*bezpieczne/i);
});

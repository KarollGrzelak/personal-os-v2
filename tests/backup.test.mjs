import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIXED_THURSDAY,
  backupEnvelope,
  cloneJson,
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
  assert.equal(envelope.appDataVersion, 5);
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
    lessonGuides: 1
  });
  assert.deepEqual(toPlain(preview.staging.get('dayRecords', null)), envelope.data.dayRecords);
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', null)), {
    '2026-08-19': { date: '2026-08-19', energyScore: 40 }
  });
  assert.deepEqual(localStorageSnapshot(app.window), storageBefore);
  assert.deepEqual(storeEvents, []);
});

test('starszy backup dostaje legalne defaults i przechodzi rzeczywiste migracje 1→5', async t => {
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
  assert.equal(staged.staging.get('meta:schemaVersion', null), 5);
  assert.deepEqual(toPlain(staged.staging.get('sandbox:tasks', null)), [{
    id: 'synthetic-old-task', title: 'Synthetic old task', status: 'done', completedDate: null
  }]);
  assert.deepEqual(toPlain(staged.staging.get('it:criteriaDone', null)), {
    [criterionId]: { status: 'done', completedDate: null }
  });
  assert.equal(staged.staging.get('school:mode', null), 'school_year');
  assert.deepEqual(toPlain(staged.staging.get('school:items', null)), []);
  assert.deepEqual(toPlain(staged.staging.get('it:stageStatuses', null)), toPlain(app.api.RoadmapEngine.deriveInitialStatuses()));
});

test('staging wymaga danych v5, odrzuca stageStatuses null i oczyszcza błędny opcjonalny recovery container', async t => {
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

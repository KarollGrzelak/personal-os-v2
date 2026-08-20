import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIXED_THURSDAY,
  backupEnvelope,
  cloneJson,
  lessonGuideRecord,
  populatedBackupEnvelope,
  resource
} from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function setSelectedFile(input, file) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new input.ownerDocument.defaultView.Event('change'));
}

async function flushFileReader() {
  await Promise.resolve();
  await Promise.resolve();
}

test('parser odrzuca pusty tekst, błędny JSON i nieprawidłowe warianty koperty', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const base = backupEnvelope(app.api);
  const cases = [
    ['', /Pusty/],
    ['{not-json', /Nieprawidłowy plik JSON/],
    [JSON.stringify([]), /Nieprawidłowa struktura/],
    [JSON.stringify({ ...base, backupFormat: 'synthetic-unknown-format' }), /Nieznany format/],
    [JSON.stringify({ ...base, backupVersion: 999 }), /Nieobsługiwana wersja/],
    [JSON.stringify({ ...base, appDataVersion: 6 }), /nowszej wersji Personal OS/],
    [JSON.stringify({ ...base, exportedAt: 'not-an-iso-date' }), /Nieprawidłowa data eksportu/],
    [JSON.stringify({ ...base, data: null }), /Nieprawidłowa zawartość/]
  ];

  for (const [raw, expected] of cases) {
    const result = toPlain(app.api.parseAndValidateBackupFile(raw));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), expected);
  }

  const missingRequired = backupEnvelope(app.api);
  delete missingRequired.data.habitLogs;
  const preview = toPlain(app.api.previewBackupFile(JSON.stringify(missingRequired)));
  assert.equal(preview.ok, false);
  assert.match(preview.errors.join(' '), /wymaganych danych.*habitLogs/);
});

test('limit używa bajtów UTF-8 i odrzuca wielobajtowy tekst przed parsowaniem JSON', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(app.api.utf8ByteLength('Aą🙂'), 7);
  const oversizedPolishText = 'ą'.repeat(Math.floor(app.api.BACKUP_MAX_BYTES / 2) + 1);
  assert.equal(oversizedPolishText.length < app.api.BACKUP_MAX_BYTES, true, 'liczba jednostek UTF-16 pozostaje pod limitem bajtów');

  const result = toPlain(app.api.parseAndValidateBackupFile(oversizedPolishText));

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['Plik jest zbyt duży.']);
});

test('parser odrzuca strukturę głębszą niż limit', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const envelope = backupEnvelope(app.api);
  let nested = { syntheticLeaf: true };
  for (let depth = 0; depth <= app.api.BACKUP_MAX_DEPTH + 2; depth++) nested = { nested };
  envelope.data.dayRecords = nested;

  const result = toPlain(app.api.parseAndValidateBackupFile(JSON.stringify(envelope)));

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /zbyt głęboką strukturę/);
});

test('niebezpieczne klucze są odrzucane na różnych poziomach i nie zanieczyszczają prototypu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  assert.equal({}.syntheticPolluted, undefined);

  const topLevel = backupEnvelope(app.api);
  Object.defineProperty(topLevel, '__proto__', {
    enumerable: true,
    value: { syntheticPolluted: true }
  });
  const nestedConstructor = backupEnvelope(app.api);
  nestedConstructor.data.dayRecords = { safe: { constructor: { syntheticPolluted: true } } };
  const arrayPrototype = backupEnvelope(app.api);
  arrayPrototype.data['school:items'] = [{ safe: [{ prototype: { syntheticPolluted: true } }] }];

  for (const envelope of [topLevel, nestedConstructor, arrayPrototype]) {
    const result = toPlain(app.api.parseAndValidateBackupFile(JSON.stringify(envelope)));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /niebezpieczne klucze/);
  }
  assert.equal({}.syntheticPolluted, undefined);
  assert.equal(Object.prototype.syntheticPolluted, undefined);
});

test('staging odrzuca nieznane i brakujące stageId oraz błędne kryteria', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const valid = backupEnvelope(app.api);
  const stageIds = toPlain(app.api.ROADMAP_STAGES.map(stage => stage.id));
  const criterionId = app.api.ROADMAP_STAGES[0].criteria[0].id;
  const cases = [];

  const unknownStage = cloneJson(valid);
  unknownStage.data['it:stageStatuses']['synthetic-unknown-stage'] = 'locked';
  cases.push([unknownStage, /nieznany stageId/]);

  const missingStage = cloneJson(valid);
  delete missingStage.data['it:stageStatuses'][stageIds[0]];
  cases.push([missingStage, /brak wymaganego stageId/]);

  const unknownCriterion = cloneJson(valid);
  unknownCriterion.data['it:criteriaDone'] = {
    'synthetic-unknown-criterion': { status: 'done', completedDate: '2026-08-20' }
  };
  cases.push([unknownCriterion, /nieznany criterionId/]);

  const skippedCriterion = cloneJson(valid);
  skippedCriterion.data['it:criteriaDone'] = {
    [criterionId]: { status: 'skipped', completedDate: null }
  };
  cases.push([skippedCriterion, /dozwolone wyłącznie todo\/done/]);

  for (const [envelope, expected] of cases) {
    const result = toPlain(app.api.stageAndValidateBackup(envelope));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), expected);
  }
});

test('błędne dane każdej krytycznej domeny odrzucają cały import', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const invalidValues = {
    dayRecords: [],
    habitDefs: {},
    habitLogs: [],
    'ui:timeBudget': 'synthetic-invalid-budget',
    'training:profile': [],
    'training:sessions': [],
    'training:exerciseLogs': [],
    'it:stageStatuses': null,
    'it:criteriaDone': [],
    'it:lessonGuides': [],
    'school:mode': 'synthetic-invalid-mode',
    'school:items': {},
    'school:schedule': {},
    'sandbox:tasks': {}
  };

  for (const [namespace, invalidValue] of Object.entries(invalidValues)) {
    const envelope = backupEnvelope(app.api);
    envelope.data[namespace] = invalidValue;
    const result = toPlain(app.api.stageAndValidateBackup(envelope));
    assert.equal(result.ok, false, `${namespace} nie może przejść stagingu`);
    assert.match(result.errors.join(' '), new RegExp(namespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('walidacja URL akceptuje tylko bezwzględne http i https', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(app.api.isValidResourceUrl('https://example.test/resource'), true);
  assert.equal(app.api.isValidResourceUrl('http://example.test/resource'), true);
  for (const invalid of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///tmp/synthetic.txt',
    '/relative/path',
    'not a url'
  ]) {
    assert.equal(app.api.isValidResourceUrl(invalid), false, invalid);
  }
});

test('rzeczywisty DOM LessonGuide ponownie sprawdza URL i nie interpretuje niezaufanego HTML', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = app.api.ModuleRegistry.get('it');
  const stage = app.api.ROADMAP_STAGES[0];
  const criterionId = stage.criteria[0].id;
  const guide = lessonGuideRecord(criterionId, {
    why: '<script id="synthetic-script">globalThis.syntheticExecuted=true</script>',
    skills: ['<img id="synthetic-image" src=x onerror="globalThis.syntheticExecuted=true">'],
    prerequisites: ['</textarea><svg id="synthetic-svg" onload="globalThis.syntheticExecuted=true">'],
    resources: {
      documentation: [resource({
        id: 'synthetic-unsafe-url',
        title: '<img id="synthetic-resource-image" src=x onerror="globalThis.syntheticExecuted=true">',
        url: 'javascript:globalThis.syntheticExecuted=true'
      })],
      articles: [resource({
        id: 'synthetic-attribute-breakout',
        title: 'Synthetic safe protocol',
        url: 'https://example.test/\" onmouseover=\"globalThis.syntheticExecuted=true'
      })],
      videos: [],
      additional: []
    },
    commonMistakes: ['<b id="synthetic-bold">synthetic markup</b>'],
    legacyContent: '</textarea><script>globalThis.syntheticExecuted=true</script>'
  });
  app.api.Store.set('it:lessonGuides', { [criterionId]: guide });
  const container = app.document.getElementById('view-it');
  module.render(container);
  container.querySelector(`.stage-card[data-stage="${stage.id}"] .stage-head`).click();
  container.querySelector(`.guide-toggle-btn[data-crit="${criterionId}"]`).click();
  const panel = container.querySelector(`#guide-panel-${criterionId}`);

  assert.equal(app.window.syntheticExecuted, undefined);
  assert.equal(panel.querySelector('script, img, svg'), null);
  assert.equal(panel.querySelector('[onerror], [onload], [onmouseover], [onclick]'), null);
  assert.equal([...panel.querySelectorAll('a')].some(anchor => anchor.href.startsWith('javascript:')), false);
  assert.equal([...panel.querySelectorAll('a')].every(anchor => !anchor.hasAttribute('onmouseover')), true);
  assert.match(panel.textContent, /<script id="synthetic-script">/);
  assert.match(panel.textContent, /nieprawidłowy URL/);
  assert.match(panel.textContent, /<\/textarea>/);
});

test('komunikaty błędów renderują niezaufany HTML wyłącznie jako tekst', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const payload = '<img id="synthetic-error-image" src=x onerror="globalThis.syntheticExecuted=true"><script>globalThis.syntheticExecuted=true</script>';

  app.api.renderImportError([payload]);
  const panel = app.document.getElementById('backup-import-panel');

  assert.equal(panel.querySelector('img, script'), null);
  assert.equal(panel.querySelector('[onerror]'), null);
  assert.equal(app.window.syntheticExecuted, undefined);
  assert.match(panel.textContent, /<img id="synthetic-error-image"/);
});

test('plik ponad limitem jest odrzucany przed FileReader, a błąd odczytu ma bezpieczny komunikat', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const input = app.document.getElementById('backup-import-file');

  setSelectedFile(input, { name: 'synthetic-too-large.json', size: app.api.BACKUP_MAX_BYTES + 1 });
  assert.equal(app.fileReaderControl.calls.length, 0);
  assert.match(app.document.getElementById('backup-import-panel').textContent, /Plik jest zbyt duży/);

  app.fileReaderControl.enqueueError();
  setSelectedFile(input, { name: 'synthetic-reader-error.json', size: 10 });
  await flushFileReader();
  assert.equal(app.fileReaderControl.calls.length, 1);
  const panel = app.document.getElementById('backup-import-panel');
  assert.match(panel.textContent, /Nie udało się odczytać pliku/);
  assert.equal(panel.querySelector('script, img, [onerror]'), null);
});

test('poprawny FileReader prowadzi do preview bez zapisu', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const input = app.document.getElementById('backup-import-file');
  const envelope = populatedBackupEnvelope(app.api);
  const before = toPlain(app.api.Store.get('dayRecords', {}));
  let completedEvents = 0;
  app.api.EventBus.on('backup:importCompleted', () => completedEvents++);
  app.fileReaderControl.enqueueSuccess(JSON.stringify(envelope));

  setSelectedFile(input, { name: 'synthetic-valid.json', size: 1024 });
  await flushFileReader();

  assert.equal(app.fileReaderControl.calls.length, 1);
  assert.match(app.document.getElementById('backup-import-panel').textContent, /Podgląd kopii przed przywróceniem/);
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', {})), before);
  assert.equal(completedEvents, 0);
});

test('anulowanie i pierwszy etap potwierdzenia nie zapisują; Replace następuje dopiero po drugim kliknięciu', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  app.api.Store.set('dayRecords', { '2026-08-01': { date: '2026-08-01', energyScore: 10 } });
  const before = toPlain(app.api.Store.get('dayRecords', {}));
  const envelope = populatedBackupEnvelope(app.api);

  app.api.handleBackupFileSelected(JSON.stringify(envelope));
  app.document.getElementById('backup-import-cancel').click();
  assert.equal(app.document.getElementById('backup-import-panel').textContent, '');
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', {})), before);

  app.api.handleBackupFileSelected(JSON.stringify(envelope));
  app.document.getElementById('backup-import-confirm1').click();
  assert.notEqual(app.document.getElementById('backup-import-confirm2-wrap').style.display, 'none');
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', {})), before);

  app.document.getElementById('backup-import-confirm2').click();
  assert.deepEqual(toPlain(app.api.Store.get('dayRecords', {})), envelope.data.dayRecords);
  assert.match(app.document.getElementById('backup-import-panel').textContent, /Import zakończony sukcesem/);
});

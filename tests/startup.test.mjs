import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { inspectIndexHtml, loadApp, readIndexHtml, toPlain } from './helpers/load-app.mjs';

test('index.html zawiera dokładnie jeden klasyczny skrypt inline o poprawnej składni', async () => {
  const html = await readIndexHtml();
  const inspection = inspectIndexHtml(html);

  assert.equal(inspection.scriptCount, 1);
  assert.equal(inspection.hasSource, false);
  assert.equal(inspection.isClassic, true);
  assert.doesNotThrow(() => new vm.Script(inspection.inlineCode, { filename: 'index.html:inline-script' }));
});

test('świeża aplikacja uruchamia się bez nieobsłużonych błędów i migruje do wersji 5', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(app.api.DATA_VERSION, 5);
  assert.equal(app.window.localStorage.getItem('v2:meta:schemaVersion'), '5');
  assert.equal(app.api.Router.current(), 'dzis');
  assert.deepEqual(toPlain(app.api.ModuleRegistry.all().map(module => module.id)), ['training', 'it', 'school']);
  assert.equal(app.document.getElementById('view-dzis').classList.contains('active'), true);
  assert.deepEqual(app.errors.window, []);
  assert.deepEqual(app.errors.unhandledRejections, []);
  assert.deepEqual(app.errors.jsdom, []);
  assert.deepEqual(app.errors.console, []);
});

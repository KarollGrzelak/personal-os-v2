import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  inspectIndexHtml,
  loadApp,
  readAppSource,
  readIndexHtml,
  readStylesSource,
  toPlain
} from './helpers/load-app.mjs';

test('index.html wskazuje dokładnie jeden klasyczny skrypt i jeden zewnętrzny arkusz stylów', async () => {
  const [html, appSource, stylesSource] = await Promise.all([
    readIndexHtml(),
    readAppSource(),
    readStylesSource()
  ]);
  const inspection = inspectIndexHtml(html);

  assert.equal(inspection.scriptCount, 1);
  assert.equal(inspection.hasSource, true);
  assert.equal(inspection.scriptSource, './src/app.js');
  assert.equal(inspection.inlineCode.trim(), '');
  assert.equal(inspection.hasForbiddenScheduling, false);
  assert.equal(inspection.isClassic, true);
  assert.equal(inspection.styleBlockCount, 0);
  assert.equal(inspection.stylesheetCount, 1);
  assert.equal(inspection.stylesheetSource, './src/styles.css');
  assert.notEqual(stylesSource.length, 0);
  assert.doesNotThrow(() => new vm.Script(appSource, { filename: 'src/app.js' }));
});

test('świeża aplikacja uruchamia się bez nieobsłużonych błędów i migruje do wersji 5', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(app.api.DATA_VERSION, 5);
  assert.equal(app.window.localStorage.getItem('v2:meta:schemaVersion'), '5');
  assert.equal(app.api.Router.current(), 'dzis');
  assert.deepEqual(toPlain(app.api.ModuleRegistry.all().map(module => module.id)), ['training', 'it', 'school']);
  assert.equal(app.document.getElementById('view-dzis').classList.contains('active'), true);
  assert.deepEqual(app.resourceControl.blocked, []);
  assert.deepEqual(new Set(app.resourceControl.requests), new Set([
    'https://personal-os.test/personal-os-v2/src/app.js',
    'https://personal-os.test/personal-os-v2/src/styles.css'
  ]));
  assert.deepEqual(app.errors.window, []);
  assert.deepEqual(app.errors.unhandledRejections, []);
  assert.deepEqual(app.errors.jsdom, []);
  assert.deepEqual(app.errors.console, []);

  const unexpectedResourceUrl = 'https://network-must-stay-blocked.invalid/unexpected.html';
  const blockedApp = await loadApp({ unexpectedResourceUrl });
  t.after(() => blockedApp.close());
  assert.equal(blockedApp.resourceControl.requests.includes(unexpectedResourceUrl), true);
  assert.deepEqual(blockedApp.resourceControl.blocked, [unexpectedResourceUrl]);
  assert.equal(blockedApp.errors.jsdom.length > 0, true);
});

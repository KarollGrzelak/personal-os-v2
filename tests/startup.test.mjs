import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  inspectIndexHtml,
  loadApp,
  readAvailabilitySource,
  readAppSource,
  readBackupSource,
  readCoreSource,
  readEnglishSource,
  readIndexHtml,
  readLearningSource,
  readPlanDaySource,
  readSchoolSource,
  readStylesSource,
  readTodaySource,
  readTrainingSource,
  toPlain
} from './helpers/load-app.mjs';

test('index.html zachowuje produkcyjny shell, dziesięć skryptów i jeden zewnętrzny arkusz stylów', async () => {
  const [html, coreSource, todaySource, trainingSource, learningSource, schoolSource, availabilitySource, englishSource, planDaySource, backupSource, appSource, stylesSource] = await Promise.all([
    readIndexHtml(),
    readCoreSource(),
    readTodaySource(),
    readTrainingSource(),
    readLearningSource(),
    readSchoolSource(),
    readAvailabilitySource(),
    readEnglishSource(),
    readPlanDaySource(),
    readBackupSource(),
    readAppSource(),
    readStylesSource()
  ]);
  const inspection = inspectIndexHtml(html);

  assert.match(html, /<title>\s*Personal OS\s*<\/title>/);
  assert.match(html, /<a\b[^>]*class="skip-link"[^>]*href="#main-content"/);
  assert.match(html, /<header\b/);
  assert.match(html, /<nav\b[^>]*aria-label="Główna nawigacja"/);
  assert.match(html, /<main\b[^>]*id="main-content"/);
  assert.doesNotMatch(html, /Krok 8|view-status|view-docs|status-badges|event-log/);
  assert.doesNotMatch(html, /\sstyle\s*=|\son[a-z]+\s*=/i);
  assert.equal(inspection.scriptCount, 10);
  assert.deepEqual(inspection.scriptSources, ['./src/core.js', './src/today.js', './src/training.js', './src/learning.js', './src/school.js', './src/availability.js', './src/english.js', './src/plan-day.js', './src/backup.js', './src/app.js']);
  assert.equal(inspection.scriptDetails.every(script => script.hasSource), true);
  assert.equal(inspection.scriptDetails.every(script => script.inlineCode.trim() === ''), true);
  assert.equal(inspection.scriptDetails.every(script => script.hasForbiddenScheduling === false), true);
  assert.equal(inspection.scriptDetails.every(script => script.isClassic), true);
  assert.equal(inspection.isClassic, true);
  assert.equal(inspection.scriptsAreAdjacent, true);
  assert.equal(inspection.scriptsAtBodyEnd, true);
  assert.equal(inspection.styleBlockCount, 0);
  assert.equal(inspection.stylesheetCount, 1);
  assert.equal(inspection.stylesheetSource, './src/styles.css');
  assert.notEqual(stylesSource.length, 0);
  assert.notEqual(coreSource.length, 0);
  assert.notEqual(todaySource.length, 0);
  assert.notEqual(trainingSource.length, 0);
  assert.notEqual(learningSource.length, 0);
  assert.notEqual(schoolSource.length, 0);
  assert.notEqual(availabilitySource.length, 0);
  assert.notEqual(englishSource.length, 0);
  assert.notEqual(planDaySource.length, 0);
  assert.notEqual(backupSource.length, 0);
  assert.notEqual(appSource.length, 0);
  assert.doesNotThrow(() => new vm.Script(coreSource, { filename: 'src/core.js' }));
  assert.doesNotThrow(() => new vm.Script(todaySource, { filename: 'src/today.js' }));
  assert.doesNotThrow(() => new vm.Script(trainingSource, { filename: 'src/training.js' }));
  assert.doesNotThrow(() => new vm.Script(learningSource, { filename: 'src/learning.js' }));
  assert.doesNotThrow(() => new vm.Script(schoolSource, { filename: 'src/school.js' }));
  assert.doesNotThrow(() => new vm.Script(availabilitySource, { filename: 'src/availability.js' }));
  assert.doesNotThrow(() => new vm.Script(englishSource, { filename: 'src/english.js' }));
  assert.doesNotThrow(() => new vm.Script(planDaySource, { filename: 'src/plan-day.js' }));
  assert.doesNotThrow(() => new vm.Script(backupSource, { filename: 'src/backup.js' }));
  assert.doesNotThrow(() => new vm.Script(appSource, { filename: 'src/app.js' }));
});

test('ładowanie PlanDay wyłącznie definiuje czysty silnik i nie rejestruje modułu', async () => {
  const planDaySource = await readPlanDaySource();
  const registrations = [];
  const forbidden = label => new Proxy({}, {
    get() { throw new Error(`${label} nie może być używany podczas ładowania PlanDay`); },
    set() { throw new Error(`${label} nie może być używany podczas ładowania PlanDay`); }
  });
  const context = vm.createContext({
    ModuleRegistry: { register(module) { registrations.push(module); } },
    Store: forbidden('Store'),
    EventBus: forbidden('EventBus'),
    document: forbidden('DOM'),
    console
  });

  assert.doesNotThrow(() => new vm.Script(planDaySource, { filename: 'src/plan-day.js' }).runInContext(context));
  assert.deepEqual(registrations, []);
});

test('ładowanie Availability wyłącznie definiuje warstwę i nie rejestruje modułu', async () => {
  const availabilitySource = await readAvailabilitySource();
  const registrations = [];
  const forbidden = label => new Proxy({}, {
    get() { throw new Error(`${label} nie może być używany podczas ładowania Availability`); },
    set() { throw new Error(`${label} nie może być używany podczas ładowania Availability`); }
  });
  const context = vm.createContext({
    ModuleRegistry: { register(module) { registrations.push(module); } },
    Store: forbidden('Store'),
    EventBus: forbidden('EventBus'),
    document: forbidden('DOM'),
    console
  });

  assert.doesNotThrow(() => new vm.Script(availabilitySource, { filename: 'src/availability.js' }).runInContext(context));
  assert.deepEqual(registrations, []);
});

test('ładowanie English wyłącznie definiuje warstwę i rejestruje moduł', async () => {
  const englishSource = await readEnglishSource();
  const registrations = [];
  const forbidden = label => new Proxy({}, {
    get() { throw new Error(`${label} nie może być używany podczas ładowania English`); },
    set() { throw new Error(`${label} nie może być używany podczas ładowania English`); }
  });
  const context = vm.createContext({
    ModuleRegistry: { register(module) { registrations.push(module); } },
    Store: forbidden('Store'),
    EventBus: forbidden('EventBus'),
    document: forbidden('DOM'),
    console
  });

  assert.doesNotThrow(() => new vm.Script(englishSource, { filename: 'src/english.js' }).runInContext(context));
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, 'english');
  assert.equal(registrations[0].name, 'Angielski');
});

test('świeża aplikacja uruchamia się bez nieobsłużonych błędów i migruje do wersji 7', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(app.api.DATA_VERSION, 7);
  assert.equal(app.window.localStorage.getItem('v2:meta:schemaVersion'), '7');
  assert.equal(app.window.localStorage.getItem('v2:availability:configuration'), 'null');
  assert.equal(app.api.Router.current(), 'dzis');
  assert.equal(app.document.title, 'Dziś · Personal OS');
  assert.equal(app.document.querySelectorAll('h1').length, 1);
  assert.deepEqual(toPlain(app.api.ModuleRegistry.all().map(module => module.id)), ['training', 'it', 'school', 'english']);
  assert.equal(app.document.getElementById('view-dzis').classList.contains('active'), true);
  assert.deepEqual(app.resourceControl.blocked, []);
  assert.deepEqual(new Set(app.resourceControl.requests), new Set([
    'https://personal-os.test/personal-os-v2/src/core.js',
    'https://personal-os.test/personal-os-v2/src/today.js',
    'https://personal-os.test/personal-os-v2/src/training.js',
    'https://personal-os.test/personal-os-v2/src/learning.js',
    'https://personal-os.test/personal-os-v2/src/school.js',
    'https://personal-os.test/personal-os-v2/src/availability.js',
    'https://personal-os.test/personal-os-v2/src/english.js',
    'https://personal-os.test/personal-os-v2/src/plan-day.js',
    'https://personal-os.test/personal-os-v2/src/backup.js',
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

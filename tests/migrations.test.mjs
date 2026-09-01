import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApp, toPlain } from './helpers/load-app.mjs';

const FIXED_NOW = '2026-08-20T08:00:00.000Z';

function validGuide(criterionId) {
  return {
    criterionId,
    why: '',
    skills: [],
    prerequisites: [],
    resources: { documentation: [], articles: [], videos: [], additional: [] },
    workOrder: [],
    exercises: [],
    selfTest: [],
    commonMistakes: [],
    createdAt: null,
    updatedAt: null,
    status: 'draft'
  };
}

async function migrationContext(t) {
  const app = await loadApp({ fixedNow: FIXED_NOW });
  t.after(() => app.close());
  return { app, store: app.api.createMemoryStore() };
}

test('migracja 1→2 zamienia done na status i zachowuje już zmigrowane zadania', async t => {
  const { app, store } = await migrationContext(t);
  store.set('meta:schemaVersion', 1);
  store.set('sandbox:tasks', [
    { id: 'done', title: 'Syntetyczne A', done: true },
    { id: 'todo', title: 'Syntetyczne B', done: false },
    { id: 'ready', title: 'Syntetyczne C', status: 'done', completedDate: '2026-08-19' }
  ]);

  app.api.runMigrations(store);

  assert.deepEqual(toPlain(store.get('sandbox:tasks', null)), [
    { id: 'done', title: 'Syntetyczne A', status: 'done', completedDate: null },
    { id: 'todo', title: 'Syntetyczne B', status: 'todo', completedDate: null },
    { id: 'ready', title: 'Syntetyczne C', status: 'done', completedDate: '2026-08-19' }
  ]);
  assert.equal(store.get('meta:schemaVersion', null), 6);
});

test('migracja 2→3 zamienia wartości kryteriów na rekordy stanu', async t => {
  const { app, store } = await migrationContext(t);
  store.set('meta:schemaVersion', 2);
  store.set('it:criteriaDone', {
    'criterion-a': true,
    'criterion-b': false,
    'criterion-c': { status: 'done', completedDate: '2026-08-18' }
  });

  app.api.runMigrations(store);

  assert.deepEqual(toPlain(store.get('it:criteriaDone', null)), {
    'criterion-a': { status: 'done', completedDate: null },
    'criterion-b': { status: 'todo', completedDate: null },
    'criterion-c': { status: 'done', completedDate: '2026-08-18' }
  });
  assert.equal(store.get('meta:schemaVersion', null), 6);
});

test('migracja 3→4 dodaje activeDuringVacation bez nadpisywania istniejącej wartości', async t => {
  const { app, store } = await migrationContext(t);
  store.set('meta:schemaVersion', 3);
  store.set('school:items', [
    { id: 'school-a', title: 'Syntetyczny termin' },
    { id: 'school-b', title: 'Syntetyczne zadanie', activeDuringVacation: true }
  ]);

  app.api.runMigrations(store);

  assert.deepEqual(toPlain(store.get('school:items', null)), [
    { id: 'school-a', title: 'Syntetyczny termin', activeDuringVacation: false },
    { id: 'school-b', title: 'Syntetyczne zadanie', activeDuringVacation: true }
  ]);
  assert.equal(store.get('meta:schemaVersion', null), 6);
});

test('migracja 4→5 zachowuje poprawny LessonGuide i odzyskuje niepoprawny wpis', async t => {
  const { app, store } = await migrationContext(t);
  const valid = validGuide('criterion-valid');
  const invalid = { unexpected: 'synthetic legacy value' };
  store.set('meta:schemaVersion', 4);
  store.set('it:lessonGuides', {
    'criterion-valid': valid,
    'criterion-invalid': invalid
  });

  app.api.runMigrations(store);

  const guides = toPlain(store.get('it:lessonGuides', null));
  assert.deepEqual(guides['criterion-valid'], valid);
  assert.deepEqual(guides['criterion-invalid'], {
    criterionId: 'criterion-invalid',
    why: '',
    skills: [],
    prerequisites: [],
    resources: { documentation: [], articles: [], videos: [], additional: [] },
    workOrder: [],
    exercises: [],
    selfTest: [],
    commonMistakes: [],
    createdAt: null,
    updatedAt: null,
    migratedAt: FIXED_NOW,
    status: 'draft',
    legacyContent: invalid
  });
  assert.equal(store.get('meta:schemaVersion', null), 6);
});

test('migracja 4→5 odkłada uszkodzony kontener LessonGuide i przywraca pusty obiekt', async t => {
  const { app, store } = await migrationContext(t);
  const brokenContainer = ['synthetic', 'legacy'];
  store.set('meta:schemaVersion', 4);
  store.set('it:lessonGuides', brokenContainer);

  app.api.runMigrations(store);

  assert.deepEqual(toPlain(store.get('it:lessonGuidesRecoveredContainer', null)), {
    recoveredAt: FIXED_NOW,
    originalValue: brokenContainer
  });
  assert.deepEqual(toPlain(store.get('it:lessonGuides', null)), {});
  assert.equal(store.get('meta:schemaVersion', null), 6);
});

test('migracje obsługują pusty MemoryStore', async t => {
  const { app, store } = await migrationContext(t);

  app.api.runMigrations(store);

  assert.equal(store.get('meta:schemaVersion', null), 6);
  assert.deepEqual(toPlain(store.get('it:lessonGuides', null)), {});
  assert.equal(store.get('english:profile', 'missing'), null);
  assert.deepEqual(toPlain(store.get('english:activities', null)), []);
});

test('dane w aktualnej wersji pozostają nietknięte', async t => {
  const { app, store } = await migrationContext(t);
  const sentinel = ['synthetic-current-data'];
  store.set('meta:schemaVersion', 6);
  store.set('it:lessonGuides', sentinel);

  app.api.runMigrations(store);

  assert.equal(store.get('meta:schemaVersion', null), 6);
  assert.deepEqual(toPlain(store.get('it:lessonGuides', null)), sentinel);
  assert.equal(store.get('it:lessonGuidesRecoveredContainer', null), null);
});

test('migracja 5→6 tworzy wyłącznie brakujące namespace’y English i chroni inne domeny', async t => {
  const { app, store } = await migrationContext(t);
  const dayRecords = { '2026-08-20': { date: '2026-08-20', energyScore: 77 } };
  store.set('meta:schemaVersion', 5);
  store.set('dayRecords', dayRecords);

  app.api.runMigrations(store);

  assert.equal(store.get('meta:schemaVersion', null), 6);
  assert.equal(store.get('english:profile', 'missing'), null);
  assert.deepEqual(toPlain(store.get('english:activities', null)), []);
  assert.deepEqual(toPlain(store.get('dayRecords', null)), dayRecords);
});

test('migracja 5→6 zachowuje null, parsowalne niepoprawne dane i częściowo istniejący stan English', async t => {
  const { app, store } = await migrationContext(t);
  const invalidActivities = { synthetic: 'invalid but parseable' };
  store.set('meta:schemaVersion', 5);
  store.set('english:profile', null);
  store.set('english:activities', invalidActivities);

  app.api.runMigrations(store);

  assert.equal(store.get('meta:schemaVersion', null), 6);
  assert.equal(store.get('english:profile', 'missing'), null);
  assert.deepEqual(toPlain(store.get('english:activities', null)), invalidActivities);

  const partial = app.api.createMemoryStore();
  const invalidProfile = { enabled: 'synthetic-invalid' };
  partial.set('meta:schemaVersion', 5);
  partial.set('english:profile', invalidProfile);
  app.api.runMigrations(partial);
  assert.deepEqual(toPlain(partial.get('english:profile', null)), invalidProfile);
  assert.deepEqual(toPlain(partial.get('english:activities', null)), []);
});

test('awaria pierwszego lub drugiego zapisu migracji 5→6 nie zapisuje wersji 6', async t => {
  const { app } = await migrationContext(t);
  for (const scenario of [
    { failingNamespace: 'english:profile', expectedWrites: ['english:profile'] },
    { failingNamespace: 'english:activities', expectedWrites: ['english:profile', 'english:activities'] }
  ]) {
    let version = 5;
    const writes = [];
    const failingStore = {
      get(key, fallback) {
        if (key === 'meta:schemaVersion') return version;
        return fallback;
      },
      set(key, value) {
        writes.push(key);
        if (key === scenario.failingNamespace) throw new Error(`Synthetic migration failure: ${key}`);
        if (key === 'meta:schemaVersion') version = value;
      }
    };

    assert.throws(() => app.api.runMigrations(failingStore), new RegExp(`Synthetic migration failure: ${scenario.failingNamespace}`));
    assert.equal(version, 5, scenario.failingNamespace);
    assert.deepEqual(writes, scenario.expectedWrites, scenario.failingNamespace);
    assert.equal(writes.includes('meta:schemaVersion'), false, scenario.failingNamespace);
  }
});

test('uszkodzony raw JSON pozostaje udokumentowanym ograniczeniem Store podczas migracji 5→6', async t => {
  const app = await loadApp({
    storage: {
      'v2:meta:schemaVersion': 5,
      'v2:english:profile': '{synthetic-broken-json'
    }
  });
  t.after(() => app.close());

  assert.equal(app.window.localStorage.getItem('v2:meta:schemaVersion'), '6');
  assert.equal(app.window.localStorage.getItem('v2:english:profile'), 'null');
  assert.equal(app.api.Store.get('english:profile', 'missing'), null);
});

test('ponowne uruchomienie migracji jest idempotentne', async t => {
  const { app, store } = await migrationContext(t);
  store.set('meta:schemaVersion', 1);
  store.set('sandbox:tasks', [{ id: 'task', done: true }]);
  store.set('it:lessonGuides', { legacy: 'synthetic legacy guide' });

  app.api.runMigrations(store);
  const afterFirstRun = {
    version: store.get('meta:schemaVersion', null),
    tasks: toPlain(store.get('sandbox:tasks', null)),
    guides: toPlain(store.get('it:lessonGuides', null))
  };
  app.api.runMigrations(store);

  assert.deepEqual({
    version: store.get('meta:schemaVersion', null),
    tasks: toPlain(store.get('sandbox:tasks', null)),
    guides: toPlain(store.get('it:lessonGuides', null))
  }, afterFirstRun);
});

test('wersja schematu nie jest zapisywana, gdy migracja kończy się błędem', async t => {
  const { app } = await migrationContext(t);
  let version = 1;
  const versionWrites = [];
  const failingStore = {
    get(key, fallback) {
      if (key === 'meta:schemaVersion') return version;
      if (key === 'sandbox:tasks') return { deliberately: 'not an array' };
      return fallback;
    },
    set(key, value) {
      if (key === 'meta:schemaVersion') {
        version = value;
        versionWrites.push(value);
      }
    }
  };

  assert.throws(
    () => app.api.runMigrations(failingStore),
    error => error?.name === 'TypeError' && /tasks\.map is not a function/.test(error.message)
  );
  assert.equal(version, 1);
  assert.deepEqual(versionWrites, []);
});

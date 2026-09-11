import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIXED_MONDAY,
  FIXED_THURSDAY,
  lessonGuideContent,
  lessonGuideRecord,
  linearRoadmap,
  resource
} from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function learning(api) {
  return api.ModuleRegistry.get('it');
}

test('walidator akceptuje liniową roadmapę i odrzuca rozgałęzienie', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const valid = linearRoadmap();
  assert.deepEqual(toPlain(app.api.validateRoadmapDefinition(valid)), { valid: true, errors: [] });

  const branched = structuredClone(valid);
  branched.push({
    ...structuredClone(branched[1]),
    id: 'synthetic-stage-3',
    order: 3,
    name: 'Synthetic branch',
    prerequisites: ['synthetic-stage-1'],
    criteria: [{
      id: 'synthetic-criterion-3',
      title: 'Synthetic branch criterion',
      estimatedMinutes: 15,
      difficulty: 2,
      xp: 10
    }]
  });
  const invalid = toPlain(app.api.validateRoadmapDefinition(branched));

  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.some(error => /bezpośrednich następców/.test(error)), true);
});

test('kryteria wymagają ręcznego zamknięcia etapu, które odblokowuje następny etap', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const stages = app.api.ROADMAP_STAGES;
  const first = stages[0];
  const second = stages[1];

  const initialStatuses = toPlain(app.api.RoadmapEngine.getStageStatuses());
  assert.equal(initialStatuses[first.id], 'active');
  assert.equal(initialStatuses[second.id], 'locked');
  assert.equal(module.getTasks('2026-08-17').length, first.criteria.length);
  assert.equal(module.getTasks('2026-08-17').every(task => task.status === 'todo'), true);

  for (const criterion of first.criteria) module.setTaskStatus(criterion.id, 'done');

  const completedTasks = toPlain(module.getTasks('2026-08-17'));
  assert.equal(completedTasks.every(task => task.status === 'done'), true);
  assert.equal(completedTasks.every(task => task.completedDate === '2026-08-17'), true);
  assert.equal(app.api.RoadmapEngine.getProgress(first.id), 100);
  assert.equal(app.api.RoadmapEngine.getStageStatuses()[first.id], 'active');
  assert.equal(app.api.RoadmapEngine.getStageStatuses()[second.id], 'locked');
  assert.equal(app.api.RoadmapEngine.canCompleteStage(first.id), true);

  assert.deepEqual(toPlain(app.api.RoadmapEngine.completeStage(first.id)), { ok: true });
  const finalStatuses = toPlain(app.api.RoadmapEngine.getStageStatuses());
  assert.equal(finalStatuses[first.id], 'done');
  assert.equal(finalStatuses[second.id], 'active');
  assert.equal(app.api.RoadmapEngine.getActiveStage().id, second.id);
  assert.deepEqual(toPlain(module.getStats()), { done: 1, total: stages.length, label: 'Nauka IT' });
});

test('Learning waliduje datę, ale zwraca identyczną pulę Task v2 dla dwóch poprawnych dni', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const monday = toPlain(module.getTasks('2026-08-17'));
  const thursday = toPlain(module.getTasks('2026-08-20'));

  assert.deepEqual(thursday, monday);
  assert.equal(monday.length > 0, true);
  for (const task of module.getTasks('2026-08-17')) {
    assert.equal(task.priority, 40);
    assert.equal(task.planningClass, 'flexible');
    assert.deepEqual(toPlain(app.api.validateTaskV2(task)), { valid: true, errors: [] });
  }
});

test('Learning emituje configuration po completeStage, a status i LessonGuide nie dublują tasks:changed', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const first = app.api.ROADMAP_STAGES[0];
  const taskEvents = [];
  const statusEvents = [];
  app.api.EventBus.on('tasks:changed', payload => taskEvents.push(toPlain(payload)));
  app.api.EventBus.on('task:status', payload => statusEvents.push(toPlain(payload)));

  assert.equal(app.api.RoadmapEngine.completeStage(first.id).ok, false);
  assert.equal(module.saveLessonGuide(first.criteria[0].id, lessonGuideContent()).ok, true);
  assert.deepEqual(taskEvents, []);

  module.setTaskStatus(first.criteria[0].id, 'done');
  module.setTaskStatus(first.criteria[0].id, 'done');
  for (const criterion of first.criteria.slice(1)) module.setTaskStatus(criterion.id, 'done');
  assert.deepEqual(taskEvents, []);
  assert.equal(statusEvents.length, first.criteria.length, 'powtórny status jest rzeczywistym no-opem');

  assert.deepEqual(toPlain(app.api.RoadmapEngine.completeStage(first.id)), { ok: true });
  assert.equal(app.api.RoadmapEngine.completeStage(first.id).ok, false);
  assert.deepEqual(taskEvents, [{ moduleId: 'it', change: 'configuration' }]);
  assert.deepEqual(Object.keys(taskEvents[0]).sort(), ['change', 'moduleId']);
});

test('reconciliation usuwa nieistniejące etapy, dodaje brakujące i przelicza aktywny etap', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const stageIds = app.api.ROADMAP_STAGES.map(stage => stage.id);
  app.api.Store.set('it:stageStatuses', {
    [stageIds[0]]: 'done',
    'synthetic-removed-stage': 'done'
  });

  app.api.RoadmapEngine.reconcileRoadmapState();

  const statuses = toPlain(app.api.RoadmapEngine.getStageStatuses());
  assert.deepEqual(Object.keys(statuses).sort(), toPlain(stageIds).sort());
  assert.equal(statuses[stageIds[0]], 'done');
  assert.equal(statuses[stageIds[1]], 'active');
  assert.equal(statuses[stageIds[2]], 'locked');
  assert.equal('synthetic-removed-stage' in statuses, false);
});

test('LessonGuide jest normalizowany, a surowy walidator rozróżnia poprawny i błędny rekord', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const normalized = toPlain(app.api.normalizeLessonGuide({
    criterionId: 'untrusted-id',
    why: 123,
    skills: ['synthetic-skill'],
    resources: null,
    status: 'reviewed',
    createdAt: 'untrusted-time'
  }, 'synthetic-criterion'));

  assert.deepEqual(normalized, {
    criterionId: 'synthetic-criterion',
    why: '',
    skills: ['synthetic-skill'],
    prerequisites: [],
    resources: { documentation: [], articles: [], videos: [], additional: [] },
    workOrder: [],
    exercises: [],
    selfTest: [],
    commonMistakes: []
  });

  const valid = lessonGuideRecord('synthetic-criterion');
  assert.equal(app.api.isValidLessonGuide(valid, 'synthetic-criterion').valid, true);
  assert.equal(app.api.isValidLessonGuide({ ...valid, status: 'published' }, 'synthetic-criterion').valid, false);
  assert.equal(app.api.isValidLessonGuide({ ...valid, resources: [] }, 'synthetic-criterion').valid, false);
});

test('edycja LessonGuide resetuje reviewed i czyści potwierdzenie po zmianie źródeł', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const criterionId = 'synthetic-guide-edit';
  const content = lessonGuideContent({
    resources: { documentation: [resource()], articles: [], videos: [], additional: [] }
  });

  const firstSave = toPlain(module.saveLessonGuide(criterionId, content));
  assert.equal(firstSave.ok, true);
  assert.equal(firstSave.guide.status, 'draft');
  assert.equal(firstSave.guide.createdAt, FIXED_THURSDAY);
  assert.equal(firstSave.guide.updatedAt, FIXED_THURSDAY);

  assert.deepEqual(toPlain(module.markLessonGuideReviewed(criterionId)), { ok: true });
  assert.deepEqual(toPlain(module.confirmSourcesChecked(criterionId)), { ok: true });
  assert.equal(module.getLessonGuide(criterionId).status, 'reviewed');
  assert.equal(module.getLessonGuide(criterionId).sourcesCheckedAt, FIXED_THURSDAY);

  module.saveLessonGuide(criterionId, content);
  const sameResources = toPlain(module.getLessonGuide(criterionId));
  assert.equal(sameResources.status, 'draft');
  assert.equal(sameResources.sourcesCheckedAt, FIXED_THURSDAY);

  module.markLessonGuideReviewed(criterionId);
  module.saveLessonGuide(criterionId, lessonGuideContent({
    resources: {
      documentation: [resource(), resource({ id: 'synthetic-resource-2', url: 'https://example.test/second' })],
      articles: [], videos: [], additional: []
    }
  }));
  const changedResources = toPlain(module.getLessonGuide(criterionId));
  assert.equal(changedResources.status, 'draft');
  assert.equal('sourcesCheckedAt' in changedResources, false);
});

test('import domenowy wymusza draft, zachowuje legacyContent i resetuje pola przeglądu', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const criterionId = 'synthetic-guide-import';
  const existing = lessonGuideRecord(criterionId, {
    status: 'reviewed',
    sourcesCheckedAt: '2026-08-03T08:00:00.000Z',
    migratedAt: '2026-08-01T07:00:00.000Z',
    legacyContent: { syntheticLegacy: true }
  });
  app.api.Store.set('it:lessonGuides', { [criterionId]: existing });
  const importedText = JSON.stringify({
    ...lessonGuideContent({ why: 'Imported synthetic content' }),
    status: 'reviewed',
    createdAt: '1999-01-01T00:00:00.000Z',
    sourcesCheckedAt: '1999-01-01T00:00:00.000Z',
    migratedAt: '1999-01-01T00:00:00.000Z',
    legacyContent: { syntheticInjectedLegacy: true }
  });

  const result = toPlain(module.importLessonGuideFromJson(criterionId, importedText));

  assert.equal(result.ok, true);
  assert.equal(result.guide.status, 'draft');
  assert.equal(result.guide.createdAt, existing.createdAt);
  assert.equal(result.guide.updatedAt, FIXED_THURSDAY);
  assert.equal(result.guide.migratedAt, existing.migratedAt);
  assert.deepEqual(result.guide.legacyContent, existing.legacyContent);
  assert.equal('sourcesCheckedAt' in result.guide, false);
  assert.equal(result.guide.why, 'Imported synthetic content');
});

test('produktowy widok Learning stawia bieżącą lekcję i uczciwe braki przed roadmapą', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const stage = app.api.ROADMAP_STAGES[0];
  const criterion = stage.criteria[0];
  const container = app.document.getElementById('view-it');

  module.render(container);

  const layout = container.querySelector('.learning-product-layout');
  assert.ok(layout);
  assert.deepEqual([...layout.children].map(element => element.classList.contains('learning-current-card') ? 'current' : 'roadmap'), ['current', 'roadmap']);
  assert.match(layout.querySelector('#learning-current-title').textContent, new RegExp(criterion.title));
  assert.match(layout.querySelector('.learning-current-purpose').textContent, new RegExp(stage.why));
  assert.match(layout.querySelector('.learning-current-guide').textContent, /Materiał do tej lekcji nie jest jeszcze przygotowany/);
  assert.match(layout.querySelector('.learning-completion').textContent, /Kryterium ukończenia/);
  assert.equal(layout.querySelectorAll('.learning-current-card .primary').length, 1);
  assert.equal(layout.querySelector('.learning-guide-advanced').open, false);
  assert.equal(layout.querySelector('.learning-guide-advanced textarea').closest('details').open, false);
  assert.equal(layout.querySelectorAll('.learning-roadmap-card > #roadmap-tree > details.stage-card').length, app.api.ROADMAP_STAGES.length);
  assert.equal([...layout.querySelectorAll('.learning-roadmap-card > #roadmap-tree > details.stage-card')].every(element => element.querySelector(':scope > summary.stage-head')), true);
  assert.doesNotMatch(layout.textContent, /ChatGPT|Claude|Codex/);
});

test('Learning pokazuje częściowy i pełny LessonGuide bez tworzenia brakującej treści', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const criterionId = app.api.ROADMAP_STAGES[0].criteria[0].id;
  const container = app.document.getElementById('view-it');

  app.api.Store.set('it:lessonGuides', {
    [criterionId]: lessonGuideRecord(criterionId, { why: 'Synthetic partial purpose' })
  });
  module.render(container);
  const partial = container.querySelector('.learning-current-guide');
  assert.match(partial.textContent, /Synthetic partial purpose/);
  assert.match(partial.textContent, /Nie zapisano materiału do otwarcia/);
  assert.match(partial.textContent, /Nie zapisano jeszcze kolejności wykonania/);
  assert.match(partial.textContent, /Nie zapisano jeszcze ćwiczenia praktycznego/);

  app.api.Store.set('it:lessonGuides', {
    [criterionId]: lessonGuideRecord(criterionId, lessonGuideContent({
      why: 'Synthetic complete purpose',
      resources: { documentation: [resource()], articles: [], videos: [], additional: [] },
      workOrder: [{ id: 'synthetic-step', order: 0, title: 'Synthetic instruction', description: 'Perform the step' }],
      exercises: [{ id: 'synthetic-exercise', title: 'Synthetic exercise', description: 'Complete it', difficulty: 2 }],
      selfTest: [{ id: 'synthetic-question', prompt: 'Synthetic check?', answer: 'Synthetic answer' }]
    }))
  });
  module.render(container);
  const complete = container.querySelector('.learning-current-card');
  assert.match(complete.textContent, /Synthetic complete purpose/);
  assert.match(complete.textContent, /Synthetic instruction/);
  assert.match(complete.textContent, /Synthetic exercise/);
  assert.match(complete.textContent, /Synthetic check/);
  const primaryLink = complete.querySelector('.product-primary-action a');
  assert.equal(primaryLink.href, 'https://example.test/documentation');
  assert.equal(primaryLink.target, '_blank');
  assert.equal(primaryLink.rel, 'noopener noreferrer');
});

test('disclosure roadmapy Learning nie zapisuje ani nie emituje, a mutacje zachowują logiczny fokus', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = learning(app.api);
  const stage = app.api.ROADMAP_STAGES[0];
  const currentId = stage.criteria[0].id;
  const secondId = stage.criteria[1].id;
  const container = app.document.getElementById('view-it');
  module.render(container);

  let writes = 0;
  let events = 0;
  const originalSet = app.api.Store.set;
  const originalEmit = app.api.EventBus.emit;
  app.api.Store.set = (...args) => { writes += 1; return originalSet(...args); };
  app.api.EventBus.emit = (...args) => { events += 1; return originalEmit(...args); };
  const stageDisclosure = container.querySelector(`[data-stage="${stage.id}"]`);
  stageDisclosure.querySelector(':scope > summary').click();
  stageDisclosure.querySelector(':scope > summary').click();
  const guideDisclosure = container.querySelector(`#guide-panel-${secondId}`).closest('details');
  guideDisclosure.querySelector(':scope > summary').click();
  assert.equal(writes, 0);
  assert.equal(events, 0);
  assert.equal(guideDisclosure.open, true);
  app.api.Store.set = originalSet;
  app.api.EventBus.emit = originalEmit;

  container.querySelector('#learning-create-current-guide').click();
  assert.equal(app.document.activeElement, container.querySelector('.learning-current-guide textarea'));
  const whyField = container.querySelector('.learning-current-guide textarea');
  whyField.value = 'Synthetic UI guide';
  whyField.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  container.querySelector('.learning-current-guide .learning-guide-form').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(module.getLessonGuide(currentId).why, 'Synthetic UI guide');
  assert.notEqual(app.document.activeElement, app.document.body);

  container.querySelector('#learning-complete-current').click();
  assert.equal(app.document.activeElement, container.querySelector('#learning-current-title'));
  assert.doesNotMatch(container.querySelector('#learning-current-title').textContent, new RegExp(currentId));

  const firstCheckbox = [...container.querySelectorAll('[data-criterion-checkbox]')]
    .find(input => input.dataset.criterionCheckbox === currentId);
  firstCheckbox.checked = false;
  firstCheckbox.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  const restoredCheckbox = [...container.querySelectorAll('[data-criterion-checkbox]')]
    .find(input => input.dataset.criterionCheckbox === currentId);
  assert.equal(app.document.activeElement, restoredCheckbox);
  assert.equal(restoredCheckbox.closest('details.stage-card').open, true);
});

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
  assert.equal(module.getTasks().length, first.criteria.length);
  assert.equal(module.getTasks().every(task => task.status === 'todo'), true);

  for (const criterion of first.criteria) module.setTaskStatus(criterion.id, 'done');

  const completedTasks = toPlain(module.getTasks());
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

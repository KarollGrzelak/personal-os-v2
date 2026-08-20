export const FIXED_MONDAY = '2026-08-17T08:00:00.000Z';
export const FIXED_THURSDAY = '2026-08-20T08:00:00.000Z';

export function trainingProfile(overrides = {}) {
  return {
    equipment: ['hantle', 'mata'],
    location: 'synthetic-home',
    experienceLevel: 'beginner',
    availableDays: [1, 3, 5],
    availableMinutesPerSession: 45,
    mainGoal: 'synthetic-strength-goal',
    limitations: '',
    baselineResults: { squatReps: 10, pushupReps: 5, plankSeconds: 30 },
    ...overrides
  };
}

export function lessonGuideContent(overrides = {}) {
  return {
    why: 'Synthetic learning purpose',
    skills: ['synthetic-skill'],
    prerequisites: ['synthetic-prerequisite'],
    resources: { documentation: [], articles: [], videos: [], additional: [] },
    workOrder: [],
    exercises: [],
    selfTest: [],
    commonMistakes: [],
    ...overrides
  };
}

export function lessonGuideRecord(criterionId, overrides = {}) {
  return {
    criterionId,
    ...lessonGuideContent(),
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z',
    status: 'draft',
    ...overrides
  };
}

export function resource(overrides = {}) {
  return {
    id: 'synthetic-resource',
    title: 'Synthetic documentation',
    url: 'https://example.test/documentation',
    sourceType: 'documentation',
    language: 'pl',
    checkedDate: '2026-08-10',
    ...overrides
  };
}

function roadmapStage(id, order, prerequisites) {
  return {
    id,
    order,
    name: `Synthetic stage ${order}`,
    description: 'Synthetic description',
    why: 'Synthetic ordering reason',
    prerequisites,
    willLearn: ['synthetic-topic'],
    skillsGained: ['synthetic-skill'],
    estimatedHours: 1,
    projects: [],
    finalTest: 'Synthetic final test',
    criteria: [{
      id: `synthetic-criterion-${order}`,
      title: `Synthetic criterion ${order}`,
      estimatedMinutes: 15,
      difficulty: 2,
      xp: 10
    }]
  };
}

export function linearRoadmap() {
  return [
    roadmapStage('synthetic-stage-1', 1, []),
    roadmapStage('synthetic-stage-2', 2, ['synthetic-stage-1'])
  ];
}

export function schoolItem(overrides = {}) {
  return {
    type: 'homework',
    subject: 'Synthetic subject',
    title: 'Synthetic assignment',
    dueDate: '2026-08-20',
    estimatedMinutes: 30,
    difficulty: 2,
    notes: '',
    activeDuringVacation: false,
    ...overrides
  };
}

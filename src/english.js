/* ============================================================
   MODUŁ / ENGLISH MVP
   Ręczna kolejka atomowych aktywności językowych. Warstwa jest
   ładowana po School i przed Backup. Podczas ładowania wyłącznie
   definiuje kontrakty oraz rejestruje EnglishModule — wszystkie
   odczyty Store, zdarzenia i operacje DOM są odroczone do jawnych
   wywołań po zakończeniu inicjalizacji skryptów.
   ============================================================ */

const ENGLISH_LEVELS = ['unknown', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ENGLISH_FOCUSES = ['technical', 'balanced', 'general'];
const ENGLISH_ACTIVITY_TYPES = [
  'technical-reading', 'general-reading', 'vocabulary',
  'listening', 'writing', 'speaking'
];
const ENGLISH_TASK_PRIORITY = 39;
const ENGLISH_TASK_XP = 15;
const ENGLISH_PROFILE_FIELDS = ['enabled', 'selfAssessedLevel', 'weeklyMinutes', 'focus'];
const ENGLISH_ACTIVITY_FIELDS = [
  'id', 'type', 'title', 'objective', 'resourceUrl', 'estimatedMinutes',
  'difficulty', 'status', 'completedDate', 'current'
];

const ENGLISH_LEVEL_LABELS = {
  unknown: 'Nieokreślony', A1: 'A1', A2: 'A2', B1: 'B1',
  B2: 'B2', C1: 'C1', C2: 'C2'
};
const ENGLISH_FOCUS_LABELS = {
  technical: 'Techniczny', balanced: 'Zrównoważony', general: 'Ogólny'
};
const ENGLISH_TYPE_LABELS = {
  'technical-reading': 'Czytanie techniczne',
  'general-reading': 'Czytanie ogólne',
  vocabulary: 'Słownictwo',
  listening: 'Słuchanie',
  writing: 'Pisanie',
  speaking: 'Mówienie'
};

function isEnglishPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasExactEnglishFields(value, expectedFields) {
  if (!isEnglishPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedFields].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validateEnglishProfile(raw) {
  const errors = [];
  if (!hasExactEnglishFields(raw, ENGLISH_PROFILE_FIELDS)) {
    return { valid: false, errors: ['Profil Angielskiego musi zawierać dokładnie pola: enabled, selfAssessedLevel, weeklyMinutes, focus'] };
  }
  if (typeof raw.enabled !== 'boolean') errors.push('enabled: wymagana wartość boolean');
  if (!ENGLISH_LEVELS.includes(raw.selfAssessedLevel)) errors.push('selfAssessedLevel: nieprawidłowa wartość');
  if (!Number.isInteger(raw.weeklyMinutes) || raw.weeklyMinutes < 15 || raw.weeklyMinutes > 840) {
    errors.push('weeklyMinutes: wymagana liczba całkowita 15-840');
  }
  if (!ENGLISH_FOCUSES.includes(raw.focus)) errors.push('focus: nieprawidłowa wartość');
  return { valid: errors.length === 0, errors };
}

function validateEnglishProfileValue(raw) {
  if (raw === null) return { valid: true, errors: [] };
  return validateEnglishProfile(raw);
}

// Normalizator formularza jest celowo osobny od ścisłego walidatora
// danych zapisanych/importowanych. Nie dopisuje wartości osobistych —
// jedynie trimuje kontrolowane pola i konwertuje input number.
function normalizeEnglishProfile(raw) {
  const base = isEnglishPlainObject(raw) ? raw : {};
  const levelRaw = base.selfAssessedLevel;
  const selfAssessedLevel = typeof levelRaw === 'string'
    ? (levelRaw.trim() === '' ? 'unknown' : levelRaw.trim())
    : levelRaw;
  const weeklyRaw = base.weeklyMinutes;
  const weeklyMinutes = typeof weeklyRaw === 'string' && weeklyRaw.trim() !== ''
    ? Number(weeklyRaw)
    : weeklyRaw;
  return {
    enabled: base.enabled,
    selfAssessedLevel,
    weeklyMinutes,
    focus: typeof base.focus === 'string' ? base.focus.trim() : base.focus
  };
}

function validateEnglishActivity(raw) {
  const errors = [];
  if (!hasExactEnglishFields(raw, ENGLISH_ACTIVITY_FIELDS)) {
    return { valid: false, errors: ['Aktywność Angielskiego ma nieprawidłowy zestaw pól'] };
  }

  if (typeof raw.id !== 'string' || raw.id.trim() !== raw.id || raw.id.length < 1 || raw.id.length > 128) {
    errors.push('id: wymagany trimowany string 1-128 znaków');
  }
  if (!ENGLISH_ACTIVITY_TYPES.includes(raw.type)) errors.push('type: nieprawidłowa wartość');
  if (typeof raw.title !== 'string' || raw.title.trim() !== raw.title || raw.title.length < 1 || raw.title.length > 120) {
    errors.push('title: wymagany trimowany string 1-120 znaków');
  }
  if (typeof raw.objective !== 'string' || raw.objective.trim() !== raw.objective || raw.objective.length < 1 || raw.objective.length > 500) {
    errors.push('objective: wymagany trimowany string 1-500 znaków');
  }
  if (raw.resourceUrl !== null) {
    if (typeof raw.resourceUrl !== 'string'
        || raw.resourceUrl.trim() !== raw.resourceUrl
        || raw.resourceUrl.length < 1
        || raw.resourceUrl.length > 2048
        || !isValidResourceUrl(raw.resourceUrl)) {
      errors.push('resourceUrl: null albo trimowany bezwzględny URL HTTP/HTTPS do 2048 znaków');
    }
  }
  if (!Number.isInteger(raw.estimatedMinutes) || raw.estimatedMinutes < 5 || raw.estimatedMinutes > 60) {
    errors.push('estimatedMinutes: wymagana liczba całkowita 5-60');
  }
  if (!Number.isInteger(raw.difficulty) || raw.difficulty < 1 || raw.difficulty > 5) {
    errors.push('difficulty: wymagana liczba całkowita 1-5');
  }
  if (!['todo', 'done', 'skipped'].includes(raw.status)) errors.push('status: nieprawidłowa wartość');
  if (typeof raw.current !== 'boolean') errors.push('current: wymagana wartość boolean');

  if (raw.status === 'done') {
    if (!isValidCalendarDateString(raw.completedDate)) errors.push('completedDate: status done wymaga poprawnej daty lokalnej');
  } else if (raw.completedDate !== null) {
    errors.push('completedDate: status todo/skipped wymaga null');
  }
  if (raw.current === true && raw.status !== 'todo') errors.push('current: tylko aktywność todo może być bieżąca');

  return { valid: errors.length === 0, errors };
}

function validateEnglishActivities(raw) {
  if (!Array.isArray(raw)) return { valid: false, errors: ['english:activities: wymagana tablica'] };
  const errors = [];
  const ids = new Set();
  let currentCount = 0;
  raw.forEach((activity, index) => {
    const check = validateEnglishActivity(activity);
    if (!check.valid) errors.push(`english:activities[${index}]: ${check.errors.join('; ')}`);
    if (activity && typeof activity.id === 'string') {
      if (ids.has(activity.id)) errors.push(`english:activities[${index}].id: duplikat "${activity.id}"`);
      ids.add(activity.id);
    }
    if (activity && activity.current === true) currentCount++;
  });
  if (currentCount > 1) errors.push('english:activities: najwyżej jedna aktywność może mieć current=true');
  return { valid: errors.length === 0, errors };
}

function normalizeEnglishActivityContent(raw) {
  const base = isEnglishPlainObject(raw) ? raw : {};
  const resourceRaw = base.resourceUrl;
  const resourceUrl = resourceRaw === null || resourceRaw === undefined
    ? null
    : (typeof resourceRaw === 'string' && resourceRaw.trim() === '' ? null
      : (typeof resourceRaw === 'string' ? resourceRaw.trim() : resourceRaw));
  const minutesRaw = base.estimatedMinutes;
  const difficultyRaw = base.difficulty;
  return {
    type: typeof base.type === 'string' ? base.type.trim() : base.type,
    title: typeof base.title === 'string' ? base.title.trim() : base.title,
    objective: typeof base.objective === 'string' ? base.objective.trim() : base.objective,
    resourceUrl,
    estimatedMinutes: typeof minutesRaw === 'string' && minutesRaw.trim() !== '' ? Number(minutesRaw) : minutesRaw,
    difficulty: typeof difficultyRaw === 'string' && difficultyRaw.trim() !== '' ? Number(difficultyRaw) : difficultyRaw
  };
}

function englishValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function generateEnglishActivityId(existingIds) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = `eng-${Date.now().toString(36)}-${Math.random().toString(36)}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  return null;
}

function englishMutationError(errors) {
  return { ok: false, changed: false, errors: Array.isArray(errors) ? errors : [String(errors)] };
}

function readEnglishActivitiesForMutation() {
  const activities = Store.get('english:activities', []);
  const check = validateEnglishActivities(activities);
  if (!check.valid) return englishMutationError(check.errors);
  return { ok: true, activities };
}

function emitEnglishProfileChanged(action, profile) {
  EventBus.emit('english:profileChanged', { action, enabled: profile.enabled });
}

function emitEnglishActivityChanged(activityId, action) {
  EventBus.emit('english:activityChanged', { activityId, action });
}

function englishTaskFromActivity(activity) {
  return {
    id: activity.id,
    moduleId: 'english',
    goalId: 'english',
    title: activity.title,
    why: activity.objective,
    estimatedMinutes: activity.estimatedMinutes,
    difficulty: activity.difficulty,
    xp: ENGLISH_TASK_XP,
    priority: ENGLISH_TASK_PRIORITY,
    planningClass: 'flexible',
    status: activity.status,
    completedDate: activity.completedDate,
    extra: { englishActivityType: activity.type }
  };
}

function refreshEnglishViews(module) {
  const container = document.getElementById('view-' + module.id);
  if (container) module.render(container);
}

const EnglishModule = {
  id: 'english',
  name: 'Angielski',

  getProfile() {
    return Store.get('english:profile', null);
  },

  getActivities() {
    return Store.get('english:activities', []);
  },

  saveProfile(raw) {
    const profile = normalizeEnglishProfile(raw);
    const check = validateEnglishProfile(profile);
    if (!check.valid) return englishMutationError(check.errors);
    const existing = this.getProfile();
    if (validateEnglishProfile(existing).valid && englishValuesEqual(existing, profile)) {
      return { ok: true, changed: false, profile: existing };
    }
    const previousEnabled = validateEnglishProfile(existing).valid && existing.enabled;
    Store.set('english:profile', profile);
    emitEnglishProfileChanged('saved', profile);
    if (previousEnabled !== profile.enabled) emitTasksChanged(this.id, 'configuration');
    refreshEnglishViews(this);
    return { ok: true, changed: true, profile };
  },

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') return englishMutationError(['enabled: wymagana wartość boolean']);
    const profile = this.getProfile();
    const check = validateEnglishProfile(profile);
    if (!check.valid) return englishMutationError(['Nie można zmienić ustawienia: profil Angielskiego jest nieskonfigurowany albo niepoprawny.']);
    if (profile.enabled === enabled) return { ok: true, changed: false, profile };
    const next = { ...profile, enabled };
    Store.set('english:profile', next);
    emitEnglishProfileChanged('enabled', next);
    emitTasksChanged(this.id, 'configuration');
    refreshEnglishViews(this);
    return { ok: true, changed: true, profile: next };
  },

  createActivity(raw) {
    const state = readEnglishActivitiesForMutation();
    if (!state.ok) return state;
    const content = normalizeEnglishActivityContent(raw);
    const id = generateEnglishActivityId(new Set(state.activities.map(activity => activity.id)));
    if (!id) return englishMutationError(['Nie udało się wygenerować unikalnego ID aktywności.']);
    const activity = {
      id,
      ...content,
      status: 'todo',
      completedDate: null,
      current: false
    };
    const check = validateEnglishActivity(activity);
    if (!check.valid) return englishMutationError(check.errors);
    const next = [...state.activities, activity];
    Store.set('english:activities', next);
    emitEnglishActivityChanged(id, 'created');
    emitTasksChanged(this.id, 'created');
    refreshEnglishViews(this);
    return { ok: true, changed: true, activity };
  },

  editActivity(activityId, raw) {
    const state = readEnglishActivitiesForMutation();
    if (!state.ok) return state;
    const index = state.activities.findIndex(activity => activity.id === activityId);
    if (index < 0) return englishMutationError(['Nie znaleziono aktywności.']);
    const content = normalizeEnglishActivityContent(raw);
    const candidate = { ...state.activities[index], ...content };
    const check = validateEnglishActivity(candidate);
    if (!check.valid) return englishMutationError(check.errors);
    if (englishValuesEqual(candidate, state.activities[index])) {
      return { ok: true, changed: false, activity: state.activities[index] };
    }
    const next = state.activities.map((activity, i) => i === index ? candidate : activity);
    Store.set('english:activities', next);
    emitEnglishActivityChanged(activityId, 'edited');
    emitTasksChanged(this.id, 'updated');
    refreshEnglishViews(this);
    return { ok: true, changed: true, activity: candidate };
  },

  setCurrentActivity(activityId) {
    const state = readEnglishActivitiesForMutation();
    if (!state.ok) return state;
    const target = state.activities.find(activity => activity.id === activityId);
    if (!target) return englishMutationError(['Nie znaleziono aktywności.']);
    if (target.status !== 'todo') return englishMutationError(['Tylko aktywność todo może być bieżąca.']);
    if (target.current) return { ok: true, changed: false, activity: target };
    const next = state.activities.map(activity => ({
      ...activity,
      current: activity.id === activityId
    }));
    Store.set('english:activities', next);
    emitEnglishActivityChanged(activityId, 'current');
    emitTasksChanged(this.id, 'selection');
    refreshEnglishViews(this);
    return { ok: true, changed: true, activity: next.find(activity => activity.id === activityId) };
  },

  setTaskStatus(activityId, status) {
    if (!['todo', 'done', 'skipped'].includes(status)) return englishMutationError(['Nieobsługiwany status aktywności.']);
    const state = readEnglishActivitiesForMutation();
    if (!state.ok) return state;
    const index = state.activities.findIndex(activity => activity.id === activityId);
    if (index < 0) return englishMutationError(['Nie znaleziono aktywności.']);
    const current = state.activities[index];
    if (current.status === status) return { ok: true, changed: false, activity: current };

    let nextActivity;
    if (status === 'done' && current.status === 'todo') {
      nextActivity = { ...current, status: 'done', completedDate: localDateKey(), current: false };
    } else if (status === 'skipped' && current.status === 'todo') {
      nextActivity = { ...current, status: 'skipped', completedDate: null, current: false };
    } else if (status === 'todo' && current.status === 'done') {
      const profile = this.getProfile();
      const canRestoreCurrent = validateEnglishProfile(profile).valid
        && profile.enabled
        && !state.activities.some((activity, i) => i !== index && activity.current === true);
      nextActivity = { ...current, status: 'todo', completedDate: null, current: canRestoreCurrent };
    } else if (status === 'todo' && current.status === 'skipped') {
      nextActivity = { ...current, status: 'todo', completedDate: null, current: false };
    } else {
      return englishMutationError([`Niedozwolone przejście statusu: ${current.status} -> ${status}.`]);
    }

    const check = validateEnglishActivity(nextActivity);
    if (!check.valid) return englishMutationError(check.errors);
    const next = state.activities.map((activity, i) => i === index ? nextActivity : activity);
    const containerCheck = validateEnglishActivities(next);
    if (!containerCheck.valid) return englishMutationError(containerCheck.errors);
    Store.set('english:activities', next);
    emitEnglishActivityChanged(activityId, 'status');
    EventBus.emit('task:status', { moduleId: this.id, taskId: activityId, status });
    refreshEnglishViews(this);
    return { ok: true, changed: true, activity: nextActivity };
  },

  deleteActivity(activityId) {
    const state = readEnglishActivitiesForMutation();
    if (!state.ok) return state;
    const target = state.activities.find(activity => activity.id === activityId);
    if (!target) return englishMutationError(['Nie znaleziono aktywności.']);
    if (!confirm('Usunąć tę aktywność Angielskiego? Tej operacji nie można cofnąć.')) {
      return { ok: true, changed: false, cancelled: true };
    }
    const next = state.activities.filter(activity => activity.id !== activityId);
    Store.set('english:activities', next);
    emitEnglishActivityChanged(activityId, 'deleted');
    emitTasksChanged(this.id, 'deleted');
    refreshEnglishViews(this);
    return { ok: true, changed: true };
  },

  getTasks(date) {
    assertPlanningDate(date);
    const activities = this.getActivities();
    if (!validateEnglishActivities(activities).valid) return [];
    const profile = this.getProfile();
    const profileEnabled = validateEnglishProfile(profile).valid && profile.enabled;
    return activities
      .filter(activity => (profileEnabled && activity.status === 'todo' && activity.current)
        || (activity.status === 'done' && activity.completedDate === date))
      .map(englishTaskFromActivity);
  },

  getStats() {
    const activities = this.getActivities();
    if (!validateEnglishActivities(activities).valid) return { done: 0, total: 0, label: this.name };
    return {
      done: activities.filter(activity => activity.status === 'done').length,
      total: activities.length,
      label: this.name
    };
  },

  render(container) {
    renderEnglishModuleView(this, container);
  }
};

function renderEnglishErrors(target, errors) {
  if (!target) return;
  target.style.display = 'block';
  target.textContent = (errors || []).join(' · ');
}

function refreshEnglishAfterMutation(module, container, result) {
  return !!(result.ok && result.changed);
}

function renderEnglishProfileForm(module, container, host, profile) {
  const validProfile = validateEnglishProfile(profile).valid ? profile : null;
  const selectedLevel = validProfile?.selfAssessedLevel ?? 'unknown';
  host.innerHTML = `
    ${profile === null ? '<p>Profil nie jest jeszcze skonfigurowany. Uzupełnij poniższe pola, aby go utworzyć.</p>' : ''}
    ${profile !== null && !validProfile ? '<div class="banner-warn">Dane profilu Angielskiego są niepoprawne. Zapisz poprawny profil; istniejące dane nie zostaną automatycznie naprawione ani usunięte.</div>' : ''}
    <div class="profile-form">
      <div class="field-row">
        <label>Moduł aktywny</label>
        <input type="checkbox" id="english-profile-enabled" ${validProfile?.enabled ? 'checked' : ''}>
      </div>
      <div class="field-row">
        <label>Poziom</label>
        <select id="english-profile-level">
          <option value="">wybierz</option>
          ${ENGLISH_LEVELS.map(level => `<option value="${level}" ${selectedLevel === level ? 'selected' : ''}>${ENGLISH_LEVEL_LABELS[level]}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <label>Minuty tygodniowo</label>
        <input type="number" id="english-profile-weekly" min="15" max="840" step="1" value="${escapeAttr(validProfile?.weeklyMinutes ?? '')}" placeholder="15-840">
      </div>
      <div class="field-row">
        <label>Kierunek</label>
        <select id="english-profile-focus">
          <option value="">wybierz</option>
          ${ENGLISH_FOCUSES.map(focus => `<option value="${focus}" ${validProfile?.focus === focus ? 'selected' : ''}>${ENGLISH_FOCUS_LABELS[focus]}</option>`).join('')}
        </select>
      </div>
      <p>Minuty tygodniowo są w MVP wyłącznie informacją — nie zmieniają automatycznie planu dnia ani priorytetu.</p>
      <div class="field-row">
        <button class="primary" id="english-profile-save">Zapisz profil</button>
        ${validProfile ? '<button class="ghost" id="english-profile-cancel">Anuluj</button>' : ''}
      </div>
      <div id="english-profile-errors" style="display:none;color:#f87171;font-size:12px;"></div>
    </div>
  `;

  const saveButton = host.querySelector('#english-profile-save');
  saveButton.addEventListener('click', () => {
    const result = module.saveProfile({
      enabled: host.querySelector('#english-profile-enabled').checked,
      selfAssessedLevel: host.querySelector('#english-profile-level').value,
      weeklyMinutes: host.querySelector('#english-profile-weekly').value,
      focus: host.querySelector('#english-profile-focus').value
    });
    if (!result.ok) {
      renderEnglishErrors(host.querySelector('#english-profile-errors'), result.errors);
      return;
    }
    if (!refreshEnglishAfterMutation(module, container, result)) {
      const status = host.querySelector('#english-profile-errors');
      status.style.display = 'block';
      status.style.color = 'var(--text3)';
      status.textContent = 'Brak zmian do zapisania.';
    }
  });
  host.querySelector('#english-profile-cancel')?.addEventListener('click', () => module.render(container));
}

function renderEnglishActivityForm(module, container, host, existing) {
  host.innerHTML = `
    <div class="profile-form" style="margin-top:12px;">
      <div class="field-row">
        <select id="english-activity-type">
          <option value="">typ aktywności</option>
          ${ENGLISH_ACTIVITY_TYPES.map(type => `<option value="${type}" ${existing?.type === type ? 'selected' : ''}>${ENGLISH_TYPE_LABELS[type]}</option>`).join('')}
        </select>
        <input type="text" id="english-activity-title" maxlength="120" value="${escapeAttr(existing?.title ?? '')}" placeholder="Tytuł" style="width:220px;">
      </div>
      <div class="field-row">
        <label>Cel aktywności</label>
        <textarea id="english-activity-objective" maxlength="500" rows="2" style="width:100%;">${escapeHtml(existing?.objective ?? '')}</textarea>
      </div>
      <div class="field-row">
        <label>Zasób (opcjonalnie)</label>
        <input type="url" id="english-activity-url" maxlength="2048" value="${escapeAttr(existing?.resourceUrl ?? '')}" placeholder="https://..." style="width:280px;">
      </div>
      <div class="field-row">
        <input type="number" id="english-activity-minutes" min="5" max="60" step="1" value="${escapeAttr(existing?.estimatedMinutes ?? '')}" placeholder="minuty" style="width:100px;">
        <select id="english-activity-difficulty">
          <option value="">trudność</option>
          ${[1,2,3,4,5].map(value => `<option value="${value}" ${existing?.difficulty === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
        <button class="primary" id="english-activity-save">${existing ? 'Zapisz edycję' : 'Dodaj aktywność'}</button>
        ${existing ? '<button class="ghost" id="english-activity-cancel">Anuluj</button>' : ''}
      </div>
      <div id="english-activity-errors" style="display:none;color:#f87171;font-size:12px;"></div>
    </div>
  `;

  host.querySelector('#english-activity-save').addEventListener('click', () => {
    const raw = {
      type: host.querySelector('#english-activity-type').value,
      title: host.querySelector('#english-activity-title').value,
      objective: host.querySelector('#english-activity-objective').value,
      resourceUrl: host.querySelector('#english-activity-url').value,
      estimatedMinutes: host.querySelector('#english-activity-minutes').value,
      difficulty: host.querySelector('#english-activity-difficulty').value
    };
    const result = existing
      ? module.editActivity(existing.id, raw)
      : module.createActivity(raw);
    if (!result.ok) {
      renderEnglishErrors(host.querySelector('#english-activity-errors'), result.errors);
      return;
    }
    if (!refreshEnglishAfterMutation(module, container, result)) {
      const status = host.querySelector('#english-activity-errors');
      status.style.display = 'block';
      status.style.color = 'var(--text3)';
      status.textContent = 'Brak zmian do zapisania.';
    }
  });
  host.querySelector('#english-activity-cancel')?.addEventListener('click', () => module.render(container));
}

function renderEnglishResource(activity) {
  if (activity.resourceUrl === null) return '';
  if (!isValidResourceUrl(activity.resourceUrl)) {
    return '<span style="color:#f87171;font-size:12px;">Nieprawidłowy adres zasobu — link został zablokowany.</span>';
  }
  return `<a href="${escapeAttr(activity.resourceUrl)}" target="_blank" rel="noopener noreferrer">Otwórz zasób</a>`;
}

function renderEnglishActivityRow(activity, context) {
  const statusLabel = activity.status === 'done' ? 'Ukończone'
    : activity.status === 'skipped' ? 'Pominięte'
      : activity.current ? 'Bieżące' : 'W kolejce';
  const actionButtons = activity.status === 'todo'
    ? `${activity.current ? '' : '<button class="ghost" data-english-action="current">Ustaw jako bieżące</button>'}
       <button class="ghost" data-english-action="done">Ukończ</button>
       <button class="ghost" data-english-action="skipped">Pomiń</button>`
    : '<button class="ghost" data-english-action="todo">Przywróć do kolejki</button>';
  return `
    <div class="exercise-card" data-english-id="${escapeAttr(activity.id)}" data-english-context="${escapeAttr(context)}">
      <div class="ex-head">
        <span class="ex-name">${escapeHtml(activity.title)}</span>
        <span class="badge ${activity.status === 'done' ? 'ok' : activity.current ? 'warn' : ''}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="ex-detail"><b>Typ</b>${escapeHtml(ENGLISH_TYPE_LABELS[activity.type])}</div>
      <div class="ex-detail"><b>Cel</b>${escapeHtml(activity.objective)}</div>
      <div class="ex-detail"><b>Plan</b>${activity.estimatedMinutes} min · trudność ${activity.difficulty} · priorytet ${ENGLISH_TASK_PRIORITY}</div>
      ${activity.completedDate ? `<div class="ex-detail"><b>Data ukończenia</b>${escapeHtml(activity.completedDate)}</div>` : ''}
      ${activity.resourceUrl !== null ? `<div class="ex-detail"><b>Materiał</b>${renderEnglishResource(activity)} <span class="pillar-tag">Jakość i aktualność oceń ręcznie.</span></div>` : ''}
      <div class="field-row" style="margin-top:8px;">
        ${actionButtons}
        <button class="ghost" data-english-action="edit">Edytuj treść</button>
        <button class="ghost" data-english-action="delete">Usuń</button>
      </div>
    </div>
  `;
}

function renderEnglishModuleView(module, container) {
  const profile = module.getProfile();
  const profileCheck = validateEnglishProfileValue(profile);
  const profileIsValid = profile !== null && profileCheck.valid;
  const activities = module.getActivities();
  const activitiesCheck = validateEnglishActivities(activities);

  container.innerHTML = `
    <div class="card">
      <h3>🇬🇧 Profil Angielskiego</h3>
      <div id="english-profile-content"></div>
    </div>
    <div class="card">
      <h3>📚 Aktywności Angielskiego</h3>
      <p>Ręcznie wybierasz najwyżej jedną bieżącą aktywność. Moduł nie generuje treści ani nie sprawdza automatycznie jakości materiałów.</p>
      <div id="english-activities-content"></div>
    </div>
  `;

  const profileHost = container.querySelector('#english-profile-content');
  if (!profileIsValid) {
    renderEnglishProfileForm(module, container, profileHost, profile);
  } else {
    profileHost.innerHTML = `
      <div class="field-row">
        <span class="badge ${profile.enabled ? 'ok' : 'warn'}">${profile.enabled ? 'Moduł aktywny' : 'Moduł wyłączony'}</span>
        <span class="badge">Poziom: ${escapeHtml(ENGLISH_LEVEL_LABELS[profile.selfAssessedLevel])}</span>
        <span class="badge">${profile.weeklyMinutes} min/tydz. — informacyjnie</span>
        <span class="badge">${escapeHtml(ENGLISH_FOCUS_LABELS[profile.focus])}</span>
      </div>
      <div class="field-row">
        <label style="width:auto;display:flex;gap:6px;align-items:center;">
          <input type="checkbox" id="english-enabled-toggle" ${profile.enabled ? 'checked' : ''}> aktywny
        </label>
        <button class="ghost" id="english-profile-edit">Edytuj profil</button>
      </div>
      <div id="english-profile-toggle-errors" style="display:none;color:#f87171;font-size:12px;"></div>
    `;
    profileHost.querySelector('#english-enabled-toggle').addEventListener('change', event => {
      const result = module.setEnabled(event.target.checked);
      if (!result.ok) {
        event.target.checked = profile.enabled;
        renderEnglishErrors(profileHost.querySelector('#english-profile-toggle-errors'), result.errors);
        return;
      }
      refreshEnglishAfterMutation(module, container, result);
    });
    profileHost.querySelector('#english-profile-edit').addEventListener('click', () => {
      renderEnglishProfileForm(module, container, profileHost, profile);
    });
  }

  const activitiesHost = container.querySelector('#english-activities-content');
  if (!activitiesCheck.valid) {
    activitiesHost.innerHTML = `
      <div class="banner-warn">Dane english:activities są niepoprawne. Mutacje zostały zablokowane, aby nie nadpisać istniejącej zawartości. MVP nie wykonuje automatycznej naprawy.</div>
      <div class="log">${activitiesCheck.errors.map(error => `<div>${escapeHtml(error)}</div>`).join('')}</div>
    `;
    return;
  }

  const current = activities.find(activity => activity.current) || null;
  const queued = activities.filter(activity => activity.status === 'todo' && !activity.current);
  const history = activities.filter(activity => activity.status === 'done' || activity.status === 'skipped');
  activitiesHost.innerHTML = `
    <div id="english-activity-form"></div>
    <div id="english-action-errors" style="display:none;color:#f87171;font-size:12px;margin:8px 0;"></div>
    <div class="pillar-tag" style="margin:14px 0 6px;">Bieżąca aktywność</div>
    <div id="english-current-list">${current ? renderEnglishActivityRow(current, 'current') : '<p style="color:var(--text3);font-size:12px;">Brak bieżącej aktywności — wybierz ją ręcznie z kolejki.</p>'}</div>
    <div class="pillar-tag" style="margin:14px 0 6px;">Kolejka (${queued.length})</div>
    <div id="english-queue-list">${queued.map(activity => renderEnglishActivityRow(activity, 'queue')).join('') || '<p style="color:var(--text3);font-size:12px;">Kolejka jest pusta.</p>'}</div>
    <div class="pillar-tag" style="margin:14px 0 6px;">Historia (${history.length})</div>
    <div id="english-history-list">${history.map(activity => renderEnglishActivityRow(activity, 'history')).join('') || '<p style="color:var(--text3);font-size:12px;">Brak historii.</p>'}</div>
  `;
  renderEnglishActivityForm(module, container, activitiesHost.querySelector('#english-activity-form'), null);

  activitiesHost.querySelectorAll('[data-english-action]').forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-english-id]');
      const activityId = card.dataset.englishId;
      const activity = activities.find(item => item.id === activityId);
      const action = button.dataset.englishAction;
      if (action === 'edit') {
        renderEnglishActivityForm(module, container, activitiesHost.querySelector('#english-activity-form'), activity);
        return;
      }
      let result;
      if (action === 'current') result = module.setCurrentActivity(activityId);
      else if (action === 'delete') result = module.deleteActivity(activityId);
      else result = module.setTaskStatus(activityId, action);
      if (!result.ok) {
        renderEnglishErrors(activitiesHost.querySelector('#english-action-errors'), result.errors);
        return;
      }
      refreshEnglishAfterMutation(module, container, result);
    });
  });
}

ModuleRegistry.register(EnglishModule);

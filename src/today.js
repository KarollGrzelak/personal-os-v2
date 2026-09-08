/* ============================================================
   ENGINE / DayEngine
   Odpowiedzialność: jedna rzecz — liczy energię na dziś na
   podstawie snu (i w przyszłości, gdy powstanie moduł Trening,
   także wczorajszego obciążenia treningowego). Nie wie nic
   o zadaniach ani priorytetach — to rola PriorityEngine/
   DecisionEngine w Kroku 3.
   ============================================================ */
const DayEngine = (() => {
  function todayKey() { return localDateKey(); }

  function getRecord(date) {
    const recs = Store.get('dayRecords', {});
    return recs[date] || null;
  }

  // Sen 8-9h + dobra jakość = wysoka energia. To celowo prosta,
  // czytelna formuła — nie czarna skrzynka.
  function computeEnergy(sleepHours, sleepQuality, trainingLoadYesterday = 0) {
    const sleepScore = Math.min(100, (sleepHours / 9) * 70 + (sleepQuality / 5) * 30);
    const fatigue = Math.min(20, trainingLoadYesterday / 5);
    return Math.max(0, Math.round(sleepScore - fatigue));
  }

  function advice(energy) {
    if (energy >= 75) return { level: 'wysoka', text: 'Świetna energia — możesz iść pełną parą z najtrudniejszymi zadaniami dnia.' };
    if (energy >= 50) return { level: 'średnia', text: 'Energia w normie — trzymaj się planu, bez dokładania dodatkowych rzeczy.' };
    return { level: 'niska', text: 'Niska energia — dziś priorytet to regeneracja: lżejszy trening, nauka w mniejszych dawkach.' };
  }

  // Zapisuje obciążenie treningowe dla danej daty w DayRecord.
  // Wywoływane przez moduł Trening (Krok 4) po każdej zmianie w logu
  // ćwiczeń — DayEngine NIE zna szczegółów treningu (serie, RPE),
  // dostaje już gotową, wyliczoną liczbę. To Core udostępnia miejsce
  // w DayRecord, moduł dostarcza wartość — kierunek zależności jest
  // jednostronny (Training → DayEngine), zgodnie z architekturą v2.
  function recordTrainingLoad(date, load) {
    const recs = Store.get('dayRecords', {});
    recs[date] = { ...(recs[date] || { date }), trainingLoad: load };
    Store.set('dayRecords', recs);
  }

  function getTrainingLoad(date) {
    const rec = getRecord(date);
    return rec && typeof rec.trainingLoad === 'number' ? rec.trainingLoad : 0;
  }

  // checkIn() sam sięga po WCZORAJSZE obciążenie treningowe —
  // parametr trainingLoadYesterday w computeEnergy() był gotowy od
  // Kroku 2, ale zawsze dostawał 0, bo modułu Trening jeszcze nie
  // było. Od Kroku 4 dostaje realną wartość, bez zmiany sygnatury.
  function checkIn(hours, quality) {
    const date = todayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLoad = getTrainingLoad(localDateKey(yesterday));

    const recs = Store.get('dayRecords', {});
    const energyScore = computeEnergy(hours, quality, yesterdayLoad);
    recs[date] = { ...(recs[date] || {}), date, sleepHours: hours, sleepQuality: quality, energyScore };
    Store.set('dayRecords', recs);
    EventBus.emit('day:checkin', recs[date]);
    return recs[date];
  }

  return { todayKey, getRecord, computeEnergy, advice, checkIn, recordTrainingLoad, getTrainingLoad };
})();

/* ============================================================
   ENGINE / HabitEngine
   Odpowiedzialność: nawyki niezależne od sezonów (patrz sekcja
   architektury "System nawyków"). Streak liczony per nawyk,
   nie jeden globalny — jeden urwany nawyk nie zeruje reszty.
   ============================================================ */
const DEFAULT_HABITS = [
  // goalPillar dokumentuje, KTÓREMU z 3 filarów służy nawyk —
  // zgodnie z zasadą "każda funkcja ma uzasadnienie".
  { id: 'sleep8', label: '8-9h snu', goalPillar: 'physique', xp: 40, frequency: 'daily', active: true },
  { id: 'water', label: 'Woda jako główny napój dziś', goalPillar: 'physique', xp: 10, frequency: 'daily', active: true },
  { id: 'focus', label: 'Brak bezmyślnego scrollowania poza zaplanowanym czasem', goalPillar: 'it-job', xp: 15, frequency: 'daily', active: true },
  { id: 'note', label: 'Notatka dnia zapisana (czego się nauczyłem)', goalPillar: 'it-job', xp: 15, frequency: 'daily', active: true }
];

const HabitEngine = (() => {
  function defs() { return Store.get('habitDefs', DEFAULT_HABITS); }

  function isDone(habitId, date) {
    const logs = Store.get('habitLogs', {});
    return !!(logs[habitId] && logs[habitId][date]);
  }

  function log(habitId, date, done) {
    const logs = Store.get('habitLogs', {});
    logs[habitId] = logs[habitId] || {};
    logs[habitId][date] = done;
    Store.set('habitLogs', logs);
    EventBus.emit('habit:change', { habitId, date, done });
  }

  // Streak liczony wstecz. BŁĄD Z KROKU 3: jeśli dziś jeszcze
  // nieodhaczone, pętla startowała OD DZIŚ, nie znajdowała wpisu
  // i przerywała się natychmiast — seria z poprzednich dni znikała
  // z UI rano, zanim użytkownik zdążył cokolwiek zrobić. Poprawka:
  // gdy dziś puste, start liczenia przesuwamy na wczoraj — seria
  // "wciąż żyje" aż do końca dzisiejszego dnia.
  function streak(habitId) {
    const logs = Store.get('habitLogs', {});
    const today = localDateKey();
    let s = 0;
    let d = new Date();
    if (!(logs[habitId] && logs[habitId][today])) {
      d.setDate(d.getDate() - 1); // dziś puste — zaczynamy liczyć od wczoraj
    }
    for (let i = 0; i < 365; i++) {
      const k = localDateKey(d);
      if (logs[habitId] && logs[habitId][k]) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  }

  return { defs, isDone, log, streak };
})();

/* ============================================================
   WIDOK: Dziś
   Łączy DayEngine (energia z snu) i HabitEngine (nawyki).
   To pierwszy realny ekran aplikacji — reszta (zadania modułów,
   filtrowanie wg priorytetów) dojdzie w Kroku 3, gdy powstanie
   PriorityEngine/DecisionEngine.
   ============================================================ */
let todayPlanLastRenderedDate = null;

function renderDzis(now = new Date()) {
  const container = document.getElementById('view-dzis');
  const date = localDateKey(now);
  const record = DayEngine.getRecord(date);
  const savedBudgetKey = Store.get('ui:timeBudget', 'normal');

  container.innerHTML = `
    <div class="card">
      <h3>😴 Poranny check-in</h3>
      ${record ? `
        <div class="energy-ring">
          <div class="energy-num" style="color:var(--blue);">${record.energyScore}</div>
          <div>
            <div class="badge ${record.energyScore >= 75 ? 'ok' : record.energyScore >= 50 ? '' : 'warn'}">${DayEngine.advice(record.energyScore).level} energia</div>
            <p style="margin:8px 0 0;max-width:420px;">${DayEngine.advice(record.energyScore).text}</p>
          </div>
        </div>
        <button class="ghost" style="margin-top:12px;" id="edit-checkin">zmień check-in</button>
      ` : `
        <p>Ile spałeś dziś w nocy i jak oceniasz jakość snu?</p>
        <div class="field-row">
          <label>Godziny snu</label>
          <input type="number" id="sleep-hours" min="0" max="14" step="0.5" placeholder="np. 7.5" style="width:100px;">
        </div>
        <div class="field-row">
          <label>Jakość (1-5)</label>
          <div class="quality-btns" id="quality-btns">
            ${[1,2,3,4,5].map(n => `<button class="qbtn" data-q="${n}">${n}</button>`).join('')}
          </div>
        </div>
        <button class="primary" id="save-checkin" style="margin-top:6px;">Zapisz check-in</button>
      `}
    </div>

    <div class="card">
      <h3>⏱️ Ile masz dziś czasu?</h3>
      <div class="field-row" id="time-budget-row">
        ${TIME_BUDGETS.map(b => `<button class="ghost time-btn" data-key="${b.key}">${b.label}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>✅ Twoje zadania na dziś</h3>
      <div id="day-context-notes"></div>
      <div id="today-tasks"></div>
    </div>

    <div class="card">
      <h3>🎯 Nawyki dnia</h3>
      <p>Niezależne od sezonów — jeden urwany nawyk nie zeruje pozostałych. Streak liczony osobno dla każdego.</p>
      <div id="habit-list"></div>
    </div>
  `;

  // --- check-in snu ---
  let selectedQuality = 0;
  if (!record) {
    const qBtns = container.querySelectorAll('.qbtn');
    qBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedQuality = parseInt(btn.dataset.q);
        qBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    container.querySelector('#save-checkin').addEventListener('click', () => {
      const hours = parseFloat(document.getElementById('sleep-hours').value);
      if (!hours || isNaN(hours) || !selectedQuality) {
        alert('Podaj godziny snu i wybierz jakość (1-5).');
        return;
      }
      DayEngine.checkIn(hours, selectedQuality);
    });
  } else {
    container.querySelector('#edit-checkin').addEventListener('click', () => {
      const recs = Store.get('dayRecords', {});
      delete recs[date];
      Store.set('dayRecords', recs);
      renderDzis();
    });
  }

  // --- wybór budżetu czasu ---
  const timeBtns = container.querySelectorAll('.time-btn');
  function markActiveBudget(key) {
    timeBtns.forEach(b => b.classList.toggle('active', b.dataset.key === key));
  }
  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      Store.set('ui:timeBudget', btn.dataset.key);
      markActiveBudget(btn.dataset.key);
      renderTodayTasks();
    });
  });
  markActiveBudget(savedBudgetKey);

  renderTodayTasks(now);
  renderHabitList();
}

function clearTodayNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function createTodayNode(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}

const todayTaskActionTargets = new WeakMap();

function todayBudgetSourceLabel(source) {
  if (source === 'manual') return 'budżet ręczny';
  if (source === 'manual-within-availability') return 'budżet ręczny w granicach dostępności';
  if (source === 'manual-capped-by-availability') return 'budżet ograniczony dostępnością';
  return 'źródło budżetu niedostępne';
}

function todayPlanningClassLabel(planningClass) {
  if (planningClass === 'urgent') return 'pilne';
  if (planningClass === 'scheduled') return 'zaplanowane';
  if (planningClass === 'flexible') return 'elastyczne';
  return 'status planistyczny niedostępny';
}

function todayDeferredMessage(reason) {
  const messages = {
    ENERGY_TOO_LOW: 'Odłożone z powodu zbyt niskiej energii.',
    NO_AVAILABILITY: 'Brak zadeklarowanej dostępności w tym dniu.',
    NO_REMAINING_AVAILABILITY: 'Dzisiejsze dostępne przedziały już minęły.',
    BUDGET_EXHAUSTED: 'Zadanie nie mieści się w pozostałym budżecie.',
    NO_FITTING_WINDOW: 'Zadanie nie mieści się w żadnym pojedynczym oknie.',
    SELECTION_LIMIT_REACHED: 'Osiągnięto limit liczby zadań w planie.',
    DOMAIN_TURN_NOT_REACHED: 'Limit planu zatrzymał pierwszą rundę tej domeny.'
  };
  return messages[reason] || 'Zadanie zostało odłożone z bezpiecznie ukrytego powodu.';
}

function todayWarningMessage(code) {
  const messages = {
    MODULE_TASKS_UNAVAILABLE: 'Jedno ze źródeł zadań jest chwilowo niedostępne.',
    INVALID_TASK: 'Jedno ze źródeł zawiera niepoprawne zadanie i zostało pominięte.',
    AVAILABILITY_NOT_CONFIGURED: 'Dostępność nie jest skonfigurowana — używam wyłącznie ręcznego budżetu.',
    CHECK_IN_MISSING: 'Brak porannego check-inu — trudność zadań nie jest filtrowana.',
    INVALID_ENERGY: 'Zapis energii jest niepoprawny — trudność zadań nie jest filtrowana.'
  };
  return messages[code] || 'Plan zawiera dodatkowe ostrzeżenie.';
}

function todayFatalMessage(code) {
  const messages = {
    INVALID_INPUT: 'Nie można przygotować planu z bieżących danych.',
    INVALID_BUDGET: 'Wybrany budżet czasu jest niepoprawny.',
    INVALID_AVAILABILITY: 'Konfiguracja dostępności jest niepoprawna.',
    TASK_SOURCES_UNAVAILABLE: 'Żadne źródło zadań nie jest obecnie dostępne.'
  };
  return messages[code] || 'Nie udało się bezpiecznie przygotować planu dnia.';
}

function todayExcludedMessage(reason) {
  if (reason === 'STATUS_DONE') return 'Ukończone w innym dniu.';
  if (reason === 'STATUS_SKIPPED') return 'Pominięte.';
  if (reason === 'INVALID_TASK') return 'Niepoprawne zadanie zostało bezpiecznie wykluczone.';
  return 'Zadanie zostało bezpiecznie wykluczone.';
}

function appendTodayTaskSummary(parent, task, options = {}) {
  const row = createTodayNode('div', `today-plan-task item${options.done ? ' done' : ''}${task.planningClass === 'urgent' ? ' urgent' : ''}`);
  if (options.action === 'complete') {
    const checkbox = createTodayNode('input', 'cb');
    checkbox.type = 'checkbox';
    checkbox.dataset.module = task.moduleId;
    checkbox.dataset.task = task.taskId;
    checkbox.dataset.action = 'complete';
    checkbox.setAttribute('aria-label', `Ukończ: ${task.title}`);
    todayTaskActionTargets.set(checkbox, { moduleId: task.moduleId, taskId: task.taskId });
    row.appendChild(checkbox);
  }

  const body = createTodayNode('div', 'today-plan-task-body');
  body.appendChild(createTodayNode('div', 'today-plan-task-title', task.title || 'Zadanie bez tytułu'));
  const meta = createTodayNode('div', 'today-plan-task-meta');
  meta.appendChild(createTodayNode('span', '', task.moduleName || task.moduleId || 'Nieznana domena'));
  if (Number.isInteger(task.estimatedMinutes)) meta.appendChild(createTodayNode('span', '', `${task.estimatedMinutes} min`));
  if (Number.isInteger(task.difficulty)) meta.appendChild(createTodayNode('span', '', `trudność ${task.difficulty}`));
  if (task.planningClass) meta.appendChild(createTodayNode('span', '', todayPlanningClassLabel(task.planningClass)));
  if (task.slot && typeof task.slot.start === 'string' && typeof task.slot.end === 'string') {
    meta.appendChild(createTodayNode('span', 'today-plan-slot', `${task.slot.start}–${task.slot.end}`));
  }
  if (Number.isInteger(task.executionOrder)) meta.appendChild(createTodayNode('span', '', `kolejność ${task.executionOrder}`));
  body.appendChild(meta);
  if (typeof task.why === 'string' && task.why) body.appendChild(createTodayNode('div', 'today-plan-why', task.why));
  if (options.message) body.appendChild(createTodayNode('div', 'today-plan-reason', options.message));
  row.appendChild(body);

  if (options.action === 'undo') {
    const button = createTodayNode('button', 'ghost', 'cofnij');
    button.type = 'button';
    button.dataset.module = task.moduleId;
    button.dataset.task = task.taskId;
    button.dataset.action = 'undo';
    todayTaskActionTargets.set(button, { moduleId: task.moduleId, taskId: task.taskId });
    row.appendChild(button);
  }
  parent.appendChild(row);
}

function delegateTodayTaskStatus(moduleId, taskId, status) {
  const owner = ModuleRegistry.get(moduleId);
  if (!owner || typeof owner.setTaskStatus !== 'function') return { ok: false, changed: false };

  let matchingEvent = false;
  const unsubscribe = EventBus.on('task:status', payload => {
    try {
      if (payload && payload.moduleId === moduleId && payload.taskId === taskId && payload.status === status) matchingEvent = true;
    } catch (error) { /* niezaufany payload nie może przerwać delegowania */ }
  });
  let result;
  try {
    result = owner.setTaskStatus(taskId, status);
  } catch (error) {
    return { ok: false, changed: false };
  } finally {
    unsubscribe();
  }
  if (matchingEvent) return { ok: true, changed: true };
  if (result && result.ok === false) return { ok: false, changed: false };
  return { ok: true, changed: false };
}

function renderTodayPlanResult(plan, container) {
  if (!container) return;
  clearTodayNode(container);

  if (!plan || plan.ok !== true) {
    const fatal = createTodayNode('div', 'banner-warn today-plan-fatal');
    fatal.appendChild(createTodayNode('b', '', 'Nie można zbudować planu. '));
    fatal.appendChild(document.createTextNode(todayFatalMessage(plan && plan.code)));
    container.appendChild(fatal);
    const warnings = Array.isArray(plan && plan.warnings) ? plan.warnings : [];
    warnings.forEach(warning => container.appendChild(createTodayNode('div', 'banner-warn', todayWarningMessage(warning && warning.code))));
    return;
  }

  container.appendChild(createTodayNode('div', 'today-plan-date', `Plan na ${plan.date}`));
  if (plan.partial) container.appendChild(createTodayNode('div', 'banner-warn today-plan-partial', 'Plan jest częściowy — co najmniej jedno źródło zadań zostało pominięte.'));

  const summary = createTodayNode('div', 'today-plan-summary');
  const budget = plan.budget || {};
  const totals = plan.totals || {};
  const values = [
    ['Źródło budżetu', todayBudgetSourceLabel(budget.source)],
    ['Pełny budżet', Number.isInteger(budget.manualBudgetMinutes) ? `${budget.manualBudgetMinutes} min` : 'niedostępny'],
    ['Pełna dostępność', Number.isInteger(budget.availableMinutes) ? `${budget.availableMinutes} min` : 'brak konfiguracji'],
    ['Pozostała dostępność', Number.isInteger(budget.remainingAvailableMinutes) ? `${budget.remainingAvailableMinutes} min` : 'brak konfiguracji'],
    ['Efektywny budżet', Number.isInteger(budget.effectiveBudgetMinutes) ? `${budget.effectiveBudgetMinutes} min` : 'niedostępny'],
    ['Zaplanowano', Number.isInteger(totals.plannedMinutes) ? `${totals.plannedMinutes} min` : 'niedostępne'],
    ['Pozostały budżet', Number.isInteger(totals.unusedEffectiveMinutes) ? `${totals.unusedEffectiveMinutes} min` : 'niedostępny'],
    ['Nieprzydzielona dostępność', Number.isInteger(totals.uncommittedAvailabilityMinutes) ? `${totals.uncommittedAvailabilityMinutes} min` : 'brak konfiguracji']
  ];
  values.forEach(([label, value]) => {
    const item = createTodayNode('div', 'today-plan-summary-item');
    item.appendChild(createTodayNode('span', 'today-plan-summary-label', label));
    item.appendChild(createTodayNode('strong', '', value));
    summary.appendChild(item);
  });
  container.appendChild(summary);

  const warnings = Array.isArray(plan.warnings) ? plan.warnings : [];
  if (warnings.length) {
    const section = createTodayNode('section', 'today-plan-section today-plan-warnings');
    section.appendChild(createTodayNode('h4', '', 'Ważne informacje'));
    warnings.forEach(warning => section.appendChild(createTodayNode('div', 'banner-warn', todayWarningMessage(warning && warning.code))));
    container.appendChild(section);
  }

  const selected = Array.isArray(plan.selected) ? plan.selected : [];
  const selectedSection = createTodayNode('section', 'today-plan-section today-plan-selected');
  selectedSection.appendChild(createTodayNode('h4', '', plan.mode === 'scheduled' ? 'Plan godzinowy' : 'Kolejność wykonania'));
  if (plan.mode === 'scheduled' && Array.isArray(plan.planningWindows)) {
    const windows = plan.planningWindows
      .filter(interval => interval && typeof interval.start === 'string' && typeof interval.end === 'string')
      .map(interval => `${interval.start}–${interval.end}`);
    selectedSection.appendChild(createTodayNode('div', 'today-plan-windows', windows.length
      ? `Okna planowania: ${windows.join(', ')}`
      : 'Brak okien planowania.'));
  }
  if (!selected.length) selectedSection.appendChild(createTodayNode('p', 'today-plan-empty', 'Brak zadań do zaplanowania w bieżących ograniczeniach.'));
  selected.forEach(task => appendTodayTaskSummary(selectedSection, task, { action: 'complete' }));
  container.appendChild(selectedSection);

  const completed = Array.isArray(plan.completedToday) ? plan.completedToday : [];
  if (completed.length) {
    const section = createTodayNode('section', 'today-plan-section today-plan-completed');
    section.appendChild(createTodayNode('h4', '', 'Ukończone dziś'));
    completed.forEach(task => appendTodayTaskSummary(section, task, { action: 'undo', done: true }));
    container.appendChild(section);
  }

  const deferred = Array.isArray(plan.deferred) ? plan.deferred : [];
  if (deferred.length) {
    const section = createTodayNode('section', 'today-plan-section today-plan-deferred');
    section.appendChild(createTodayNode('h4', '', 'Odłożone'));
    deferred.forEach(task => appendTodayTaskSummary(section, task, { message: todayDeferredMessage(task.reason) }));
    container.appendChild(section);
  }

  const excluded = Array.isArray(plan.excluded) ? plan.excluded : [];
  if (excluded.length) {
    const section = createTodayNode('section', 'today-plan-section today-plan-excluded');
    section.appendChild(createTodayNode('h4', '', 'Poza planem'));
    excluded.forEach(task => {
      if (typeof task.title === 'string') appendTodayTaskSummary(section, task, { message: todayExcludedMessage(task.reason), done: task.reason === 'STATUS_DONE' });
      else section.appendChild(createTodayNode('div', 'today-plan-reason', todayExcludedMessage(task.reason)));
    });
    container.appendChild(section);
  }

  const actionMessage = createTodayNode('div', 'today-plan-action-message');
  actionMessage.setAttribute('aria-live', 'polite');
  container.appendChild(actionMessage);

  container.querySelectorAll('[data-action="complete"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      checkbox.checked = false;
      const target = todayTaskActionTargets.get(checkbox);
      const result = target
        ? delegateTodayTaskStatus(target.moduleId, target.taskId, 'done')
        : { ok: false, changed: false };
      if (!result.changed) actionMessage.textContent = result.ok
        ? 'Status zadania nie wymagał zmiany.'
        : 'Nie udało się zmienić statusu zadania.';
    });
  });
  container.querySelectorAll('[data-action="undo"]').forEach(button => {
    button.addEventListener('click', () => {
      const target = todayTaskActionTargets.get(button);
      const result = target
        ? delegateTodayTaskStatus(target.moduleId, target.taskId, 'todo')
        : { ok: false, changed: false };
      if (!result.changed) actionMessage.textContent = result.ok
        ? 'Status zadania nie wymagał zmiany.'
        : 'Nie udało się cofnąć statusu zadania.';
    });
  });
}

function renderTodayContexts() {
  const notesEl = document.getElementById('day-context-notes');
  if (!notesEl) return;
  clearTodayNode(notesEl);
  ModuleRegistry.all().forEach(module => {
    let context;
    try {
      if (typeof module.getDayContext !== 'function') return;
      context = module.getDayContext();
    } catch (error) { return; }
    if (!context || typeof context.message !== 'string' || !context.message) return;
    notesEl.appendChild(createTodayNode('div', 'banner-warn', context.message));
  });
}

function renderTodayTasks(now = new Date()) {
  const today = localDateKey(now);
  renderTodayContexts();
  const container = document.getElementById('today-tasks');
  if (!container) return null;
  const budgetKey = Store.get('ui:timeBudget', 'normal');
  const plan = PlanDayEngine.getPlanForToday(budgetKey, now);
  todayPlanLastRenderedDate = plan && plan.ok === true ? plan.date : today;
  renderTodayPlanResult(plan, container);
  return plan;
}

const TodayPlanLifecycle = (() => {
  let started = false;
  let midnightTimer = null;

  function clearMidnightTimer() {
    if (midnightTimer === null) return;
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }

  function scheduleMidnight(now) {
    clearMidnightTimer();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = Math.max(1, nextMidnight.getTime() - now.getTime());
    midnightTimer = setTimeout(() => {
      midnightTimer = null;
      const capturedNow = new Date();
      renderDzis(capturedNow);
      scheduleMidnight(capturedNow);
    }, delay);
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    const capturedNow = new Date();
    if (localDateKey(capturedNow) === todayPlanLastRenderedDate) return;
    renderDzis(capturedNow);
    scheduleMidnight(capturedNow);
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleMidnight(new Date());
  }

  function stop() {
    if (!started) return;
    started = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearMidnightTimer();
  }

  function getState() {
    return { started, timerScheduled: midnightTimer !== null, lastRenderedDate: todayPlanLastRenderedDate };
  }

  return Object.freeze({ start, stop, getState });
})();

function renderHabitList() {
  const el = document.getElementById('habit-list');
  const date = DayEngine.todayKey();
  const habits = HabitEngine.defs().filter(h => h.active);
  el.innerHTML = habits.map(h => {
    const done = HabitEngine.isDone(h.id, date);
    const s = HabitEngine.streak(h.id);
    return `
      <div class="habit-item">
        <input type="checkbox" class="cb" id="habit-${escapeAttr(h.id)}" ${done ? 'checked' : ''}>
        <label for="habit-${escapeAttr(h.id)}">${escapeHtml(h.label)} <span class="pillar-tag">· ${escapeHtml(h.goalPillar)}</span></label>
        <span class="habit-streak ${s >= 7 ? 'hot' : ''}">${s > 0 ? '🔥 ' + s + ' dni' : ''}</span>
        <span class="badge">+${h.xp} XP</span>
      </div>
    `;
  }).join('');
  habits.forEach(h => {
    document.getElementById('habit-' + h.id).addEventListener('change', (e) => {
      HabitEngine.log(h.id, date, e.target.checked);
      renderHabitList();
    });
  });
}

/* ============================================================
   ENGINE / PriorityEngine
   Odpowiedzialność: jedna rzecz — z DOSTARCZONEJ puli zadań
   wybiera te, które mieszczą się w dostępnym czasie, sortując
   wg priorytetu. Celowo NIE pobiera zadań samodzielnie z
   ModuleRegistry (jak w Kroku 3) — to DecisionEngine decyduje,
   jaką pulę przekazać, co pozwala mu najpierw odfiltrować wg
   energii, a dopiero potem wypełniać budżet czasu. Gdyby budżet
   był wypełniany PRZED filtrem energii, trudne zadanie mogłoby
   zająć czas, który lekkie zadanie by się zmieściło — a potem
   trudne i tak zostałoby odrzucone, marnując ten czas. Kolejność
   ma znaczenie, więc PriorityEngine nie narzuca jej sam.
   ============================================================ */
const TIME_BUDGETS = [
  { key: 'short', label: 'Mało czasu (~30 min)', minutes: 30 },
  { key: 'normal', label: 'Normalnie (~60 min)', minutes: 60 },
  { key: 'long', label: 'Dużo czasu (2h+)', minutes: 150 }
];

const PriorityEngine = (() => {
  // Zadania w statusie 'todo' ze WSZYSTKICH zarejestrowanych
  // modułów — przez ModuleRegistry, nigdy przez odwołanie do
  // konkretnego modułu po nazwie.
  function collectOpenTasks(date) {
    assertPlanningDate(date);
    return ModuleRegistry.all().flatMap(mod =>
      mod.getTasks(date)
        .filter(t => t.status === 'todo')
        .map(t => ({ ...t, moduleId: mod.id, moduleName: mod.name }))
    );
  }

  // Przyjmuje GOTOWĄ pulę (już odfiltrowaną np. przez energię)
  // i mieści kolejne zadania wg priorytetu w budżecie czasu.
  function pickWithinBudget(tasks, minutesAvailable) {
    const sorted = [...tasks].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
    const picks = [];
    const deferredByTime = [];
    let remaining = minutesAvailable;
    for (const task of sorted) {
      const cost = task.estimatedMinutes ?? 15;
      if (cost <= remaining) { picks.push(task); remaining -= cost; }
      else deferredByTime.push(task);
    }
    return { picks, deferredByTime };
  }

  return { collectOpenTasks, pickWithinBudget };
})();

/* ============================================================
   ENGINE / DecisionEngine
   Odpowiedzialność: składa DayEngine (energia) + PriorityEngine
   (zadania w budżecie czasu) + HabitEngine (aktywne nawyki)
   w jedną, gotową listę na ekran "Dziś". To CZYSTA REGUŁA
   KOMPOZYCJI — deterministyczna i debugowalna, nie uczenie
   maszynowe.

   KOLEJNOŚĆ FILTROWANIA (poprawiona po recenzji Kroku 3):
   1. Najpierw energia odcina zadania zbyt trudne na dziś —
      CAŁKOWICIE usuwa je z puli, zanim budżet czasu zacznie
      się wypełniać.
   2. Dopiero POTEM PriorityEngine wypełnia budżet z tego, co
      zostało — więc czas zwolniony przez odrzucone trudne
      zadanie trafia do kolejnego w kolejności lekkiego zadania,
      zamiast się marnować.
   ============================================================ */
const DecisionEngine = (() => {
  const LOW_ENERGY_THRESHOLD = 50;
  const HIGH_DIFFICULTY_THRESHOLD = 4;

  function planToday(timeBudgetMinutes, date) {
    assertPlanningDate(date);
    const record = DayEngine.getRecord(date);
    const energy = record ? record.energyScore : null;

    const habits = HabitEngine.defs()
      .filter(h => h.active)
      .map(h => ({ ...h, done: HabitEngine.isDone(h.id, date) }));

    const allOpen = PriorityEngine.collectOpenTasks(date);

    // KROK 1: filtr energii — działa na CAŁEJ puli, przed budżetem czasu.
    let pool = allOpen;
    let deferredByEnergy = [];
    if (energy !== null && energy < LOW_ENERGY_THRESHOLD) {
      deferredByEnergy = allOpen.filter(t => (t.difficulty ?? 3) >= HIGH_DIFFICULTY_THRESHOLD);
      pool = allOpen.filter(t => (t.difficulty ?? 3) < HIGH_DIFFICULTY_THRESHOLD);
    }

    // KROK 2: dopiero teraz wypełniamy budżet czasu — z puli już
    // pozbawionej zadań odrzuconych przez energię, więc zwolniony
    // czas trafia do następnych w kolejności zadań, nie przepada.
    const { picks, deferredByTime } = PriorityEngine.pickWithinBudget(pool, timeBudgetMinutes);

    return {
      energy,
      habits,
      picks,
      deferred: [...deferredByTime, ...deferredByEnergy],
      reasonCounts: { time: deferredByTime.length, energy: deferredByEnergy.length }
    };
  }

  // Dwukierunkowa zmiana statusu — zastępuje jednokierunkowy
  // completeTask() z Kroku 3. Pozwala zarówno ukończyć zadanie,
  // jak i cofnąć błędne kliknięcie (status z powrotem na 'todo').
  function setTaskStatus(moduleId, taskId, status) {
    const mod = ModuleRegistry.get(moduleId);
    if (mod && mod.setTaskStatus) mod.setTaskStatus(taskId, status);
  }

  return { planToday, setTaskStatus };
})();

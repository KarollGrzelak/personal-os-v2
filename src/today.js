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
function renderDzis() {
  const container = document.getElementById('view-dzis');
  const date = DayEngine.todayKey();
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
      renderDzis();
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

  renderTodayTasks();
  renderHabitList();
}

function renderTodayTasks() {
  // Odczyt generyczny, opcjonalny — przez ModuleRegistry.all(), nigdy
  // przez odwołanie do konkretnego modułu po ID (pkt E/17-19). Każdy
  // moduł, który implementuje getDayContext(), może wyświetlić notatkę
  // na ekranie "Dziś" bez żadnej zmiany w tym widoku. Brak modułu albo
  // brak metody nie powoduje błędu — ta sama zasada co reszta
  // integracji między-modułowej w aplikacji.
  const notesEl = document.getElementById('day-context-notes');
  if (notesEl) {
    const contexts = ModuleRegistry.all()
      .filter(mod => typeof mod.getDayContext === 'function')
      .map(mod => mod.getDayContext())
      .filter(Boolean);
    notesEl.innerHTML = contexts.map(ctx => `<div class="banner-warn">${ctx.message}</div>`).join('');
  }

  const el = document.getElementById('today-tasks');
  const budgetKey = Store.get('ui:timeBudget', 'normal');
  const budget = TIME_BUDGETS.find(b => b.key === budgetKey) || TIME_BUDGETS[1];
  const plan = DecisionEngine.planToday(budget.minutes);
  const today = localDateKey();

  const rows = plan.picks.map(t => `
    <div class="item">
      <input type="checkbox" class="cb" data-module="${escapeAttr(t.moduleId)}" data-task="${escapeAttr(t.id)}" data-action="complete">
      <label>${escapeHtml(t.title)} <span class="pillar-tag">· ${escapeHtml(t.moduleName)}</span></label>
      <span class="badge">${t.estimatedMinutes ?? 15} min</span>
      <span class="badge">+${t.xp ?? 0} XP</span>
    </div>
  `).join('');

  const deferredNote = (plan.reasonCounts.time + plan.reasonCounts.energy) > 0
    ? `<p style="margin-top:12px;color:var(--text3);font-size:12px;">
        Odłożone: ${plan.reasonCounts.time > 0 ? `${plan.reasonCounts.time} — brak czasu w budżecie` : ''}
        ${plan.reasonCounts.time > 0 && plan.reasonCounts.energy > 0 ? ' · ' : ''}
        ${plan.reasonCounts.energy > 0 ? `${plan.reasonCounts.energy} — niska energia, trudność zbyt wysoka na dziś` : ''}
      </p>`
    : '';

  // Zadania ukończone DZISIAJ, z dowolnego modułu — z opcją cofnięcia
  // błędnego kliknięcia (setTaskStatus z powrotem na 'todo').
  const doneToday = ModuleRegistry.all().flatMap(mod =>
    mod.getTasks()
      .filter(t => t.status === 'done' && t.completedDate === today)
      .map(t => ({ ...t, moduleId: mod.id, moduleName: mod.name }))
  );
  const doneHtml = doneToday.length ? `
    <div style="margin-top:14px;">
      <div class="pillar-tag" style="margin-bottom:6px;">Ukończone dziś</div>
      ${doneToday.map(t => `
        <div class="item done">
          <label style="flex:1;">${escapeHtml(t.title)} <span class="pillar-tag">· ${escapeHtml(t.moduleName)}</span></label>
          <button class="ghost" data-module="${escapeAttr(t.moduleId)}" data-task="${escapeAttr(t.id)}" data-action="undo">cofnij</button>
        </div>
      `).join('')}
    </div>
  ` : '';

  el.innerHTML = (rows || '<p style="color:var(--text3);">Brak zadań do pokazania — wszystko odhaczone albo brak zarejestrowanych modułów.</p>') + deferredNote + doneHtml;

  el.querySelectorAll('[data-action="complete"]').forEach(cb => {
    cb.addEventListener('change', () => {
      DecisionEngine.setTaskStatus(cb.dataset.module, cb.dataset.task, 'done');
      renderTodayTasks();
    });
  });
  el.querySelectorAll('[data-action="undo"]').forEach(btn => {
    btn.addEventListener('click', () => {
      DecisionEngine.setTaskStatus(btn.dataset.module, btn.dataset.task, 'todo');
      renderTodayTasks();
    });
  });
}

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
  function collectOpenTasks() {
    return ModuleRegistry.all().flatMap(mod =>
      mod.getTasks()
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

  function planToday(timeBudgetMinutes) {
    const date = DayEngine.todayKey();
    const record = DayEngine.getRecord(date);
    const energy = record ? record.energyScore : null;

    const habits = HabitEngine.defs()
      .filter(h => h.active)
      .map(h => ({ ...h, done: HabitEngine.isDone(h.id, date) }));

    const allOpen = PriorityEngine.collectOpenTasks();

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


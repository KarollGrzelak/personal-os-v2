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

/* ============================================================
   TYPY / MeasurementType, Material, TrainingProfile
   ============================================================ */

// Cztery typy pomiaru — formularz logowania i sposób liczenia PR
// ZALEŻĄ od typu. Plank (duration) nie ma nic wspólnego z polem
// "ciężar" przysiadu z hantlą (weight_reps) — to nie jest to samo
// pole użyte przypadkiem do dwóch różnych rzeczy.
//   weight_reps      — serie × powtórzenia × ciężar (np. przysiad, wyciskanie)
//   bodyweight_reps  — serie × powtórzenia, bez ciężaru (np. pompki)
//   duration         — serie × czas w sekundach (np. plank)
//   mobility         — rozciąganie/mobilność — bez sensownego PR

// Model materiału — WYŁĄCZNIE zweryfikowane źródła, nigdy linki
// wyszukiwania. Każdy poniższy URL sprawdzony przez wyszukiwanie
// w dniu podanym w verifiedAt (ExRx.net — biblioteka ćwiczeń
// istniejąca od 1999, rekomendowana m.in. przez ACSM).
function material(title, url) {
  return { title, url, source: 'ExRx.net', language: 'en', verifiedAt: '2026-08-02' };
}

/* ============================================================
   DANE / TRAINING_DAYS — PLAN ROBOCZY
   ============================================================
   WAŻNE: to jest KONFIGURACJA STARTOWA, nie ostateczny plan
   dopasowany do użytkownika. Dopóki TrainingProfile (sprzęt,
   miejsce, poziom, dostępne dni/czas, cel, ograniczenia, wyniki
   startowe) nie zostanie uzupełniony, moduł wyraźnie oznacza się
   w UI jako "plan roboczy" — banner na górze widoku, nie ukryty
   w dokumentacji. Ćwiczenia poniżej są sensownym punktem startu
   dla początkującego bez przeciwwskazań, ale NIE są personalizacją.
   ============================================================ */
const TRAINING_DAYS = [
  {
    id: 'day-a', name: 'Full Body A', weekdays: [1], estimatedMinutes: 45, difficulty: 3, xp: 80,
    exercises: [
      {
        id: 'squat-goblet', name: 'Przysiad (goblet)', measurementType: 'weight_reps',
        goal: 'Siła i technika dolnej partii ciała',
        warmup: '8-10 min: krążenia bioder, przysiady bez obciążenia x10, wykroki z rotacją',
        technique: 'Hantla pionowo przy klatce, stopy na szerokość barków, schodzisz aż uda równoległe do podłoża, kolana w linii ze stopami, plecy proste.',
        material: material('ExRx.net — Kettlebell Goblet Squat', 'https://exrx.net/WeightExercises/Kettlebell/KBGobletSquat'),
        sets: 3, repRangeMin: 10, repRangeMax: 12, tempo: '2-0-2', restSeconds: 75,
        progression: 'Po 2 tygodniach dobrej techniki: +1 seria LUB +1-2 kg, nie oba naraz.',
        commonMistakes: ['Kolana zapadają się do środka', 'Odrywanie pięt od podłoża', 'Zaokrąglanie pleców na dole'],
        cooldown: 'Marsz w miejscu 2 min, spadek tętna',
        stretching: ['Rozciąganie czworogłowych 30s/noga', 'Rozciąganie pośladków 30s/strona']
      },
      {
        id: 'pushup', name: 'Pompki', measurementType: 'bodyweight_reps',
        goal: 'Siła górnej partii ciała — pchanie',
        warmup: 'Krążenia ramion, 5 pompek w wolnym tempie jako rozgrzewka specyficzna',
        technique: 'Dłonie nieco szerzej niż barki, ciało w jednej linii od głowy do pięt, schodzisz aż klatka prawie dotyka podłoża.',
        material: material('ExRx.net — Push-up', 'https://exrx.net/WeightExercises/PectoralSternal/BWPushup'),
        sets: 3, repRangeMin: 8, repRangeMax: 12, tempo: '2-0-1', restSeconds: 60,
        progression: 'Za łatwe? Wolniejsze tempo albo unoszenie stóp. Za trudne? Z kolan.',
        commonMistakes: ['Biodra opadają', 'Głowa wysunięta do przodu', 'Niepełny zakres ruchu'],
        cooldown: 'Rozluźnienie ramion, krążenia',
        stretching: ['Rozciąganie klatki piersiowej w futrynie drzwi 30s']
      },
      {
        id: 'row-db', name: 'Wiosłowanie hantlą w opadzie', measurementType: 'weight_reps',
        goal: 'Siła pleców — ciągnięcie',
        warmup: 'Krążenia barków, lekkie skręty tułowia',
        technique: 'Kolano i dłoń oparte o ławkę, plecy równolegle do podłoża, ciągniesz hantlę do biodra, łokieć blisko ciała.',
        material: material('ExRx.net — Dumbbell Bent-over Row', 'https://exrx.net/WeightExercises/BackGeneral/DBBentOverRow'),
        sets: 3, repRangeMin: 10, repRangeMax: 10, tempo: '1-1-2', restSeconds: 60,
        progression: '+1-2 kg gdy 10 powt. w dobrej formie na obu seriach.',
        commonMistakes: ['Rotacja tułowia zamiast pracy ramienia', 'Zbyt szybkie opuszczanie hantli'],
        cooldown: 'Rozluźnienie pleców, głębokie oddechy',
        stretching: ['Rozciąganie szerokiego grzbietu — zwis na drążku lub sięganie w bok 30s']
      },
      {
        id: 'plank', name: 'Plank', measurementType: 'duration',
        goal: 'Stabilizacja tułowia (core)',
        warmup: 'Nie wymaga osobnej rozgrzewki — po pozostałych ćwiczeniach',
        technique: 'Przedramiona i palce stóp na podłodze, ciało w linii prostej, napięty brzuch i pośladki.',
        material: material('ExRx.net — Front Plank', 'https://exrx.net/WeightExercises/RectusAbdominis/BWFrontPlank'),
        sets: 3, repRangeMin: 30, repRangeMax: 30, tempo: 'izometria', restSeconds: 45,
        progression: '+10s co tydzień, gdy forma nie sypie się do końca serii.',
        commonMistakes: ['Biodra uniesione za wysoko', 'Biodra opadają w dół', 'Wstrzymywanie oddechu'],
        cooldown: 'Dziecięca poza (child\'s pose) 30s',
        stretching: ['Rozciąganie brzucha w leżeniu na brzuchu 20s']
      }
    ]
  },
  {
    id: 'day-mobility', name: 'Mobility', weekdays: [2], estimatedMinutes: 25, difficulty: 1, xp: 40,
    exercises: [
      {
        id: 'hip-flexor-stretch', name: 'Rozciąganie zginaczy bioder', measurementType: 'mobility',
        goal: 'Mobilność bioder — przeciwdziała siedzeniu przy kodzie',
        warmup: 'Nie wymagana — to sesja regeneracyjna',
        technique: 'Klęk na jedno kolano, drugie przed sobą, przenosisz ciężar do przodu aż poczujesz rozciąganie z przodu biodra tylnej nogi.',
        material: material('ExRx.net — Lunging Hip Flexor Stretch', 'https://exrx.net/Stretches/HipFlexors/LungingHipFlexor'),
        sets: 2, repRangeMin: 30, repRangeMax: 30, tempo: 'statyczne', restSeconds: 20,
        progression: 'Głębsze rozciąganie, gdy poprzednie przestaje być dyskomfortowe.',
        commonMistakes: ['Wygięcie pleców zamiast pracy w biodrze'],
        cooldown: 'Nie dotyczy',
        stretching: ['To ćwiczenie samo w sobie jest rozciąganiem']
      },
      {
        id: 'thoracic-rotation', name: 'Rotacje kręgosłupa piersiowego', measurementType: 'mobility',
        goal: 'Mobilność górnych pleców',
        warmup: 'Nie wymagana',
        technique: 'Klęk podparty, jedna ręka za głową, rotujesz tułów otwierając klatkę w stronę sufitu.',
        material: material('ExRx.net — Spine Articulations (rotacja tułowia, opis anatomiczny)', 'https://exrx.net/Articulations/Spine'),
        sets: 2, repRangeMin: 8, repRangeMax: 8, tempo: 'kontrolowane', restSeconds: 20,
        progression: 'Zwiększaj zakres ruchu stopniowo.',
        commonMistakes: ['Rotacja z bioder zamiast z górnych pleców'],
        cooldown: 'Nie dotyczy', stretching: []
      }
    ]
  },
  {
    id: 'day-b', name: 'Full Body B', weekdays: [3], estimatedMinutes: 50, difficulty: 4, xp: 80,
    exercises: [
      {
        id: 'bulgarian-split-squat', name: 'Przysiad bułgarski', measurementType: 'weight_reps',
        goal: 'Siła jednostronna nóg',
        warmup: '8-10 min dynamiczne rozciąganie bioder i kostek',
        technique: 'Tylna stopa oparta o podwyższenie, przednia noga robi całą pracę, schodzisz pionowo.',
        material: material('ExRx.net — Dumbbell Split Squat (rear foot elevated)', 'https://exrx.net/WeightExercises/GluteusMaximus/DBSplitSquat'),
        sets: 3, repRangeMin: 8, repRangeMax: 8, tempo: '2-0-2', restSeconds: 75,
        progression: '+1-2 kg w rękach, gdy 8 powt./nogę w dobrej formie.',
        commonMistakes: ['Kolano wychodzi mocno przed palce', 'Utrata równowagi'],
        cooldown: 'Marsz w miejscu 2 min',
        stretching: ['Rozciąganie zginaczy bioder 30s/strona']
      },
      {
        id: 'rdl-db', name: 'RDL z hantlami', measurementType: 'weight_reps',
        goal: 'Siła tylnego łańcucha (dwugłowe uda, pośladki)',
        warmup: 'Krążenia bioder, lekkie wykroki',
        technique: 'Hantle blisko ud, lekko ugięte kolana przez cały ruch, biodra cofasz do tyłu, plecy proste.',
        material: material('ExRx.net — Romanian Deadlift (technika, adaptacja do hantli)', 'https://exrx.net/WeightExercises/OlympicLifts/RomanianDeadlift'),
        sets: 3, repRangeMin: 10, repRangeMax: 10, tempo: '2-1-2', restSeconds: 75,
        progression: '+1-2 kg gdy technika stabilna na obu seriach.',
        commonMistakes: ['Zaokrąglanie pleców', 'Zbyt duże ugięcie kolan (to nie przysiad)'],
        cooldown: 'Rozluźnienie tylnej taśmy',
        stretching: ['Rozciąganie dwugłowych uda 30s/noga']
      }
    ]
  },
  {
    id: 'day-c', name: 'Full Body C', weekdays: [5], estimatedMinutes: 45, difficulty: 3, xp: 80,
    exercises: [
      {
        id: 'overhead-press', name: 'Wyciskanie hantli nad głowę', measurementType: 'weight_reps',
        goal: 'Siła barków',
        warmup: 'Krążenia ramion, wyciskanie bez obciążenia x10',
        technique: 'Hantle na wysokości barków, wypychasz w górę bez odchylania pleców, napięty brzuch.',
        material: material('ExRx.net — Dumbbell Shoulder Press', 'https://exrx.net/WeightExercises/DeltoidAnterior/DBShoulderPress'),
        sets: 3, repRangeMin: 10, repRangeMax: 10, tempo: '2-0-2', restSeconds: 75,
        progression: '+1-2 kg gdy 10 powt. stabilnie bez odchylania pleców.',
        commonMistakes: ['Nadmierne odchylanie pleców do tyłu', 'Niepełny wyprost łokci'],
        cooldown: 'Rozluźnienie barków',
        stretching: ['Rozciąganie barków krzyżowe 30s/strona']
      },
      {
        id: 'walking-lunge', name: 'Wykroki chodzone', measurementType: 'bodyweight_reps',
        goal: 'Siła i koordynacja nóg',
        warmup: 'Dynamiczne wykroki bez obciążenia x10',
        technique: 'Długi krok do przodu, tylne kolano prawie dotyka podłogi, przednie nie wychodzi mocno przed palce.',
        material: material('ExRx.net — Walking Lunge', 'https://exrx.net/Stretches/Miscellaneous/WalkingLunge'),
        sets: 3, repRangeMin: 10, repRangeMax: 10, tempo: 'kontrolowane', restSeconds: 75,
        progression: 'Hantle w rękach, gdy technika bez obciążenia jest stabilna.',
        commonMistakes: ['Zbyt krótki krok', 'Odbijanie się od podłogi'],
        cooldown: 'Marsz w miejscu 2 min',
        stretching: ['Rozciąganie zginaczy bioder 30s/strona']
      }
    ]
  }
];

/* ============================================================
   KATALOG / SUBSTITUTE_EXERCISES
   Warianty bez sprzętu, używane przez TrainingPlanEngine gdy
   profil nie zawiera hantli. Każdy z realnym, zweryfikowanym
   materiałem (ExRx.net) — te same zasady co katalog bazowy.
   ============================================================ */
const SUBSTITUTE_EXERCISES = [
  {
    id: 'squat-bodyweight', name: 'Przysiad (bez obciążenia)', measurementType: 'bodyweight_reps',
    goal: 'Siła i technika dolnej partii ciała — wariant bez sprzętu',
    warmup: '8-10 min: krążenia bioder, przysiady bez obciążenia x10',
    technique: 'Stopy na szerokość barków, ręce wyciągnięte przed siebie dla balansu, schodzisz aż uda równoległe do podłoża.',
    material: material('ExRx.net — Squat (bodyweight)', 'https://exrx.net/WeightExercises/Quadriceps/BWSquat'),
    sets: 3, repRangeMin: 12, repRangeMax: 15, tempo: '2-0-2', restSeconds: 60,
    progression: 'Gdy 15 powt. w dobrej formie na wszystkich seriach — dodaj tempo pauzy 2s na dole.',
    commonMistakes: ['Kolana zapadają się do środka', 'Odrywanie pięt od podłoża'],
    cooldown: 'Marsz w miejscu 2 min',
    stretching: ['Rozciąganie czworogłowych 30s/noga']
  },
  {
    id: 'split-squat-bodyweight', name: 'Przysiad bułgarski (bez obciążenia)', measurementType: 'bodyweight_reps',
    goal: 'Siła jednostronna nóg — wariant bez sprzętu',
    warmup: '8-10 min dynamiczne rozciąganie bioder i kostek',
    technique: 'Tylna stopa oparta o podwyższenie, przednia noga robi całą pracę, schodzisz pionowo.',
    material: material('ExRx.net — Single Leg Split Squat (bodyweight)', 'https://exrx.net/WeightExercises/Quadriceps/BWSingleLegSplitSquat'),
    sets: 3, repRangeMin: 10, repRangeMax: 12, tempo: '2-0-2', restSeconds: 60,
    progression: 'Gdy 12 powt./nogę stabilnie — spróbuj wolniejszego tempa zamiast dodawania obciążenia.',
    commonMistakes: ['Kolano wychodzi mocno przed palce', 'Utrata równowagi'],
    cooldown: 'Marsz w miejscu 2 min',
    stretching: ['Rozciąganie zginaczy bioder 30s/strona']
  }
];

function findExerciseById(exerciseId) {
  for (const day of TRAINING_DAYS) {
    const ex = day.exercises.find(e => e.id === exerciseId);
    if (ex) return { exercise: ex, day };
  }
  const sub = SUBSTITUTE_EXERCISES.find(e => e.id === exerciseId);
  if (sub) return { exercise: sub, day: null };
  return null;
}

/* ============================================================
   WALIDACJA / validateLogEntry
   ============================================================ */
function validateLogEntry(measurementType, raw) {
  const errors = [];

  const sets = parseInt(raw.sets, 10);
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) errors.push('Serie: liczba całkowita 1-20');

  let reps = null, durationSeconds = null;
  if (measurementType === 'duration' || measurementType === 'mobility') {
    durationSeconds = parseInt(raw.durationSeconds, 10);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 200) errors.push('Czas (s): liczba całkowita 1-200');
  } else {
    reps = parseInt(raw.reps, 10);
    if (!Number.isInteger(reps) || reps < 1 || reps > 200) errors.push('Powtórzenia: liczba całkowita 1-200');
  }

  let weight = null;
  if (measurementType === 'weight_reps') {
    if (raw.weight !== '' && raw.weight != null) {
      weight = parseFloat(raw.weight);
      if (isNaN(weight) || weight < 0 || weight > 500) errors.push('Ciężar: 0-500 kg');
    }
  }

  let rpe = null;
  if (raw.rpe !== '' && raw.rpe != null) {
    rpe = parseInt(raw.rpe, 10);
    if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) errors.push('RPE: liczba całkowita 1-10');
  }

  return { valid: errors.length === 0, errors, sets, reps, durationSeconds, weight, rpe };
}

/* ============================================================
   WALIDACJA / validateProfile
   Odpowiedzialność: jedna — sprawdzić TrainingProfile PRZED
   zapisem. Czytelne błędy zamiast cichego przyjmowania złych
   danych (recenzja Kroku 4, punkt 3).
   ============================================================ */
const ALLOWED_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'];

// Krok 8.1: musi bezpiecznie obsłużyć DOWOLNĄ wartość JSON — backup to
// niezaufane wejście. Żadna gałąź nie zakłada, że `raw` albo którekolwiek
// z jego pól ma "sensowny" typ, zanim to jawnie sprawdzi. Profil
// niekompletny jest legalnym stanem — pola NIEOBECNE nie są błędem,
// pola OBECNE o złym typie zawsze są.
function validateProfile(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Profil treningowy: wymagany obiekt'] };
  }
  const errors = [];

  if (raw.equipment !== undefined) {
    if (!Array.isArray(raw.equipment) || raw.equipment.some(e => typeof e !== 'string')) {
      errors.push('Sprzęt: wymagana tablica tekstów');
    }
  }

  if (raw.location !== undefined && typeof raw.location !== 'string') {
    errors.push('Miejsce: wymagany tekst');
  }

  if (raw.experienceLevel !== undefined && raw.experienceLevel !== '' && !ALLOWED_EXPERIENCE_LEVELS.includes(raw.experienceLevel)) {
    errors.push('Poziom doświadczenia: dozwolone tylko beginner/intermediate/advanced (albo puste)');
  }

  if (raw.availableDays !== undefined) {
    if (!Array.isArray(raw.availableDays)) {
      errors.push('Dostępne dni: wymagana tablica');
    } else {
      const days = raw.availableDays;
      if (days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
        errors.push('Dostępne dni: tylko liczby całkowite 0-6');
      }
      if (new Set(days).size !== days.length) {
        errors.push('Dostępne dni: bez duplikatów');
      }
    }
  }

  if (raw.availableMinutesPerSession !== undefined && raw.availableMinutesPerSession !== null) {
    const minutes = raw.availableMinutesPerSession;
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 240) {
      errors.push('Czas sesji: liczba całkowita 10-240 minut (albo null)');
    }
  }

  if (raw.mainGoal !== undefined && typeof raw.mainGoal !== 'string') {
    errors.push('Główny cel: wymagany tekst');
  }

  if (raw.limitations !== undefined && typeof raw.limitations !== 'string') {
    errors.push('Ograniczenia: wymagany tekst');
  }

  if (raw.baselineResults !== undefined) {
    if (!raw.baselineResults || typeof raw.baselineResults !== 'object' || Array.isArray(raw.baselineResults)) {
      errors.push('Wyniki startowe: wymagany obiekt');
    } else {
      const baseline = raw.baselineResults;
      ['squatReps', 'pushupReps', 'plankSeconds'].forEach(key => {
        const v = baseline[key];
        if (v !== undefined && v !== null && (!Number.isFinite(v) || v < 0)) {
          errors.push(`Wynik startowy (${key}): musi być liczbą nieujemną albo null`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

const DEFAULT_PROFILE_FIELDS = {
  equipment: [], location: '', experienceLevel: '', availableDays: [],
  availableMinutesPerSession: null, mainGoal: '', limitations: '',
  baselineResults: { squatReps: null, pushupReps: null, plankSeconds: null }
};

function isProfileComplete(p) {
  return !!(p && p.equipment && p.equipment.length && p.location && p.experienceLevel
    && p.availableDays && p.availableDays.length && p.availableMinutesPerSession && p.mainGoal);
}

/* ============================================================
   ENGINE / TrainingPlanEngine
   Odpowiedzialność: jedna — na podstawie TrainingProfile
   przekształca bazowy katalog TRAINING_DAYS w AKTYWNY plan.
   Jawne, deterministyczne reguły — zero AI, zero losowości.
   TRAINING_DAYS pozostaje katalogiem referencyjnym (definicje
   ćwiczeń, materiały) — ten silnik tylko WYBIERA i DOSTOSOWUJE,
   nigdy nie modyfikuje samego katalogu.
   ============================================================ */
const EQUIPMENT_SUBSTITUTIONS = {
  'squat-goblet': 'squat-bodyweight',
  'bulgarian-split-squat': 'split-squat-bodyweight'
};
const REQUIRES_DUMBBELL_NO_SUBSTITUTE = ['row-db', 'rdl-db', 'overhead-press'];
const KNEE_RISK_EXERCISE_IDS = ['squat-goblet', 'squat-bodyweight', 'bulgarian-split-squat', 'split-squat-bodyweight', 'walking-lunge'];

const TrainingPlanEngine = (() => {
  function generatePlan(profile) {
    if (!isProfileComplete(profile)) {
      return {
        days: TRAINING_DAYS, source: 'default', needsManualReview: false,
        notes: ['Profil niekompletny — używany katalog bazowy, bez personalizacji.']
      };
    }

    const notes = [];
    let needsManualReview = false;
    const hasDumbbells = profile.equipment.some(e => /hantl/i.test(e));
    const kneeIssue = /kolan/i.test(profile.limitations || '');

    function adaptExercises(exercises) {
      let result = exercises.map(ex => {
        if (!hasDumbbells && ex.measurementType === 'weight_reps') {
          if (EQUIPMENT_SUBSTITUTIONS[ex.id]) {
            const sub = findExerciseById(EQUIPMENT_SUBSTITUTIONS[ex.id]).exercise;
            notes.push(`${ex.name} → ${sub.name} (brak hantli w profilu).`);
            return sub;
          }
          if (REQUIRES_DUMBBELL_NO_SUBSTITUTE.includes(ex.id)) {
            notes.push(`${ex.name} pominięte — wymaga hantli, brak zamiennika w bazie.`);
            return null;
          }
        }
        return ex;
      }).filter(Boolean);

      if (kneeIssue) {
        const before = result.length;
        result = result.filter(ex => !KNEE_RISK_EXERCISE_IDS.includes(ex.id));
        if (result.length < before) {
          needsManualReview = true;
          notes.push('Wykluczono ćwiczenia obciążające kolano (zgłoszone ograniczenie). To nie jest porada medyczna — skonsultuj plan z fizjoterapeutą przed startem.');
        }
      }

      const maxExercises = Math.max(2, Math.floor(profile.availableMinutesPerSession / 8));
      if (result.length > maxExercises) {
        notes.push(`Skrócono listę ćwiczeń do ${maxExercises} — limit ${profile.availableMinutesPerSession} min/sesję.`);
        result = result.slice(0, maxExercises);
      }

      if (profile.experienceLevel === 'beginner') {
        result = result.map(ex => ({ ...ex, sets: Math.max(2, ex.sets - 1) }));
      }

      return result;
    }

    // Wybór dni: bazowe dni siłowe (A/B/C) przypisane do pierwszych
    // dostępnych dni użytkownika, w liczbie min(3, dostępne dni).
    // Mobility jako 4. dzień, tylko gdy jest 4+ dostępnych dni.
    const strengthCatalog = ['day-a', 'day-b', 'day-c'].map(id => TRAINING_DAYS.find(d => d.id === id));
    const sortedAvailable = [...profile.availableDays].sort((a, b) => a - b);
    const strengthCount = Math.min(3, sortedAvailable.length);
    notes.push(`Wybrano ${strengthCount} dni siłowych na podstawie ${sortedAvailable.length} dostępnych dni.`);

    const activeDays = strengthCatalog.slice(0, strengthCount).map((baseDay, i) => ({
      ...baseDay,
      weekdays: [sortedAvailable[i]],
      estimatedMinutes: Math.min(baseDay.estimatedMinutes, profile.availableMinutesPerSession),
      exercises: adaptExercises(baseDay.exercises)
    }));

    if (sortedAvailable.length >= 4) {
      const mobilityDay = TRAINING_DAYS.find(d => d.id === 'day-mobility');
      activeDays.push({
        ...mobilityDay,
        weekdays: [sortedAvailable[3]],
        exercises: adaptExercises(mobilityDay.exercises)
      });
    }

    return { days: activeDays, source: 'generated', needsManualReview, notes };
  }

  return { generatePlan };
})();

function sessionToTaskStatus(sessionStatus) {
  // POPRAWKA recenzji Kroku 4: 'partial' NIE jest 'done' — trening
  // częściowo wykonany ma zostać widoczny na "Dziś" jako zadanie
  // do dokończenia, nie znikać jako ukończone.
  if (sessionStatus === 'completed') return 'done';
  if (sessionStatus === 'skipped') return 'skipped';
  return 'todo'; // planned, in_progress, partial
}

/* ============================================================
   ENGINE / reconcileSession
   Odpowiedzialność: JEDNA, centralna — wyliczyć spójny status
   sesji na podstawie RZECZYWISTYCH logów, nie zostawiać go
   rozjechanego z tym, co faktycznie zapisano. Wywoływana po
   każdej zmianie logów oraz po ręcznym zakończeniu/cofnięciu.
   ============================================================ */
function reconcileSession(dayId, date, opts = {}) {
  const profile = TrainingModule.getProfile();
  const plan = TrainingPlanEngine.generatePlan(profile);
  const day = plan.days.find(d => d.id === dayId) || TRAINING_DAYS.find(d => d.id === dayId);
  const sessions = Store.get('training:sessions', {});
  const taskId = `${dayId}:${date}`;
  const current = sessions[taskId] || { status: 'planned', completedDate: null };

  if (!day) return current;

  const loggedCount = TrainingModule._countLoggedExercisesForDate(day, date);
  const totalCount = day.exercises.length;

  let status;
  if (loggedCount === 0) {
    // opts.forceClose: użytkownik JAWNIE potwierdził zakończenie
    // treningu mimo braku logów (patrz finishSession) — to jedyny
    // sposób na 'partial' przy zerze logów, nigdy niejawnie.
    status = opts.forceClose ? 'partial' : 'planned';
  } else if (loggedCount >= totalCount) {
    status = 'completed';
  } else {
    // część zalogowana: 'partial' gdy user JAWNIE kliknął "zakończ
    // trening" (opts.explicitFinish) ALBO sesja była już wcześniej
    // zamknięta (completed/partial) — inaczej to zwykłe logowanie
    // w trakcie sesji, więc 'in_progress'.
    status = (opts.explicitFinish || current.status === 'completed' || current.status === 'partial') ? 'partial' : 'in_progress';
  }

  const completedDate = (status === 'completed' || status === 'partial') ? date : null;
  sessions[taskId] = { ...current, status, completedDate };
  Store.set('training:sessions', sessions);
  return sessions[taskId];
}

function finishSession(dayId, date) {
  const profile = TrainingModule.getProfile();
  const plan = TrainingPlanEngine.generatePlan(profile);
  const day = plan.days.find(d => d.id === dayId) || TRAINING_DAYS.find(d => d.id === dayId);
  const loggedCount = day ? TrainingModule._countLoggedExercisesForDate(day, date) : 0;

  if (loggedCount === 0) {
    const confirmed = confirm('Nie zalogowałeś żadnego ćwiczenia. Na pewno oznaczyć trening jako wykonany?');
    if (!confirmed) return; // brak potwierdzenia — nic się nie zmienia
    reconcileSession(dayId, date, { forceClose: true });
  } else {
    reconcileSession(dayId, date, { explicitFinish: true });
  }
  EventBus.emit('task:status', { moduleId: 'training', taskId: `${dayId}:${date}`, status: 'done' });
}

function skipSession(dayId, date) {
  const sessions = Store.get('training:sessions', {});
  const taskId = `${dayId}:${date}`;
  sessions[taskId] = { ...(sessions[taskId] || {}), status: 'skipped', completedDate: date };
  Store.set('training:sessions', sessions);
  EventBus.emit('task:status', { moduleId: 'training', taskId, status: 'skipped' });
}

function undoSession(dayId, date) {
  const sessions = Store.get('training:sessions', {});
  const taskId = `${dayId}:${date}`;
  sessions[taskId] = { status: 'planned', completedDate: null, durationMinutes: null, sessionRpe: null };
  Store.set('training:sessions', sessions);
  reconcileSession(dayId, date); // jeśli logi wciąż istnieją, podniesie z powrotem do in_progress/partial/completed
  EventBus.emit('task:status', { moduleId: 'training', taskId, status: 'todo' });
}

/* ============================================================
   MODUŁ / TrainingModule
   ============================================================ */
const TrainingModule = {
  id: 'training',
  name: 'Trening',

  getActivePlan() {
    return TrainingPlanEngine.generatePlan(this.getProfile());
  },

  getTasks() {
    const today = localDateKey();
    const weekday = new Date().getDay();
    const plan = this.getActivePlan();
    const day = plan.days.find(d => d.weekdays.includes(weekday));
    if (!day) return [];

    const taskId = `${day.id}:${today}`;
    const sessions = Store.get('training:sessions', {});
    const session = sessions[taskId] || { status: 'planned', completedDate: null };

    return [{
      id: taskId,
      // 'partial' dostaje wyraźny tytuł "Dokończ:" — inaczej
      // wygląda jak zwykłe nowe zadanie, a to dokończenie.
      title: session.status === 'partial' ? `Dokończ: ${day.name}` : day.name,
      status: sessionToTaskStatus(session.status),
      sessionStatus: session.status,
      priority: 3,
      estimatedMinutes: day.estimatedMinutes,
      difficulty: day.difficulty,
      xp: day.xp,
      completedDate: session.completedDate,
      dayId: day.id
    }];
  },

  // Deleguje do finishSession/skipSession/undoSession — patrz te
  // funkcje po opis reguł. Zachowuje kontrakt todo/done/skipped.
  setTaskStatus(taskId, status) {
    const dayId = taskId.split(':')[0];
    const date = taskId.split(':').slice(1).join(':');
    if (status === 'todo') return undoSession(dayId, date);
    if (status === 'skipped') return skipSession(dayId, date);
    if (status === 'done') return finishSession(dayId, date);
  },

  _countLoggedExercisesForDate(day, date) {
    const logs = Store.get('training:exerciseLogs', {});
    return day.exercises.filter(ex => (logs[ex.id] || []).some(e => e.date === date)).length;
  },

  getStats() {
    const sessions = Store.get('training:sessions', {});
    const all = Object.values(sessions);
    const done = all.filter(s => s.status === 'completed').length;
    return { done, total: all.length, label: this.name };
  },

  // ==== Logowanie ćwiczeń — POZA kontraktem Module ====
  upsertExerciseLog(exerciseId, date, rawEntry) {
    const found = findExerciseById(exerciseId);
    if (!found) return { ok: false, errors: ['Nieznane ćwiczenie'] };
    const { exercise } = found;

    const result = validateLogEntry(exercise.measurementType, rawEntry);
    if (!result.valid) return { ok: false, errors: result.errors };

    const logs = Store.get('training:exerciseLogs', {});
    logs[exerciseId] = logs[exerciseId] || [];
    const record = {
      date, sets: result.sets, reps: result.reps,
      durationSeconds: result.durationSeconds, weight: result.weight, rpe: result.rpe
    };
    const idx = logs[exerciseId].findIndex(e => e.date === date);
    if (idx >= 0) logs[exerciseId][idx] = record; else logs[exerciseId].push(record);
    Store.set('training:exerciseLogs', logs);

    // Który dzień (w AKTYWNYM planie) zawiera to ćwiczenie na tę datę?
    // Szukamy w planie, nie w statycznym TRAINING_DAYS, żeby zamienniki
    // (np. squat-bodyweight) też trafiały do właściwego dnia.
    const plan = this.getActivePlan();
    const dayInfo = plan.days.find(d => d.exercises.some(e => e.id === exerciseId))
      || TRAINING_DAYS.find(d => d.exercises.some(e => e.id === exerciseId));

    if (dayInfo) reconcileSession(dayInfo.id, date);

    DayEngine.recordTrainingLoad(date, this._computeLoadForDate(date));
    EventBus.emit('training:log', { exerciseId, record });
    return { ok: true, errors: [] };
  },

  deleteExerciseLog(exerciseId, date) {
    const logs = Store.get('training:exerciseLogs', {});
    if (!logs[exerciseId]) return;
    logs[exerciseId] = logs[exerciseId].filter(e => e.date !== date);
    Store.set('training:exerciseLogs', logs);

    const plan = this.getActivePlan();
    const dayInfo = plan.days.find(d => d.exercises.some(e => e.id === exerciseId))
      || TRAINING_DAYS.find(d => d.exercises.some(e => e.id === exerciseId));
    if (dayInfo) reconcileSession(dayInfo.id, date);

    DayEngine.recordTrainingLoad(date, this._computeLoadForDate(date));
    EventBus.emit('training:log', { exerciseId, deleted: date });
  },

  getExerciseHistory(exerciseId) {
    const logs = Store.get('training:exerciseLogs', {});
    return (logs[exerciseId] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  },

  getExercisePR(exerciseId) {
    const found = findExerciseById(exerciseId);
    if (!found) return null;
    const { exercise } = found;
    const history = this.getExerciseHistory(exerciseId);

    switch (exercise.measurementType) {
      case 'weight_reps': {
        const qualifying = history.filter(e => e.weight != null && e.reps != null && e.reps >= exercise.repRangeMin);
        const weights = qualifying.map(e => e.weight);
        return weights.length ? { type: 'weight', value: Math.max(...weights), unit: 'kg' } : null;
      }
      case 'bodyweight_reps': {
        const reps = history.map(e => e.reps).filter(r => r != null);
        return reps.length ? { type: 'reps', value: Math.max(...reps), unit: 'powt.' } : null;
      }
      case 'duration': {
        const durations = history.map(e => e.durationSeconds).filter(d => d != null);
        return durations.length ? { type: 'duration', value: Math.max(...durations), unit: 's' } : null;
      }
      case 'mobility':
      default:
        return null;
    }
  },

  _computeLoadForDate(date) {
    const logs = Store.get('training:exerciseLogs', {});
    let totalSets = 0, rpeSum = 0, rpeCount = 0;
    Object.values(logs).forEach(entries => {
      entries.filter(e => e.date === date).forEach(e => {
        totalSets += e.sets || 0;
        if (e.rpe) { rpeSum += e.rpe; rpeCount++; }
      });
    });
    if (totalSets === 0) return 0;
    const avgRpe = rpeCount ? rpeSum / rpeCount : 5;
    return Math.round(totalSets * avgRpe);
  },

  // ==== TrainingProfile — teraz z walidacją ====
  getProfile() { return Store.get('training:profile', null); },
  saveProfile(profile) {
    const result = validateProfile(profile);
    if (!result.valid) return { ok: false, errors: result.errors };
    Store.set('training:profile', profile);
    EventBus.emit('training:profile', profile);
    return { ok: true, errors: [] };
  },

  render(container) {
    const todayWeekday = new Date().getDay();
    const profile = this.getProfile();
    const complete = isProfileComplete(profile);
    const plan = this.getActivePlan();
    const scheduledToday = plan.days.find(d => d.weekdays.includes(todayWeekday));

    container.innerHTML = `
      <div class="card">
        <h3>🏋️ Trening</h3>
        ${!complete ? `
          <div class="banner-warn">
            ⚠ <b>Plan roboczy</b> — ćwiczenia poniżej to sensowny punkt startu dla początkującego, ale NIE są dopasowane do Ciebie.
            Uzupełnij <button class="link-btn" id="goto-profile">profil treningowy</button>, żeby plan realnie odpowiadał Twojemu sprzętowi, miejscu i poziomowi.
          </div>
        ` : `
          <div class="banner-ok">✓ Plan wygenerowany z profilu (${plan.days.length} dni/tydzień).</div>
          ${plan.needsManualReview ? `<div class="banner-warn">⚠ Ten plan wymaga ręcznej weryfikacji ze względu na zgłoszone ograniczenie zdrowotne. To nie jest porada medyczna.</div>` : ''}
          ${plan.notes.length ? `<div class="pillar-tag" style="margin-bottom:10px;">Zmiany wynikające z profilu:</div><div class="log" style="margin-bottom:14px;">${plan.notes.map(n => `<div>${n}</div>`).join('')}</div>` : ''}
        `}
        <div class="tabs" id="training-tabs"></div>
        <div id="training-day-content"></div>
      </div>
    `;

    const tabsEl = container.querySelector('#training-tabs');
    tabsEl.innerHTML = plan.days.map(d => `<button class="ghost train-tab" data-day="${d.id}">${d.name}${scheduledToday && scheduledToday.id === d.id ? ' · dziś' : ''}</button>`).join('')
      + `<button class="ghost train-tab" data-day="profile">👤 Profil</button>`;

    const gotoProfileBtn = container.querySelector('#goto-profile');
    if (gotoProfileBtn) gotoProfileBtn.addEventListener('click', () => selectTab('profile'));

    const renderProfileTab = () => {
      const contentEl = container.querySelector('#training-day-content');
      const p = this.getProfile() || DEFAULT_PROFILE_FIELDS;
      contentEl.innerHTML = `
        <div class="profile-form">
          <div class="field-row"><label>Sprzęt (po przecinku)</label><input type="text" id="pf-equipment" value="${escapeAttr((p.equipment||[]).join(', '))}" placeholder="hantle, mata, drążek"></div>
          <div class="field-row"><label>Miejsce</label><input type="text" id="pf-location" value="${escapeAttr(p.location||'')}" placeholder="dom / siłownia"></div>
          <div class="field-row"><label>Poziom</label>
            <select id="pf-level">
              <option value="">wybierz</option>
              <option value="beginner" ${p.experienceLevel==='beginner'?'selected':''}>początkujący</option>
              <option value="intermediate" ${p.experienceLevel==='intermediate'?'selected':''}>średnio zaawansowany</option>
              <option value="advanced" ${p.experienceLevel==='advanced'?'selected':''}>zaawansowany</option>
            </select>
          </div>
          <div class="field-row"><label>Dostępne dni (numery 0-6, po przecinku, 1=pon)</label><input type="text" id="pf-days" value="${escapeAttr((p.availableDays||[]).join(', '))}" placeholder="1, 2, 3, 5"></div>
          <div class="field-row"><label>Czas/sesję (min)</label><input type="number" id="pf-minutes" value="${escapeAttr(p.availableMinutesPerSession||'')}"></div>
          <div class="field-row"><label>Główny cel</label><input type="text" id="pf-goal" value="${escapeAttr(p.mainGoal||'')}" placeholder="sylwetka / siła / zdrowie"></div>
          <div class="field-row"><label>Ograniczenia</label><input type="text" id="pf-limits" value="${escapeAttr(p.limitations||'')}" placeholder="np. ból kolana — opcjonalne"></div>
          <div class="pillar-tag" style="margin-top:10px;">Wyniki startowe (opcjonalnie)</div>
          <div class="field-row"><label>Przysiady (powt.)</label><input type="number" id="pf-squat" value="${escapeAttr(p.baselineResults?.squatReps ?? '')}"></div>
          <div class="field-row"><label>Pompki (powt.)</label><input type="number" id="pf-pushup" value="${escapeAttr(p.baselineResults?.pushupReps ?? '')}"></div>
          <div class="field-row"><label>Plank (s)</label><input type="number" id="pf-plank" value="${escapeAttr(p.baselineResults?.plankSeconds ?? '')}"></div>
          <button class="primary" id="pf-save" style="margin-top:12px;">Zapisz profil</button>
          <div class="log-errors" id="pf-errors" style="display:none;color:#f87171;font-size:12px;margin-top:8px;"></div>
        </div>
      `;
      contentEl.querySelector('#pf-save').addEventListener('click', () => {
        const newProfile = {
          equipment: contentEl.querySelector('#pf-equipment').value.split(',').map(s => s.trim()).filter(Boolean),
          location: contentEl.querySelector('#pf-location').value.trim(),
          experienceLevel: contentEl.querySelector('#pf-level').value,
          availableDays: contentEl.querySelector('#pf-days').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          availableMinutesPerSession: parseInt(contentEl.querySelector('#pf-minutes').value) || null,
          mainGoal: contentEl.querySelector('#pf-goal').value.trim(),
          limitations: contentEl.querySelector('#pf-limits').value.trim(),
          baselineResults: {
            squatReps: parseInt(contentEl.querySelector('#pf-squat').value) || null,
            pushupReps: parseInt(contentEl.querySelector('#pf-pushup').value) || null,
            plankSeconds: parseInt(contentEl.querySelector('#pf-plank').value) || null
          }
        };
        const result = this.saveProfile(newProfile);
        if (!result.ok) {
          const errEl = contentEl.querySelector('#pf-errors');
          errEl.style.display = 'block';
          errEl.textContent = result.errors.join(' · ');
          return; // NIE re-renderujemy — profil się nie zapisał, błędy widoczne
        }
        this.render(container);
      });
    };

    const renderDay = (dayId) => {
      const day = plan.days.find(d => d.id === dayId);
      const contentEl = container.querySelector('#training-day-content');
      const today = localDateKey();
      const taskId = `${day.id}:${today}`;
      const sessions = Store.get('training:sessions', {});
      const session = sessions[taskId] || { status: 'planned' };
      const isToday = scheduledToday && scheduledToday.id === day.id;
      const loggedCount = this._countLoggedExercisesForDate(day, today);

      const STATUS_LABELS = {
        planned: 'Zaplanowane', in_progress: 'W trakcie', completed: '✓ Ukończone',
        partial: '◐ Częściowo wykonane — dokończ', skipped: 'Pominięte'
      };
      const STATUS_CLASS = {
        planned: '', in_progress: 'warn', completed: 'ok', partial: 'warn', skipped: ''
      };

      contentEl.innerHTML = `
        ${isToday ? `
          <div class="field-row" style="margin:14px 0;flex-wrap:wrap;">
            <span class="badge ${STATUS_CLASS[session.status] || ''}">${STATUS_LABELS[session.status] || session.status}</span>
            <span class="pillar-tag">zalogowano ${loggedCount}/${day.exercises.length} ćwiczeń dziś</span>
            ${session.status === 'planned' || session.status === 'in_progress' || session.status === 'partial' ? `
              <button class="ghost" id="finish-day">${session.status === 'partial' ? 'dokończ i zamknij' : 'zakończ trening'}</button>
              <button class="ghost" id="skip-day">pomiń dzień</button>
            ` : `<button class="ghost" id="undo-day">cofnij</button>`}
          </div>
        ` : ''}
        <div id="exercise-list"></div>
      `;

      const exListEl = contentEl.querySelector('#exercise-list');
      exListEl.innerHTML = day.exercises.map(ex => {
        const pr = this.getExercisePR(ex.id);
        const history = this.getExerciseHistory(ex.id);
        const prText = pr ? (pr.type === 'weight' ? `${pr.value} kg` : pr.type === 'reps' ? `${pr.value} powt.` : `${pr.value}s`) : null;

        const formFields = ex.measurementType === 'weight_reps'
          ? `<input type="number" placeholder="serie" class="lf-sets" style="width:60px;">
             <input type="number" placeholder="powt." class="lf-reps" style="width:60px;">
             <input type="number" placeholder="ciężar (kg)" class="lf-weight" style="width:100px;">`
          : ex.measurementType === 'bodyweight_reps'
          ? `<input type="number" placeholder="serie" class="lf-sets" style="width:60px;">
             <input type="number" placeholder="powt." class="lf-reps" style="width:60px;">`
          : `<input type="number" placeholder="serie" class="lf-sets" style="width:60px;">
             <input type="number" placeholder="czas (s)" class="lf-duration" style="width:90px;">`;
        const rpeField = ex.measurementType !== 'mobility'
          ? `<select class="lf-rpe"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}">${n}</option>`).join('')}</select>`
          : '';

        return `
        <div class="exercise-card" data-ex="${ex.id}">
          <div class="ex-head">
            <span class="ex-name">${ex.name}</span>
            <span class="badge">${ex.measurementType.replace('_',' ')}</span>
          </div>
          <div class="ex-detail"><b>Cel</b>${ex.goal}</div>
          <div class="ex-detail"><b>Rozgrzewka</b>${ex.warmup}</div>
          <div class="ex-detail"><b>Technika</b>${ex.technique}</div>
          <div class="ex-detail"><b>Materiał</b><a href="${ex.material.url}" target="_blank" rel="noopener">${ex.material.title}</a> <span class="pillar-tag">(${ex.material.source}, zweryfikowano ${ex.material.verifiedAt})</span></div>
          <div class="ex-detail"><b>Tempo / przerwa</b>${ex.tempo} · odpoczynek ${ex.restSeconds}s</div>
          <div class="ex-detail"><b>Progresja</b>${ex.progression}</div>
          <div class="ex-detail"><b>Najczęstsze błędy</b>${ex.commonMistakes.join(' · ')}</div>
          <div class="ex-detail"><b>Schłodzenie</b>${ex.cooldown}</div>
          <div class="ex-detail"><b>Rozciąganie</b>${ex.stretching.join(' · ') || '—'}</div>
          ${prText ? `<div class="ex-detail"><b>Rekord</b>${prText}</div>` : ''}

          <div class="log-form" data-target-date="${today}">
            <span class="log-editing-label pillar-tag">wpis na: ${today}</span>
            ${formFields}
            ${rpeField}
            <button class="ghost log-save">zapisz</button>
            <button class="ghost log-cancel" style="display:none;">anuluj edycję</button>
          </div>
          <div class="log-errors" style="display:none;color:#f87171;font-size:11px;margin-top:4px;"></div>

          ${history.length ? `
            <div class="ex-history">
              <div class="pillar-tag" style="margin:8px 0 4px;">Historia (${history.length})</div>
              ${history.slice(0, 8).map(h => {
                const valueText = ex.measurementType === 'duration' || ex.measurementType === 'mobility'
                  ? `${h.sets}× ${h.durationSeconds ?? '—'}s`
                  : `${h.sets}×${h.reps ?? '—'}${h.weight != null ? ' @ ' + h.weight + 'kg' : ''}`;
                return `<div class="history-row">
                  <span>${h.date} — ${valueText}${h.rpe ? ', RPE ' + h.rpe : ''}</span>
                  <button class="mini-btn edit-log" data-date="${h.date}">edytuj</button>
                  <button class="mini-btn del-log" data-date="${h.date}">usuń</button>
                </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
      }).join('');

      exListEl.querySelectorAll('.exercise-card').forEach(card => {
        const exId = card.dataset.ex;
        const errBox = card.querySelector('.log-errors');
        const logForm = card.querySelector('.log-form');

        function readForm() {
          return {
            sets: card.querySelector('.lf-sets')?.value,
            reps: card.querySelector('.lf-reps')?.value,
            durationSeconds: card.querySelector('.lf-duration')?.value,
            weight: card.querySelector('.lf-weight')?.value,
            rpe: card.querySelector('.lf-rpe')?.value
          };
        }

        card.querySelector('.log-save').addEventListener('click', () => {
          const targetDate = logForm.dataset.targetDate;
          const raw = readForm();
          const result = this.upsertExerciseLog(exId, targetDate, raw);
          if (!result.ok) {
            errBox.style.display = 'block';
            errBox.textContent = result.errors.join(' · ');
            return;
          }
          errBox.style.display = 'none';
          renderDay(dayId);
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        });

        card.querySelectorAll('.edit-log').forEach(btn => {
          btn.addEventListener('click', () => {
            const date = btn.dataset.date;
            const history = this.getExerciseHistory(exId);
            const entry = history.find(h => h.date === date);
            if (!entry) return;
            logForm.dataset.targetDate = date;
            logForm.querySelector('.log-editing-label').textContent = 'wpis na: ' + date + ' (edycja)';
            if (card.querySelector('.lf-sets')) card.querySelector('.lf-sets').value = entry.sets ?? '';
            if (card.querySelector('.lf-reps')) card.querySelector('.lf-reps').value = entry.reps ?? '';
            if (card.querySelector('.lf-duration')) card.querySelector('.lf-duration').value = entry.durationSeconds ?? '';
            if (card.querySelector('.lf-weight')) card.querySelector('.lf-weight').value = entry.weight ?? '';
            if (card.querySelector('.lf-rpe')) card.querySelector('.lf-rpe').value = entry.rpe ?? '';
            logForm.querySelector('.log-cancel').style.display = 'inline-block';
          });
        });

        const cancelBtn = logForm.querySelector('.log-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => renderDay(dayId));

        card.querySelectorAll('.del-log').forEach(btn => {
          btn.addEventListener('click', () => {
            if (!confirm('Usunąć ten wpis z historii?')) return;
            this.deleteExerciseLog(exId, btn.dataset.date);
            renderDay(dayId);
            if (typeof renderTodayTasks === 'function') renderTodayTasks();
          });
        });
      });

      if (isToday) {
        const finishBtn = contentEl.querySelector('#finish-day');
        if (finishBtn) finishBtn.addEventListener('click', () => {
          finishSession(day.id, today);
          renderDay(dayId);
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        });
        const skipBtn = contentEl.querySelector('#skip-day');
        if (skipBtn) skipBtn.addEventListener('click', () => {
          skipSession(day.id, today);
          renderDay(dayId);
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        });
        const undoBtn = contentEl.querySelector('#undo-day');
        if (undoBtn) undoBtn.addEventListener('click', () => {
          undoSession(day.id, today);
          renderDay(dayId);
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        });
      }
    };

    function selectTab(dayId) {
      tabsEl.querySelectorAll('.train-tab').forEach(b => b.classList.remove('active'));
      tabsEl.querySelector(`[data-day="${dayId}"]`)?.classList.add('active');
      if (dayId === 'profile') renderProfileTab(); else renderDay(dayId);
    }

    tabsEl.querySelectorAll('.train-tab').forEach(btn => {
      btn.addEventListener('click', () => selectTab(btn.dataset.day));
    });

    const initialDay = scheduledToday ? scheduledToday.id : plan.days[0].id;
    selectTab(initialDay);
  }
};
ModuleRegistry.register(TrainingModule);


/* ============================================================
   DANE / ROADMAP_STAGES — droga do pierwszej pracy w IT
   ============================================================
   14 etapów, każdy z jawnym uzasadnieniem "dlaczego teraz".
   Kolejność wynika z realnych zależności (nie da się sensownie
   uczyć OOP przed podstawami Pythona, ani API przed backendem).
   Kryteria ukończenia PODWÓJNIE pełnią rolę: to zarówno "czy etap
   jest zaliczony" (wymóg architektury), JAK I konkretne zadania
   IT eksponowane przez getTasks() — bez tego rozdwojenia
   musielibyśmy budować osobny system zadań obok kryteriów,
   co byłoby niepotrzebnym duplikatem tej samej informacji.
   ============================================================ */
const ROADMAP_STAGES = [
  {
    id: 'stage-linux', order: 1, name: 'Linux',
    description: 'Sprawna praca w terminalu i systemie operacyjnym, na którym będziesz pracować codziennie.',
    why: 'Terminal i system operacyjny to fundament wszystkiego, co zrobisz dalej — bez tego nawet uruchomienie kolejnych narzędzi jest trudniejsze.',
    prerequisites: [],
    willLearn: ['Nawigacja i operacje na plikach w terminalu', 'Zarządzanie pakietami', 'Uprawnienia i procesy'],
    skillsGained: ['Samodzielność w konfiguracji środowiska pracy', 'Szybkość pracy bez GUI'],
    estimatedHours: 8,
    projects: ['Skonfigurowane własne środowisko (dotfiles + aliasy dopasowane do siebie)'],
    finalTest: 'Swobodna praca w terminalu bez ściągi — nawigacja, pakiety, uprawnienia.',
    criteria: [
      { id: 'linux-terminal', title: 'Terminal: cd, ls, pwd, cp, mv, rm, mkdir', estimatedMinutes: 40, difficulty: 2, xp: 20 },
      { id: 'linux-pipes', title: 'Potoki i przekierowania: | > >>', estimatedMinutes: 30, difficulty: 2, xp: 20 },
      { id: 'linux-pkg', title: 'Zarządzanie pakietami (instalacja/aktualizacja)', estimatedMinutes: 30, difficulty: 2, xp: 20 },
      { id: 'linux-dotfiles', title: 'Skonfigurowane dotfiles + własne aliasy', estimatedMinutes: 45, difficulty: 3, xp: 30 }
    ]
  },
  {
    id: 'stage-git', order: 2, name: 'Git',
    description: 'Kontrola wersji — bezpieczna siatka do eksperymentowania z kodem.',
    why: 'Zanim zaczniesz pisać większy kod, potrzebujesz sposobu na cofnięcie błędu bez utraty pracy — Git to standard, nie opcja.',
    prerequisites: ['stage-linux'],
    willLearn: ['Podstawowy przepływ pracy z Gitem', 'Branching i merge', 'Historia zmian'],
    skillsGained: ['Bezpieczne eksperymentowanie z kodem', 'Czytelna historia pracy'],
    estimatedHours: 6,
    projects: ['Repo dla każdego kolejnego projektu od tego etapu wzwyż'],
    finalTest: 'Codzienny commit bez wahania, świadome użycie branch/merge.',
    criteria: [
      { id: 'git-basics', title: 'git init / add / commit / log', estimatedMinutes: 30, difficulty: 2, xp: 20 },
      { id: 'git-branch', title: 'git branch i git merge', estimatedMinutes: 40, difficulty: 3, xp: 25 },
      { id: 'git-ignore', title: 'Zrozumiany i użyty .gitignore', estimatedMinutes: 15, difficulty: 1, xp: 15 },
      { id: 'git-daily', title: 'Codzienny commit — nawyk uruchomiony', estimatedMinutes: 10, difficulty: 1, xp: 20 }
    ]
  },
  {
    id: 'stage-github', order: 3, name: 'GitHub',
    description: 'Publiczna obecność Twojej pracy — miejsce, gdzie rekruter zobaczy dowód umiejętności.',
    why: 'Twoje portfolio musi być gdzieś publicznie widoczne — GitHub to standard branży, nie tylko backup kodu.',
    prerequisites: ['stage-git'],
    willLearn: ['Repozytoria publiczne', 'README jako wizytówka projektu', 'Issues i podstawowy workflow'],
    skillsGained: ['Prezentacja pracy w sposób czytelny dla innych'],
    estimatedHours: 4,
    projects: ['Profil GitHub gotowy do pokazania rekruterowi'],
    finalTest: 'Publiczne repo z historią commitów i porządnym README.',
    criteria: [
      { id: 'github-account', title: 'Konto i pierwsze publiczne repo', estimatedMinutes: 20, difficulty: 1, xp: 15 },
      { id: 'github-readme', title: 'README opisujące projekt (cel, jak uruchomić)', estimatedMinutes: 40, difficulty: 2, xp: 25 },
      { id: 'github-issues', title: 'Użycie Issues do śledzenia zadań', estimatedMinutes: 20, difficulty: 2, xp: 15 }
    ]
  },
  {
    id: 'stage-python', order: 4, name: 'Python',
    description: 'Fundamenty programowania w praktycznym, przystępnym języku.',
    why: 'Python to najbardziej przystępny start do fundamentów programowania, z ogromnym zastosowaniem w backendzie i automatyzacji.',
    prerequisites: ['stage-github'],
    willLearn: ['Składnia, typy, pętle, funkcje', 'Struktury danych (listy, słowniki)', 'Praca z plikami, obsługa błędów'],
    skillsGained: ['Samodzielne pisanie działających skryptów'],
    estimatedHours: 25,
    projects: ['CLI To-Do App — menedżer zadań w terminalu z zapisem do pliku'],
    finalTest: 'Napisz skrypt z funkcją i obsługą błędów bez patrzenia w notatki.',
    criteria: [
      { id: 'py-basics', title: 'Zmienne, typy, pętle, funkcje', estimatedMinutes: 90, difficulty: 2, xp: 30 },
      { id: 'py-structures', title: 'Listy, słowniki, krotki, sety', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'py-files', title: 'Praca z plikami i obsługa błędów (try/except)', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'py-project', title: 'CLI To-Do App działający i wypchnięty na GitHub', estimatedMinutes: 120, difficulty: 4, xp: 60 }
    ]
  },
  {
    id: 'stage-oop', order: 5, name: 'OOP',
    description: 'Programowanie obiektowe — sposób organizacji kodu używany w realnych projektach.',
    why: 'Realny kod produkcyjny i większość rozmów rekrutacyjnych zakładają znajomość OOP — naturalny krok po podstawach Pythona.',
    prerequisites: ['stage-python'],
    willLearn: ['Klasy i obiekty', 'Dziedziczenie', 'Hermetyzacja'],
    skillsGained: ['Organizacja większego kodu w spójny sposób'],
    estimatedHours: 15,
    projects: ['Przepisanie CLI To-Do App na klasy zamiast luźnych funkcji'],
    finalTest: 'Zaprojektuj od zera prosty system klas dla nowego, małego problemu.',
    criteria: [
      { id: 'oop-classes', title: 'Klasy, obiekty, metody, atrybuty', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'oop-inheritance', title: 'Dziedziczenie i nadpisywanie metod', estimatedMinutes: 60, difficulty: 4, xp: 35 },
      { id: 'oop-refactor', title: 'Przepisanie istniejącego projektu na klasy', estimatedMinutes: 90, difficulty: 4, xp: 45 }
    ]
  },
  {
    id: 'stage-algorytmy', order: 6, name: 'Algorytmy i struktury danych',
    description: 'Myślenie algorytmiczne i podstawowe struktury danych.',
    why: 'Rozmowy kwalifikacyjne w IT niemal zawsze sprawdzają myślenie algorytmiczne — lepiej zbudować to teraz niż uczyć się pod presją przed rozmową.',
    prerequisites: ['stage-oop'],
    willLearn: ['Złożoność obliczeniowa (Big O)', 'Stos, kolejka, lista', 'Sortowanie i wyszukiwanie'],
    skillsGained: ['Ocena wydajności własnego kodu', 'Pewność siebie na rozmowach technicznych'],
    estimatedHours: 20,
    projects: ['Repozytorium z rozwiązaniami zadań algorytmicznych'],
    finalTest: '10 zadań poziomu easy rozwiązanych samodzielnie.',
    criteria: [
      { id: 'algo-bigo', title: 'Złożoność obliczeniowa — podstawy Big O', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'algo-structures', title: 'Stos, kolejka, lista łączona — implementacja', estimatedMinutes: 90, difficulty: 4, xp: 40 },
      { id: 'algo-sorting', title: 'Sortowanie i wyszukiwanie — implementacja i porównanie', estimatedMinutes: 90, difficulty: 4, xp: 40 },
      { id: 'algo-practice', title: '10 zadań (easy) rozwiązanych samodzielnie', estimatedMinutes: 180, difficulty: 4, xp: 60 }
    ]
  },
  {
    id: 'stage-sql', order: 7, name: 'SQL',
    description: 'Praca z bazami danych — język, którego wymaga niemal każda oferta juniora.',
    why: 'Prawie każda aplikacja backendowa rozmawia z bazą danych — SQL jest wymagany w niemal każdej ofercie pracy juniora.',
    prerequisites: ['stage-algorytmy'],
    willLearn: ['SELECT, WHERE, JOIN', 'Projektowanie prostych tabel', 'Agregacje (GROUP BY)'],
    skillsGained: ['Samodzielne odpytywanie i projektowanie baz danych'],
    estimatedHours: 12,
    projects: ['Baza danych do CLI To-Do App zamiast zapisu do pliku'],
    finalTest: 'Napisz 3 zapytania z JOIN bez pomocy.',
    criteria: [
      { id: 'sql-select', title: 'SELECT, WHERE, ORDER BY', estimatedMinutes: 45, difficulty: 2, xp: 25 },
      { id: 'sql-join', title: 'JOIN — łączenie danych z wielu tabel', estimatedMinutes: 60, difficulty: 4, xp: 35 },
      { id: 'sql-design', title: 'Projektowanie prostych tabel (klucze, relacje)', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'sql-project', title: 'Baza danych podpięta do własnego projektu', estimatedMinutes: 90, difficulty: 4, xp: 45 }
    ]
  },
  {
    id: 'stage-backend', order: 8, name: 'Backend',
    description: 'Łączenie Pythona, OOP i SQL w jedną, realną aplikację serwerową.',
    why: 'To pierwszy moment, w którym łączysz wszystko czego się nauczyłeś w jedną, realną aplikację — most między nauką a portfolio.',
    prerequisites: ['stage-sql'],
    willLearn: ['Podstawy frameworka backendowego', 'Routing i CRUD', 'Połączenie z bazą danych'],
    skillsGained: ['Budowa działającej aplikacji serwerowej od zera'],
    estimatedHours: 25,
    projects: ['Prosta aplikacja CRUD z bazą danych (np. rozbudowany To-Do jako serwis)'],
    finalTest: 'Zbuduj działające API CRUD z bazą danych bez gotowego szablonu.',
    criteria: [
      { id: 'backend-framework', title: 'Podstawy frameworka (routing, widoki)', estimatedMinutes: 90, difficulty: 3, xp: 35 },
      { id: 'backend-crud', title: 'CRUD — Create/Read/Update/Delete', estimatedMinutes: 120, difficulty: 4, xp: 45 },
      { id: 'backend-db', title: 'Połączenie aplikacji z bazą danych', estimatedMinutes: 90, difficulty: 4, xp: 40 },
      { id: 'backend-validation', title: 'Walidacja danych i obsługa błędów API', estimatedMinutes: 60, difficulty: 3, xp: 30 }
    ]
  },
  {
    id: 'stage-api', order: 9, name: 'API',
    description: 'Komunikacja między aplikacjami — sposób, w jaki nowoczesne systemy się ze sobą łączą.',
    why: 'Nowoczesne aplikacje komunikują się przez API — to też najczęstszy sposób integrowania własnego backendu z frontendem lub innymi usługami.',
    prerequisites: ['stage-backend'],
    willLearn: ['REST — metody i statusy HTTP', 'JSON i serializacja danych', 'Konsumowanie zewnętrznego API'],
    skillsGained: ['Projektowanie i dokumentowanie własnego API'],
    estimatedHours: 12,
    projects: ['Klient konsumujący zewnętrzne API + udokumentowane własne API'],
    finalTest: 'Pobierz i przetwórz dane z publicznego API bez pomocy.',
    criteria: [
      { id: 'api-rest', title: 'REST — metody i statusy HTTP', estimatedMinutes: 45, difficulty: 2, xp: 25 },
      { id: 'api-json', title: 'JSON i serializacja danych', estimatedMinutes: 30, difficulty: 2, xp: 20 },
      { id: 'api-consume', title: 'Konsumowanie zewnętrznego API (np. pogodowego)', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'api-docs', title: 'Dokumentacja własnego API', estimatedMinutes: 45, difficulty: 2, xp: 25 }
    ]
  },
  {
    id: 'stage-portfolio', order: 10, name: 'Projekty portfolio',
    description: 'Domknięcie kilku projektów do poziomu, który można pokazać rekruterowi.',
    why: 'Rekruter poświęca CV kilka sekund — bez konkretnych, widocznych projektów nie masz jak udowodnić umiejętności.',
    prerequisites: ['stage-api'],
    willLearn: ['Dopracowywanie projektu do stanu prezentowalnego', 'Wdrożenie/demo online'],
    skillsGained: ['Portfolio gotowe do wysłania rekruterowi'],
    estimatedHours: 20,
    projects: ['3 dopracowane projekty z poprzednich etapów, każdy z demo i README'],
    finalTest: 'Portfolio z 3 projektami gotowe do wysłania rekruterowi.',
    criteria: [
      { id: 'portfolio-3projects', title: '3 dopracowane projekty wybrane i uporządkowane', estimatedMinutes: 120, difficulty: 3, xp: 40 },
      { id: 'portfolio-readme', title: 'README dla każdego projektu (cel, stack, jak uruchomić)', estimatedMinutes: 90, difficulty: 2, xp: 30 },
      { id: 'portfolio-demo', title: 'Wdrożenie/demo online przynajmniej jednego projektu', estimatedMinutes: 120, difficulty: 4, xp: 45 }
    ]
  },
  {
    id: 'stage-testy', order: 11, name: 'Testy',
    description: 'Pisanie testów — umiejętność odróżniająca hobbystę od kogoś gotowego do pracy zespołowej.',
    why: 'Umiejętność pisania testów pokazuje gotowość do pracy w zespole — pracodawcy o to pytają na rozmowach.',
    prerequisites: ['stage-portfolio'],
    willLearn: ['Podstawy pytest/unittest', 'Testy jednostkowe', 'Pokrycie krytycznych ścieżek kodu'],
    skillsGained: ['Pewność, że kod faktycznie działa zgodnie z założeniem'],
    estimatedHours: 12,
    projects: ['Zestaw testów jednostkowych dla jednego z projektów portfolio'],
    finalTest: 'Testy pokrywają kluczowe funkcje wybranego projektu.',
    criteria: [
      { id: 'test-basics', title: 'Podstawy pytest/unittest', estimatedMinutes: 60, difficulty: 3, xp: 30 },
      { id: 'test-unit', title: 'Testy jednostkowe dla własnego projektu', estimatedMinutes: 90, difficulty: 3, xp: 35 },
      { id: 'test-coverage', title: 'Pokrycie krytycznych ścieżek kodu testami', estimatedMinutes: 60, difficulty: 3, xp: 30 }
    ]
  },
  {
    id: 'stage-docker', order: 12, name: 'Docker',
    description: 'Standard uruchamiania i wdrażania aplikacji w izolowanym środowisku.',
    why: 'Docker to dziś standard uruchamiania aplikacji — pokazuje, że rozumiesz środowisko produkcyjne, nie tylko sam kod.',
    prerequisites: ['stage-testy'],
    willLearn: ['Obrazy i kontenery', 'Dockerfile', 'docker-compose (aplikacja + baza danych)'],
    skillsGained: ['Uruchomienie własnej aplikacji w izolowanym, powtarzalnym środowisku'],
    estimatedHours: 10,
    projects: ['Zdockeryzowany projekt backendowy z bazą danych w docker-compose'],
    finalTest: 'Uruchom własny projekt w kontenerze bez pomocy.',
    criteria: [
      { id: 'docker-basics', title: 'Obrazy i kontenery — podstawowe pojęcia i komendy', estimatedMinutes: 45, difficulty: 2, xp: 25 },
      { id: 'docker-dockerfile', title: 'Dockerfile dla własnego projektu', estimatedMinutes: 60, difficulty: 4, xp: 35 },
      { id: 'docker-compose', title: 'docker-compose — aplikacja + baza danych razem', estimatedMinutes: 90, difficulty: 4, xp: 40 }
    ]
  },
  {
    id: 'stage-cicd', order: 13, name: 'Podstawy CI/CD',
    description: 'Automatyzacja testów i wdrożeń — praktyka realnej pracy zespołowej.',
    why: 'Automatyzacja testów i wdrożeń to realna praktyka pracy zespołowej — nawet podstawowy pipeline pokazuje gotowość do pracy w zespole.',
    prerequisites: ['stage-docker'],
    willLearn: ['GitHub Actions — podstawowy pipeline', 'Automatyczne uruchamianie testów', 'Automatyczny build/deploy demo'],
    skillsGained: ['Zrozumienie cyklu życia kodu od commita do wdrożenia'],
    estimatedHours: 8,
    projects: ['Pipeline GitHub Actions dla jednego z projektów portfolio'],
    finalTest: 'Pipeline automatycznie uruchamia testy przy każdym pushu.',
    criteria: [
      { id: 'cicd-actions', title: 'Podstawowy pipeline w GitHub Actions', estimatedMinutes: 60, difficulty: 4, xp: 35 },
      { id: 'cicd-tests', title: 'Automatyczne uruchamianie testów w pipeline', estimatedMinutes: 45, difficulty: 3, xp: 30 },
      { id: 'cicd-deploy', title: 'Automatyczny build/deploy demo', estimatedMinutes: 60, difficulty: 4, xp: 35 }
    ]
  },
  {
    id: 'stage-recruitment', order: 14, name: 'Przygotowanie do rekrutacji',
    description: 'Przełożenie zdobytych kompetencji na realną szansę zatrudnienia.',
    why: 'Wszystkie poprzednie etapy budowały kompetencje — ten etap przekłada je na realną szansę zatrudnienia. To cel, do którego prowadzi cała reszta.',
    prerequisites: ['stage-cicd'],
    willLearn: ['Budowa CV pod IT', 'Podstawy rozmowy technicznej', 'Aktualizacja profilu zawodowego (LinkedIn)'],
    skillsGained: ['Gotowość do realnego procesu rekrutacyjnego'],
    estimatedHours: 15,
    projects: [],
    finalTest: 'Przejdź symulację rozmowy technicznej.',
    criteria: [
      { id: 'recruit-cv', title: 'CV dopasowane pod branżę IT', estimatedMinutes: 90, difficulty: 2, xp: 30 },
      { id: 'recruit-linkedin', title: 'Zaktualizowany profil LinkedIn', estimatedMinutes: 45, difficulty: 1, xp: 20 },
      { id: 'recruit-mock', title: 'Symulacja rozmowy technicznej', estimatedMinutes: 60, difficulty: 4, xp: 40 },
      { id: 'recruit-applications', title: 'Pierwsze aplikacje wysłane (śledzone)', estimatedMinutes: 60, difficulty: 3, xp: 35 }
    ]
  }
];

/* ============================================================
   ENGINE / RoadmapEngine
   ============================================================
   ODPOWIEDZIALNOŚĆ WYŁĄCZNIE: obliczanie postępu, odblokowywanie
   kolejnych etapów, sprawdzanie wymagań wstępnych, wyliczanie %
   ukończenia. NIE RENDERUJE UI. NIE ZNA HTML — żadnego odwołania
   do `document` w tym bloku (weryfikowane w analizie integralności
   na końcu Kroku 5). Czyta/zapisuje WYŁĄCZNIE przez Store, tak
   samo jak DayEngine/HabitEngine/PriorityEngine — spójne z resztą
   architektury.
   ============================================================ */
/* ============================================================
   WALIDACJA / validateRoadmapDefinition
   Odpowiedzialność: jedna — sprawdzić ROADMAP_STAGES PRZED
   użyciem. Błędy zatrzymują rejestrację LearningModule (patrz
   dół pliku) — zła definicja roadmapy nigdy nie trafia do UI.
   ============================================================ */
function validateRoadmapDefinition(stages) {
  const errors = [];
  const ids = stages.map(s => s.id);
  const idSet = new Set(ids);

  if (idSet.size !== ids.length) errors.push('Duplikat stage.id wykryty w definicji roadmapy.');

  const allCriterionIds = stages.flatMap(s => (s.criteria || []).map(c => c.id));
  if (new Set(allCriterionIds).size !== allCriterionIds.length) errors.push('Duplikat criterion.id wykryty globalnie (kryteria muszą mieć unikalne id w całej roadmapie).');

  const orders = stages.map(s => s.order);
  if (new Set(orders).size !== orders.length) errors.push('Duplikat pola order wykryty w definicji roadmapy.');

  stages.forEach(s => {
    ['id', 'name', 'description', 'why', 'finalTest'].forEach(f => {
      if (typeof s[f] !== 'string' || !s[f].trim()) errors.push(`Etap ${s.id || '?'}: pole "${f}" musi być niepustym stringiem.`);
    });
    ['prerequisites', 'willLearn', 'skillsGained', 'projects', 'criteria'].forEach(f => {
      if (!Array.isArray(s[f])) errors.push(`Etap ${s.id}: pole "${f}" musi być tablicą.`);
    });
    if (!Number.isFinite(s.estimatedHours) || s.estimatedHours <= 0) errors.push(`Etap ${s.id}: estimatedHours musi być dodatnią liczbą.`);
    if (!Array.isArray(s.criteria) || s.criteria.length === 0) errors.push(`Etap ${s.id}: musi mieć co najmniej jedno kryterium ukończenia.`);

    (s.criteria || []).forEach(c => {
      if (typeof c.id !== 'string' || !c.id.trim()) { errors.push(`Etap ${s.id}: kryterium bez poprawnego id.`); return; }
      if (typeof c.title !== 'string' || !c.title.trim()) errors.push(`Kryterium ${c.id}: title musi być niepustym stringiem.`);
      if (!Number.isFinite(c.estimatedMinutes) || c.estimatedMinutes <= 0) errors.push(`Kryterium ${c.id}: estimatedMinutes musi być dodatnią liczbą.`);
      if (!Number.isInteger(c.difficulty) || c.difficulty < 1 || c.difficulty > 5) errors.push(`Kryterium ${c.id}: difficulty musi być liczbą całkowitą 1-5.`);
      if (!Number.isInteger(c.xp) || c.xp <= 0 || c.xp > 200) errors.push(`Kryterium ${c.id}: xp musi być liczbą całkowitą 1-200 (poza tym zakresem to prawdopodobnie pomyłka, nie zamierzona wartość).`);
    });

    (s.prerequisites || []).forEach(p => {
      if (p === s.id) errors.push(`Etap ${s.id}: nie może być własnym prerequisite.`);
      else if (!idSet.has(p)) errors.push(`Etap ${s.id}: nieistniejący prerequisite "${p}".`);
    });
  });

  // Model liniowy: dokładnie jeden etap początkowy (bez prerequisites).
  const startStages = stages.filter(s => Array.isArray(s.prerequisites) && s.prerequisites.length === 0);
  if (startStages.length !== 1) {
    errors.push(`Obecny model liniowy wymaga dokładnie jednego etapu początkowego (bez prerequisites) — znaleziono: ${startStages.length}.`);
  }

  // Model liniowy: maksymalnie jeden bezpośredni następca na etap —
  // czyli żaden stage.id nie może być prerequisite dla więcej niż
  // jednego innego etapu (to byłoby rozgałęzienie, którego
  // getActiveStage() świadomie nie obsługuje na tym etapie rozwoju).
  const successorCount = {};
  stages.forEach(s => (s.prerequisites || []).forEach(p => { successorCount[p] = (successorCount[p] || 0) + 1; }));
  Object.entries(successorCount).forEach(([stageId, count]) => {
    if (count > 1) errors.push(`Etap "${stageId}" ma ${count} bezpośrednich następców — model liniowy dopuszcza maksymalnie jednego.`);
  });

  // Wykrywanie cykli (DFS po grafie prerequisites).
  const graph = {};
  stages.forEach(s => { graph[s.id] = (s.prerequisites || []).filter(p => idSet.has(p)); });
  const visiting = new Set(), visited = new Set();
  let cycleFound = false;
  function dfs(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) { cycleFound = true; return; }
    visiting.add(node);
    (graph[node] || []).forEach(dfs);
    visiting.delete(node);
    visited.add(node);
  }
  stages.forEach(s => dfs(s.id));
  if (cycleFound) errors.push('Wykryto cykl w zależnościach prerequisites — roadmapa nie może się nigdy w pełni odblokować.');

  return { valid: errors.length === 0, errors };
}

/* ============================================================
   ENGINE / RoadmapEngine
   ============================================================
   ODPOWIEDZIALNOŚĆ WYŁĄCZNIE: obliczanie postępu, odblokowywanie
   kolejnych etapów, sprawdzanie wymagań wstępnych, wyliczanie %
   ukończenia. NIE RENDERUJE UI. NIE ZNA HTML. Czyta/zapisuje
   WYŁĄCZNIE przez Store.

   MODEL LINIOWY WYMUSZONY: getActiveStage() zwraca POJEDYNCZY
   etap i zakłada, że co najwyżej jeden istnieje naraz — gwarantuje
   to validateRoadmapDefinition() (dokładnie jeden start, max jeden
   następca na etap, brak cykli). getActiveStages() (mnoga) istnieje
   jako wewnętrzny hak bezpieczeństwa — WYKRYWA naruszenie tego
   założenia i głośno o nim informuje, zamiast cicho zwracać błędne
   dane. Nie jest to pełny system rozgałęzień — świadomie, zgodnie
   z zasadą "nie rozbudowuj bez potrzeby".
   ============================================================ */
const RoadmapEngine = (() => {
  function getStage(stageId) {
    return ROADMAP_STAGES.find(s => s.id === stageId) || null;
  }

  function deriveInitialStatuses() {
    const map = {};
    ROADMAP_STAGES.forEach(s => { map[s.id] = 'locked'; });
    recomputeStatuses(map);
    return map;
  }

  // Jedno źródło prawdy dla przeliczania active/locked z prerequisites.
  // Używane zarówno przez reconcileRoadmapState(), jak i completeStage() —
  // żeby te dwie funkcje nigdy nie mogły się rozjechać w logice odblokowania.
  // Etapy 'done' NIGDY nie są tu nadpisywane.
  function recomputeStatuses(statuses) {
    ROADMAP_STAGES.forEach(s => {
      if (statuses[s.id] === 'done') return;
      const prereqsDone = (s.prerequisites || []).every(p => statuses[p] === 'done');
      statuses[s.id] = prereqsDone ? 'active' : 'locked';
    });
    return statuses;
  }

  function getStageStatuses() {
    return Store.get('it:stageStatuses', null) || deriveInitialStatuses();
  }

  // Liczba mnoga — hak bezpieczeństwa, NIE oficjalne API rozgałęzień.
  function getActiveStages() {
    const statuses = getStageStatuses();
    return ROADMAP_STAGES.filter(s => statuses[s.id] === 'active');
  }

  function getActiveStage() {
    const actives = getActiveStages();
    if (actives.length > 1) {
      console.error('RoadmapEngine: wykryto więcej niż jeden aktywny etap jednocześnie — model zakłada liniowość (patrz validateRoadmapDefinition). To błąd integralności danych, nie oczekiwany stan.');
    }
    return actives[0] || null;
  }

  // ==== Stan kryteriów — ustrukturyzowany rekord {status, completedDate} ====
  function getCriteriaState() {
    return Store.get('it:criteriaDone', {});
  }

  function isCriterionDone(criterionId) {
    const state = getCriteriaState();
    return !!(state[criterionId] && state[criterionId].status === 'done');
  }

  function setCriterionStatus(criterionId, status) {
    const state = getCriteriaState();
    state[criterionId] = { status, completedDate: status === 'done' ? localDateKey() : null };
    Store.set('it:criteriaDone', state);
  }

  // % ukończenia etapu = zaliczone kryteria / wszystkie kryteria.
  function getProgress(stageId) {
    const stage = getStage(stageId);
    if (!stage || !stage.criteria.length) return 0;
    const done = stage.criteria.filter(c => isCriterionDone(c.id)).length;
    return Math.round((done / stage.criteria.length) * 100);
  }

  function prerequisitesMet(stageId) {
    const stage = getStage(stageId);
    if (!stage) return false;
    const statuses = getStageStatuses();
    return stage.prerequisites.every(p => statuses[p] === 'done');
  }

  function canCompleteStage(stageId) {
    const statuses = getStageStatuses();
    return statuses[stageId] === 'active' && getProgress(stageId) === 100;
  }

  function completeStage(stageId) {
    if (!canCompleteStage(stageId)) {
      return { ok: false, reason: 'Etap nie jest aktywny albo nie wszystkie kryteria są ukończone.' };
    }
    const statuses = getStageStatuses();
    statuses[stageId] = 'done';
    recomputeStatuses(statuses); // ta sama logika co reconcileRoadmapState — jedno źródło prawdy
    Store.set('it:stageStatuses', statuses);
    EventBus.emit('roadmap:stageComplete', { stageId });
    return { ok: true };
  }

  // Postęp liczony WYŁĄCZNIE na podstawie aktualnych ROADMAP_STAGES —
  // jeśli etap zniknął z definicji, jego status (nawet jeśli wciąż
  // zapisany w Store) nie wlicza się do total/done poniżej.
  function getOverallProgress() {
    const statuses = getStageStatuses();
    const currentIds = ROADMAP_STAGES.map(s => s.id);
    const done = currentIds.filter(id => statuses[id] === 'done').length;
    return { done, total: currentIds.length, percent: Math.round((done / currentIds.length) * 100) };
  }

  // ==== reconcileRoadmapState ====
  // Synchronizuje zapisany stan z AKTUALNĄ definicją ROADMAP_STAGES.
  // Wywoływana raz, po walidacji definicji, przed pierwszym renderem
  // (patrz dół pliku, przy rejestracji modułu). Nigdy nie dotyka
  // it:criteriaDone ani it:lessonGuides — reconcile dotyczy WYŁĄCZNIE
  // statusów etapów.
  function reconcileRoadmapState() {
    const currentIds = new Set(ROADMAP_STAGES.map(s => s.id));
    let statuses = Store.get('it:stageStatuses', null);

    if (!statuses) {
      Store.set('it:stageStatuses', deriveInitialStatuses());
      return;
    }

    // usuń statusy etapów, których już nie ma w definicji
    Object.keys(statuses).forEach(id => { if (!currentIds.has(id)) delete statuses[id]; });

    // dodaj brakujące etapy jako locked (przeliczenie niżej i tak
    // ustali właściwy status na podstawie prerequisites)
    ROADMAP_STAGES.forEach(s => { if (!(s.id in statuses)) statuses[s.id] = 'locked'; });

    // przelicz active/locked z prerequisites — 'done' jest zachowywane
    // (recomputeStatuses nigdy nie nadpisuje 'done')
    recomputeStatuses(statuses);

    Store.set('it:stageStatuses', statuses);
  }

  return {
    getStage, getStageStatuses, getActiveStage, getActiveStages,
    getCriteriaState, isCriterionDone, setCriterionStatus,
    getProgress, prerequisitesMet, canCompleteStage, completeStage, getOverallProgress,
    deriveInitialStatuses, reconcileRoadmapState, recomputeStatuses
  };
})();

/* ============================================================
   LessonGuide — Krok 7: pełny model, walidacja, import, ochrona
   danych historycznych
   ============================================================
   Zasada z ustaleń Kroku 7: LessonGuide generowany jest NA ŻĄDANIE,
   per kryterium, nigdy hurtowo dla wszystkich 14 etapów naraz.
   LessonGuide to treść przypisana do istniejącego kryterium —
   NIGDY zadanie. Nie pojawia się w getTasks(), nie ma wpływu na
   getStats(), setTaskStatus(), RoadmapEngine, PriorityEngine,
   DecisionEngine ani na ekran "Dziś".
   ============================================================ */

// Jedyne źródło znacznika czasu dla WSZYSTKICH operacji LessonGuide.
// Cel: (1) jedno miejsce do ewentualnego nadpisania w testach zamiast
// rozproszonych wywołań new Date() po całym kodzie, (2) NIE zakładamy
// nigdzie indziej, że dwa kolejne wywołania dają różne wartości —
// to prawdziwy czas produkcyjny, bez sztucznego doklejania milisekund.
function nowIso() {
  return new Date().toISOString();
}

function isValidIsoTimestamp(str) {
  if (typeof str !== 'string') return false;
  // Format dokładnie taki, jaki zwraca Date.prototype.toISOString() —
  // jedyny pisarz tych pól w aplikacji, więc restrykcyjny regex jest bezpieczny.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(str)) return false;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return false;
  // Sprawdzenie semantyczne (round-trip): Date normalizuje po cichu
  // nieistniejące wartości (np. "2026-02-30..." -> realny dzień w marcu),
  // dokładnie ten sam problem co przy walidacji dat kalendarzowych w
  // Kroku 6. Napis wygląda poprawnie tekstowo, ale nie reprezentuje
  // tego, co twierdzi — odrzucamy, jeśli toISOString() nie odtwarza
  // dokładnie oryginalnego stringa.
  return d.toISOString() === str;
}

function isStringArray(v) {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

// Walidacja WYŁĄCZNIE strukturalna i protokołu — aplikacja nie ma
// i nie będzie miała w tym kroku dostępu do sieci. Nie sprawdza, czy
// strona odpowiada. status:'reviewed' nigdy nie oznacza "link działa".
function isValidResourceUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try { parsed = new URL(url.trim()); }
  catch (e) { return false; }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

const RESOURCE_SOURCE_TYPES = ['documentation', 'article', 'video', 'course', 'community', 'other'];
const RESOURCE_LANGUAGES = ['pl', 'en', 'other'];

function validateResource(r) {
  const errors = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { valid: false, errors: ['nie jest obiektem'] };
  if (typeof r.id !== 'string' || !r.id) errors.push('id: wymagany');
  if (typeof r.title !== 'string' || !r.title.trim()) errors.push('title: wymagany');
  if (!isValidResourceUrl(r.url)) errors.push('url: nieprawidłowy (dozwolone wyłącznie http/https)');
  if (!RESOURCE_SOURCE_TYPES.includes(r.sourceType)) errors.push('sourceType: nieprawidłowa wartość');
  if (!RESOURCE_LANGUAGES.includes(r.language)) errors.push('language: nieprawidłowa wartość');
  if (!isValidCalendarDateString(r.checkedDate)) errors.push('checkedDate: nieprawidłowa data');
  return { valid: errors.length === 0, errors };
}

function validateGuideStep(s) {
  const errors = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return { valid: false, errors: ['nie jest obiektem'] };
  if (typeof s.id !== 'string' || !s.id) errors.push('id: wymagany');
  if (!Number.isInteger(s.order) || s.order < 0) errors.push('order: liczba całkowita ≥ 0');
  if (typeof s.title !== 'string' || !s.title.trim()) errors.push('title: wymagany');
  if (typeof s.description !== 'string') errors.push('description: wymagany string');
  return { valid: errors.length === 0, errors };
}

function validateGuideExercise(e) {
  const errors = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { valid: false, errors: ['nie jest obiektem'] };
  if (typeof e.id !== 'string' || !e.id) errors.push('id: wymagany');
  if (typeof e.title !== 'string' || !e.title.trim()) errors.push('title: wymagany');
  if (typeof e.description !== 'string') errors.push('description: wymagany string');
  if (e.difficulty !== undefined && (!Number.isInteger(e.difficulty) || e.difficulty < 1 || e.difficulty > 5)) errors.push('difficulty: 1-5');
  return { valid: errors.length === 0, errors };
}

function validateQuestion(q) {
  const errors = [];
  if (!q || typeof q !== 'object' || Array.isArray(q)) return { valid: false, errors: ['nie jest obiektem'] };
  if (typeof q.id !== 'string' || !q.id) errors.push('id: wymagany');
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) errors.push('prompt: wymagany');
  if (q.answer !== undefined && typeof q.answer !== 'string') errors.push('answer: musi być stringiem, jeśli podane');
  return { valid: errors.length === 0, errors };
}

// Surowy, zero-tolerancyjny walidator całego przewodnika. Używany
// WYŁĄCZNIE w migracji (5) — tam żaden człowiek nie potwierdza
// wyniku na żywo, więc wpis albo w całości pasuje do modelu, albo
// cały ląduje w legacyContent. NIGDY nie naprawia częściowo.
function isValidLessonGuide(entry, criterionId) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, errors: ['wpis nie jest obiektem'] };
  }
  if (entry.criterionId !== criterionId) errors.push('criterionId niezgodne z kluczem wpisu');
  if (typeof entry.why !== 'string') errors.push('why: wymagany string');
  if (!isStringArray(entry.skills)) errors.push('skills: wymagana tablica stringów');
  if (!isStringArray(entry.prerequisites)) errors.push('prerequisites: wymagana tablica stringów');

  if (!entry.resources || typeof entry.resources !== 'object' || Array.isArray(entry.resources)) {
    errors.push('resources: wymagany obiekt');
  } else {
    ['documentation', 'articles', 'videos', 'additional'].forEach(key => {
      if (!Array.isArray(entry.resources[key])) {
        errors.push(`resources.${key}: wymagana tablica`);
      } else {
        entry.resources[key].forEach((r, i) => {
          const rv = validateResource(r);
          if (!rv.valid) errors.push(`resources.${key}[${i}]: ${rv.errors.join('; ')}`);
        });
      }
    });
  }

  if (!Array.isArray(entry.workOrder)) errors.push('workOrder: wymagana tablica');
  else entry.workOrder.forEach((s, i) => {
    const sv = validateGuideStep(s);
    if (!sv.valid) errors.push(`workOrder[${i}]: ${sv.errors.join('; ')}`);
  });

  if (!Array.isArray(entry.exercises)) errors.push('exercises: wymagana tablica');
  else entry.exercises.forEach((e, i) => {
    const ev = validateGuideExercise(e);
    if (!ev.valid) errors.push(`exercises[${i}]: ${ev.errors.join('; ')}`);
  });

  if (entry.miniProject !== undefined) {
    const mp = entry.miniProject;
    const mpOk = mp && typeof mp === 'object' && !Array.isArray(mp)
      && typeof mp.title === 'string' && mp.title.trim()
      && typeof mp.description === 'string'
      && isStringArray(mp.acceptanceCriteria);
    if (!mpOk) errors.push('miniProject: nieprawidłowy kształt');
  }

  if (!Array.isArray(entry.selfTest)) errors.push('selfTest: wymagana tablica');
  else entry.selfTest.forEach((q, i) => {
    const qv = validateQuestion(q);
    if (!qv.valid) errors.push(`selfTest[${i}]: ${qv.errors.join('; ')}`);
  });

  if (!isStringArray(entry.commonMistakes)) errors.push('commonMistakes: wymagana tablica stringów');

  if (!(entry.createdAt === null || typeof entry.createdAt === 'string')) errors.push('createdAt: string albo null');
  if (typeof entry.createdAt === 'string' && !isValidIsoTimestamp(entry.createdAt)) errors.push('createdAt: nieprawidłowy ISO');
  if (!(entry.updatedAt === null || typeof entry.updatedAt === 'string')) errors.push('updatedAt: string albo null');
  if (typeof entry.updatedAt === 'string' && !isValidIsoTimestamp(entry.updatedAt)) errors.push('updatedAt: nieprawidłowy ISO');

  if ('sourcesCheckedAt' in entry && !isValidIsoTimestamp(entry.sourcesCheckedAt)) errors.push('sourcesCheckedAt: nieprawidłowy ISO');
  if ('migratedAt' in entry && !isValidIsoTimestamp(entry.migratedAt)) errors.push('migratedAt: nieprawidłowy ISO');

  if (entry.status !== 'draft' && entry.status !== 'reviewed') errors.push('status: musi być draft albo reviewed');

  return { valid: errors.length === 0, errors };
}

// Bezpieczna normalizacja — WYŁĄCZNIE do świadomego zapisu/importu
// przez użytkownika (nigdy do migracji). Brakujące pola treściowe
// dostają bezpieczne puste wartości strukturalne — to NIE jest
// zgadywanie treści, tylko wypełnienie kształtu. Świadomie NIGDY nie
// zwraca żadnego pola systemowego (status/createdAt/updatedAt/
// sourcesCheckedAt/migratedAt/legacyContent) — te są zarządzane
// wyłącznie przez saveLessonGuide/importLessonGuideFromJson, co jest
// bezpośrednim zabezpieczeniem przed przemyceniem tych pól przez
// wklejony JSON.
function normalizeLessonGuide(partial, criterionId) {
  const base = (partial && typeof partial === 'object' && !Array.isArray(partial)) ? partial : {};
  return {
    criterionId,
    why: typeof base.why === 'string' ? base.why : '',
    skills: isStringArray(base.skills) ? base.skills : [],
    prerequisites: isStringArray(base.prerequisites) ? base.prerequisites : [],
    resources: {
      documentation: Array.isArray(base.resources && base.resources.documentation) ? base.resources.documentation : [],
      articles: Array.isArray(base.resources && base.resources.articles) ? base.resources.articles : [],
      videos: Array.isArray(base.resources && base.resources.videos) ? base.resources.videos : [],
      additional: Array.isArray(base.resources && base.resources.additional) ? base.resources.additional : []
    },
    workOrder: Array.isArray(base.workOrder) ? base.workOrder : [],
    exercises: Array.isArray(base.exercises) ? base.exercises : [],
    miniProject: base.miniProject,
    selfTest: Array.isArray(base.selfTest) ? base.selfTest : [],
    commonMistakes: isStringArray(base.commonMistakes) ? base.commonMistakes : []
  };
}

function getLessonGuide(criterionId) {
  const guides = Store.get('it:lessonGuides', {});
  return guides[criterionId] || null;
}

// Sprawdza, czy nowa wersja resources różni się od starej — decyduje
// o czyszczeniu sourcesCheckedAt (ustalenie z Kroku 7: potwierdzenie
// sprawdzenia źródeł przestaje być aktualne, gdy lista się zmienia).
function resourcesChanged(oldResources, newResources) {
  return JSON.stringify(oldResources) !== JSON.stringify(newResources);
}

// Zapis edycji treści (formularz ręczny). content = dowolny obiekt
// z polami treściowymi (przechodzi przez normalizeLessonGuide, więc
// brakujące pola dostają bezpieczne puste wartości — WYŁĄCZNIE
// kształt, nigdy zgadywanie treści).
function saveLessonGuide(criterionId, content) {
  const normalized = normalizeLessonGuide(content, criterionId);
  const guides = Store.get('it:lessonGuides', {});
  const existing = guides[criterionId] || null;
  const ts = nowIso();

  const changedResources = existing ? resourcesChanged(existing.resources, normalized.resources) : true;
  const wasReviewed = existing && existing.status === 'reviewed';

  const result = {
    ...normalized,
    createdAt: existing ? existing.createdAt : ts,
    updatedAt: ts,
    status: wasReviewed ? 'draft' : (existing ? existing.status : 'draft'),
    legacyContent: existing ? existing.legacyContent : undefined
  };
  if (existing && existing.migratedAt !== undefined) result.migratedAt = existing.migratedAt;
  if (existing && existing.sourcesCheckedAt !== undefined && !changedResources) {
    result.sourcesCheckedAt = existing.sourcesCheckedAt;
  }
  // brak else: jeśli changedResources===true, po prostu nie kopiujemy
  // sourcesCheckedAt — pole zostaje nieobecne (wyczyszczone).

  const check = isValidLessonGuide(result, criterionId);
  if (!check.valid) return { ok: false, errors: check.errors };

  guides[criterionId] = result;
  Store.set('it:lessonGuides', guides);
  EventBus.emit('it:lessonGuideSaved', { criterionId, reviewedReset: !!(wasReviewed) });
  return { ok: true, guide: result };
}

// Import z wklejonego JSON-a (przygotowanego np. w rozmowie z Claude
// poza aplikacją). WYŁĄCZNIE pola treściowe są brane z wklejonego
// tekstu — żadne pole systemowe (status/createdAt/updatedAt/
// sourcesCheckedAt/migratedAt/legacyContent) nigdy nie pochodzi z
// importu, nawet jeśli wklejony JSON je zawiera.
function importLessonGuideFromJson(criterionId, rawJsonText) {
  let parsed;
  try { parsed = JSON.parse(rawJsonText); }
  catch (e) { return { ok: false, errors: ['Nieprawidłowy JSON: ' + e.message] }; }

  const normalized = normalizeLessonGuide(parsed, criterionId);
  const guides = Store.get('it:lessonGuides', {});
  const existing = guides[criterionId] || null;
  const ts = nowIso();

  const result = {
    criterionId,
    why: normalized.why,
    skills: normalized.skills,
    prerequisites: normalized.prerequisites,
    resources: normalized.resources,
    workOrder: normalized.workOrder,
    exercises: normalized.exercises,
    miniProject: normalized.miniProject,
    selfTest: normalized.selfTest,
    commonMistakes: normalized.commonMistakes,
    createdAt: existing ? existing.createdAt : ts,
    updatedAt: ts,
    status: 'draft', // WYMUSZONE, niezależnie od statusu w JSON-ie
    legacyContent: existing ? existing.legacyContent : undefined // WYŁĄCZNIE z istniejącego wpisu, nigdy z importu
  };
  if (existing && existing.migratedAt !== undefined) result.migratedAt = existing.migratedAt;
  // Import zawsze traktowany jak zmiana resources (nowa treść w całości) → sourcesCheckedAt zawsze czyszczone.

  const check = isValidLessonGuide(result, criterionId);
  if (!check.valid) return { ok: false, errors: check.errors };

  guides[criterionId] = result;
  Store.set('it:lessonGuides', guides);
  EventBus.emit('it:lessonGuideSaved', { criterionId, imported: true });
  return { ok: true, guide: result };
}

// Ręczne potwierdzenie: "sprawdziłem dzisiaj listę źródeł". Osobna,
// jawna czynność — nigdy ustawiana automatycznie przy zwykłym zapisie.
function confirmSourcesChecked(criterionId) {
  const guides = Store.get('it:lessonGuides', {});
  const existing = guides[criterionId];
  if (!existing) return { ok: false, reason: 'Brak przewodnika dla tego kryterium.' };
  guides[criterionId] = { ...existing, sourcesCheckedAt: nowIso() };
  Store.set('it:lessonGuides', guides);
  EventBus.emit('it:lessonGuideSaved', { criterionId });
  return { ok: true };
}

// Ręczne oznaczenie jako sprawdzone (status: reviewed). Wyłącznie
// ręczne, nigdy automatyczne. Oznacza WYŁĄCZNIE "przeczytałem i
// zaakceptowałem tę treść" — nie mówi nic o żywotności linków
// (to osobno sourcesCheckedAt).
function markLessonGuideReviewed(criterionId) {
  const guides = Store.get('it:lessonGuides', {});
  const existing = guides[criterionId];
  if (!existing) return { ok: false, reason: 'Brak przewodnika dla tego kryterium.' };
  guides[criterionId] = { ...existing, status: 'reviewed' };
  Store.set('it:lessonGuides', guides);
  EventBus.emit('it:lessonGuideSaved', { criterionId });
  return { ok: true };
}

// Usunięcie WYŁĄCZNIE starej treści (legacyContent) — nigdy całego
// przewodnika. Osobna funkcja, wywoływana z UI dopiero po
// dwustopniowym potwierdzeniu. Nie liczy się jako zmiana treści
// edukacyjnej — nie cofa statusu reviewed na draft.
function deleteLegacyContent(criterionId) {
  const guides = Store.get('it:lessonGuides', {});
  const existing = guides[criterionId];
  if (!existing || !('legacyContent' in existing)) return { ok: false, reason: 'Brak starej treści do usunięcia.' };
  const { legacyContent, ...rest } = existing;
  guides[criterionId] = { ...rest, updatedAt: nowIso() };
  Store.set('it:lessonGuides', guides);
  EventBus.emit('it:lessonGuideSaved', { criterionId, legacyDeleted: true });
  return { ok: true };
}

// Centralne, jedyne bezpieczne renderowanie danych LessonGuide do
// innerHTML — przewodniki pochodzą z zewnętrznego, importowanego
// JSON-a, więc KAŻDA wartość treściowa musi przejść przez to przed
// wstawieniem do szablonu. Brak wyjątków, brak osobnych "punktowych"
// zabezpieczeń dla pojedynczych pól.
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// Osobna nazwa dla czytelności miejsc wywołania (atrybut vs. treść
// tekstowa) — ta sama pełna funkcja ucieczki pokrywa oba konteksty
// (w tym cudzysłów delimitujący atrybut), więc nie ma ryzyka, że
// jedna z dwóch "wersji" zostanie przypadkiem niedopracowana.
function escapeAttr(str) {
  return escapeHtml(str);
}

function genGuideId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

/* ------------------------------------------------------------
   Render UI dla LessonGuide — czysto widokowe. Nigdy nie wywołuje
   getTasks/setTaskStatus/RoadmapEngine, nigdy nie wpływa na status
   kryterium ani na ekran "Dziś". Panel jest doczepiany pod wierszem
   kryterium w renderCriteria() wewnątrz LearningModule.render().
   ------------------------------------------------------------ */
function renderGuidePanel(criterionId, panelEl) {
  const guide = getLessonGuide(criterionId);
  if (!guide) {
    renderGuideEmptyState(criterionId, panelEl);
  } else {
    renderGuideView(criterionId, guide, panelEl);
  }
}

function renderGuideEmptyState(criterionId, panelEl) {
  panelEl.innerHTML = `
    <div class="ex-detail" style="margin-top:8px;">
      <b>Brak przewodnika dla tego kryterium.</b>
      <p style="font-size:12px;color:var(--text3);margin:6px 0;">Poproś Claude o przygotowanie przewodnika w osobnej rozmowie (aplikacja nie ma dostępu do internetu ani AI), w formacie JSON zgodnym z modelem LessonGuide, a następnie wklej go poniżej. Alternatywnie utwórz przewodnik ręcznie.</p>
      <textarea id="guide-import-${criterionId}" rows="4" style="width:100%;font-family:monospace;font-size:11px;" placeholder='{"why": "...", "skills": [...], "resources": {...}, ...}'></textarea>
      <div class="field-row" style="margin-top:6px;">
        <button class="ghost" id="guide-import-btn-${criterionId}">Importuj z JSON</button>
        <button class="ghost" id="guide-manual-btn-${criterionId}">Utwórz ręcznie</button>
      </div>
      <div class="log-errors" id="guide-import-errors-${criterionId}" style="display:none;color:#f87171;font-size:11px;margin-top:6px;"></div>
    </div>
  `;
  panelEl.querySelector(`#guide-import-btn-${criterionId}`).addEventListener('click', () => {
    const text = panelEl.querySelector(`#guide-import-${criterionId}`).value;
    const result = importLessonGuideFromJson(criterionId, text);
    const errEl = panelEl.querySelector(`#guide-import-errors-${criterionId}`);
    if (!result.ok) {
      errEl.style.display = 'block';
      errEl.textContent = (result.errors || []).join(' | ');
      return;
    }
    renderGuidePanel(criterionId, panelEl);
  });
  panelEl.querySelector(`#guide-manual-btn-${criterionId}`).addEventListener('click', () => {
    renderGuideEditForm(criterionId, null, panelEl);
  });
}

function renderGuideView(criterionId, guide, panelEl) {
  const statusLabel = guide.status === 'reviewed' ? '✅ sprawdzone' : '📝 szkic';
  const updatedLabel = guide.updatedAt ? new Date(guide.updatedAt).toLocaleString('pl-PL') : '—';
  const sourcesLabel = guide.sourcesCheckedAt ? new Date(guide.sourcesCheckedAt).toLocaleString('pl-PL') : 'źródła nigdy nie sprawdzone';
  const migratedNote = guide.migratedAt ? `<div class="pillar-tag">Zmigrowano ze starego formatu: ${escapeHtml(new Date(guide.migratedAt).toLocaleString('pl-PL'))} (data utworzenia oryginału nieznana)</div>` : '';
  const critIdAttr = escapeAttr(criterionId);

  // Resource.url przechodzi walidację również NA RENDERZE (obrona
  // w głębi — nie tylko przy zapisie): jeśli z jakiegoś powodu
  // niepoprawny/niebezpieczny URL trafił do danych (np. stary import
  // sprzed tej poprawki, ręczna ingerencja w Store), link nie jest
  // w ogóle renderowany jako klikalny link, tylko jako sam,
  // zawsze bezpiecznie zescape'owany tekst.
  const resGroup = (label, list) => list.length ? `
    <div class="ex-detail"><b>${escapeHtml(label)}</b>
      ${list.map(r => {
        const titleSafe = escapeHtml(r.title);
        const metaSafe = `(${escapeHtml(r.sourceType)}, ${escapeHtml(r.language)}, sprawdzono: ${escapeHtml(r.checkedDate)})`;
        const linkOrText = isValidResourceUrl(r.url)
          ? `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener">${titleSafe}</a>`
          : `${titleSafe} <span style="color:#f87171;">(nieprawidłowy URL)</span>`;
        return `<div style="font-size:12px;margin:2px 0;">• ${linkOrText} ${metaSafe}</div>`;
      }).join('')}
    </div>` : '';

  panelEl.innerHTML = `
    <div class="ex-detail" style="margin-top:8px;">
      <div class="field-row">
        <span class="badge ${guide.status === 'reviewed' ? 'ok' : 'warn'}">${statusLabel}</span>
        <span class="pillar-tag">Aktualizacja: ${escapeHtml(updatedLabel)}</span>
        <span class="pillar-tag">Źródła: ${escapeHtml(sourcesLabel)}</span>
      </div>
      ${migratedNote}
      ${guide.why ? `<div class="ex-detail"><b>Dlaczego</b>${escapeHtml(guide.why)}</div>` : ''}
      ${guide.skills.length ? `<div class="ex-detail"><b>Umiejętności</b>${guide.skills.map(escapeHtml).join(' · ')}</div>` : ''}
      ${guide.prerequisites.length ? `<div class="ex-detail"><b>Wymagania wstępne</b>${guide.prerequisites.map(escapeHtml).join(' · ')}</div>` : ''}
      ${resGroup('Dokumentacja', guide.resources.documentation)}
      ${resGroup('Artykuły', guide.resources.articles)}
      ${resGroup('Wideo', guide.resources.videos)}
      ${resGroup('Dodatkowe', guide.resources.additional)}
      ${guide.workOrder.length ? `<div class="ex-detail"><b>Kolejność pracy</b>${guide.workOrder.slice().sort((a,b) => a.order - b.order).map(s => `<div style="font-size:12px;">${s.order + 1}. <b>${escapeHtml(s.title)}</b> — ${escapeHtml(s.description)}</div>`).join('')}</div>` : ''}
      ${guide.exercises.length ? `<div class="ex-detail"><b>Ćwiczenia</b>${guide.exercises.map(e => `<div style="font-size:12px;">• ${escapeHtml(e.title)}${e.difficulty ? ' (trudność ' + escapeHtml(String(e.difficulty)) + ')' : ''} — ${escapeHtml(e.description)}</div>`).join('')}</div>` : ''}
      ${guide.miniProject ? `<div class="ex-detail"><b>Mini-projekt</b><div style="font-size:12px;"><b>${escapeHtml(guide.miniProject.title)}</b> — ${escapeHtml(guide.miniProject.description)}${guide.miniProject.acceptanceCriteria.length ? '<br>Kryteria akceptacji: ' + guide.miniProject.acceptanceCriteria.map(escapeHtml).join(' · ') : ''}</div></div>` : ''}
      ${guide.selfTest.length ? `<div class="ex-detail"><b>Self-test</b>${guide.selfTest.map(q => `<div style="font-size:12px;">• ${escapeHtml(q.prompt)}${q.answer ? ' <span style="color:var(--text3);">(odp: ' + escapeHtml(q.answer) + ')</span>' : ''}</div>`).join('')}</div>` : ''}
      ${guide.commonMistakes.length ? `<div class="ex-detail"><b>Typowe błędy</b>${guide.commonMistakes.map(m => `<div style="font-size:12px;">• ${escapeHtml(m)}</div>`).join('')}</div>` : ''}
      ${guide.legacyContent !== undefined ? `
        <div class="ex-detail" style="border-top:1px dashed var(--border);padding-top:8px;margin-top:8px;">
          <b>Stara treść (sprzed formalizacji modelu)</b>
          <pre style="font-size:10px;white-space:pre-wrap;background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;">${escapeHtml(JSON.stringify(guide.legacyContent, null, 2))}</pre>
          <button class="ghost" id="guide-legacy-del-btn-${critIdAttr}" style="margin-top:6px;">Usuń starą treść</button>
          <div id="guide-legacy-confirm-${critIdAttr}" style="display:none;margin-top:6px;">
            <span style="color:#f87171;font-size:12px;">Na pewno? Tej operacji nie można cofnąć.</span>
            <button class="ghost" id="guide-legacy-confirm-btn-${critIdAttr}">Potwierdź usunięcie</button>
          </div>
        </div>` : ''}
      <div class="field-row" style="margin-top:10px;">
        <button class="ghost" id="guide-edit-btn-${critIdAttr}">Edytuj</button>
        ${guide.status === 'draft' ? `<button class="ghost" id="guide-review-btn-${critIdAttr}">Oznacz jako sprawdzone</button>` : ''}
        <button class="ghost" id="guide-sources-btn-${critIdAttr}">Potwierdź sprawdzenie źródeł dzisiaj</button>
      </div>
    </div>
  `;

  panelEl.querySelector(`#guide-edit-btn-${criterionId}`).addEventListener('click', () => {
    renderGuideEditForm(criterionId, guide, panelEl);
  });
  const reviewBtn = panelEl.querySelector(`#guide-review-btn-${criterionId}`);
  if (reviewBtn) reviewBtn.addEventListener('click', () => {
    markLessonGuideReviewed(criterionId);
    renderGuidePanel(criterionId, panelEl);
  });
  panelEl.querySelector(`#guide-sources-btn-${criterionId}`).addEventListener('click', () => {
    confirmSourcesChecked(criterionId);
    renderGuidePanel(criterionId, panelEl);
  });
  const legacyDelBtn = panelEl.querySelector(`#guide-legacy-del-btn-${criterionId}`);
  if (legacyDelBtn) legacyDelBtn.addEventListener('click', () => {
    panelEl.querySelector(`#guide-legacy-confirm-${criterionId}`).style.display = 'block';
  });
  const legacyConfirmBtn = panelEl.querySelector(`#guide-legacy-confirm-btn-${criterionId}`);
  if (legacyConfirmBtn) legacyConfirmBtn.addEventListener('click', () => {
    deleteLegacyContent(criterionId);
    renderGuidePanel(criterionId, panelEl);
  });
}

function renderGuideEditForm(criterionId, existingGuide, panelEl) {
  // Stan roboczy WYŁĄCZNIE w pamięci, niezapisany do Store aż do
  // kliknięcia "Zapisz" — Anuluj po prostu wraca do renderGuidePanel
  // bez żadnego zapisu.
  const state = existingGuide ? {
    why: existingGuide.why,
    skills: existingGuide.skills.slice(),
    prerequisites: existingGuide.prerequisites.slice(),
    resources: {
      documentation: existingGuide.resources.documentation.slice(),
      articles: existingGuide.resources.articles.slice(),
      videos: existingGuide.resources.videos.slice(),
      additional: existingGuide.resources.additional.slice()
    },
    workOrder: existingGuide.workOrder.slice(),
    exercises: existingGuide.exercises.slice(),
    miniProject: existingGuide.miniProject ? { ...existingGuide.miniProject, acceptanceCriteria: existingGuide.miniProject.acceptanceCriteria.slice() } : null,
    selfTest: existingGuide.selfTest.slice(),
    commonMistakes: existingGuide.commonMistakes.slice()
  } : {
    why: '', skills: [], prerequisites: [],
    resources: { documentation: [], articles: [], videos: [], additional: [] },
    workOrder: [], exercises: [], miniProject: null, selfTest: [], commonMistakes: []
  };

  const RESOURCE_GROUPS = [['documentation', 'Dokumentacja'], ['articles', 'Artykuły'], ['videos', 'Wideo'], ['additional', 'Dodatkowe']];

  function renderForm() {
    panelEl.innerHTML = `
      <div class="ex-detail" style="margin-top:8px;">
        <label style="font-size:11px;color:var(--text3);">Dlaczego</label>
        <textarea id="f-why" rows="2" style="width:100%;">${escapeHtml(state.why)}</textarea>

        <label style="font-size:11px;color:var(--text3);">Umiejętności (oddziel przecinkami)</label>
        <input type="text" id="f-skills" style="width:100%;" value="${escapeAttr(state.skills.join(', '))}">

        <label style="font-size:11px;color:var(--text3);">Wymagania wstępne (oddziel przecinkami)</label>
        <input type="text" id="f-prereq" style="width:100%;" value="${escapeAttr(state.prerequisites.join(', '))}">

        ${RESOURCE_GROUPS.map(([key, label]) => `
          <div style="margin-top:8px;">
            <label style="font-size:11px;color:var(--text3);">${label}</label>
            ${state.resources[key].map((r, i) => `
              <div class="field-row" style="font-size:11px;">
                <span>${escapeHtml(r.title)} — ${escapeHtml(r.url)} (${escapeHtml(r.sourceType)}, ${escapeHtml(r.language)}, ${escapeHtml(r.checkedDate)})</span>
                <button class="mini-btn" data-remove-res="${key}:${i}">usuń</button>
              </div>
            `).join('')}
            <div class="field-row">
              <input type="text" placeholder="tytuł" id="f-res-title-${key}" style="width:120px;">
              <input type="text" placeholder="https://..." id="f-res-url-${key}" style="width:160px;">
              <select id="f-res-type-${key}">${RESOURCE_SOURCE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
              <select id="f-res-lang-${key}">${RESOURCE_LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}</select>
              <input type="date" id="f-res-date-${key}" value="${localDateKey()}">
              <button class="ghost" data-add-res="${key}">+ dodaj</button>
            </div>
          </div>
        `).join('')}

        <div style="margin-top:8px;">
          <label style="font-size:11px;color:var(--text3);">Kolejność pracy</label>
          ${state.workOrder.map((s, i) => `
            <div class="field-row" style="font-size:11px;">
              <span>${i + 1}. ${escapeHtml(s.title)} — ${escapeHtml(s.description)}</span>
              <button class="mini-btn" data-remove-step="${i}">usuń</button>
            </div>
          `).join('')}
          <div class="field-row">
            <input type="text" placeholder="tytuł kroku" id="f-step-title" style="width:140px;">
            <input type="text" placeholder="opis" id="f-step-desc" style="width:200px;">
            <button class="ghost" id="f-step-add">+ dodaj krok</button>
          </div>
        </div>

        <div style="margin-top:8px;">
          <label style="font-size:11px;color:var(--text3);">Ćwiczenia</label>
          ${state.exercises.map((e, i) => `
            <div class="field-row" style="font-size:11px;">
              <span>${escapeHtml(e.title)}${e.difficulty ? ' (trudność ' + escapeHtml(String(e.difficulty)) + ')' : ''} — ${escapeHtml(e.description)}</span>
              <button class="mini-btn" data-remove-ex="${i}">usuń</button>
            </div>
          `).join('')}
          <div class="field-row">
            <input type="text" placeholder="tytuł" id="f-ex-title" style="width:120px;">
            <input type="text" placeholder="opis" id="f-ex-desc" style="width:160px;">
            <select id="f-ex-diff"><option value="">bez trudności</option>${[1,2,3,4,5].map(n => `<option value="${n}">${n}</option>`).join('')}</select>
            <button class="ghost" id="f-ex-add">+ dodaj ćwiczenie</button>
          </div>
        </div>

        <div style="margin-top:8px;">
          <label style="font-size:11px;color:var(--text3);">Mini-projekt (opcjonalny)</label>
          <input type="text" placeholder="tytuł" id="f-mp-title" style="width:100%;" value="${state.miniProject ? escapeAttr(state.miniProject.title) : ''}">
          <input type="text" placeholder="opis" id="f-mp-desc" style="width:100%;" value="${state.miniProject ? escapeAttr(state.miniProject.description) : ''}">
          <input type="text" placeholder="kryteria akceptacji (oddziel przecinkami)" id="f-mp-ac" style="width:100%;" value="${state.miniProject ? escapeAttr(state.miniProject.acceptanceCriteria.join(', ')) : ''}">
        </div>

        <div style="margin-top:8px;">
          <label style="font-size:11px;color:var(--text3);">Self-test</label>
          ${state.selfTest.map((q, i) => `
            <div class="field-row" style="font-size:11px;">
              <span>${escapeHtml(q.prompt)}${q.answer ? ' (odp: ' + escapeHtml(q.answer) + ')' : ''}</span>
              <button class="mini-btn" data-remove-q="${i}">usuń</button>
            </div>
          `).join('')}
          <div class="field-row">
            <input type="text" placeholder="pytanie" id="f-q-prompt" style="width:160px;">
            <input type="text" placeholder="odpowiedź (opcjonalnie)" id="f-q-answer" style="width:160px;">
            <button class="ghost" id="f-q-add">+ dodaj pytanie</button>
          </div>
        </div>

        <label style="font-size:11px;color:var(--text3);margin-top:8px;display:block;">Typowe błędy (jeden na linię)</label>
        <textarea id="f-mistakes" rows="2" style="width:100%;">${escapeHtml(state.commonMistakes.join('\n'))}</textarea>

        <div class="field-row" style="margin-top:10px;">
          <button class="ghost" id="f-save">Zapisz</button>
          <button class="ghost" id="f-cancel">Anuluj</button>
        </div>
        <div class="log-errors" id="f-errors" style="display:none;color:#f87171;font-size:11px;margin-top:6px;"></div>
      </div>
    `;

    panelEl.querySelector('#f-why').addEventListener('input', e => { state.why = e.target.value; });
    panelEl.querySelector('#f-skills').addEventListener('input', e => { state.skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean); });
    panelEl.querySelector('#f-prereq').addEventListener('input', e => { state.prerequisites = e.target.value.split(',').map(s => s.trim()).filter(Boolean); });
    panelEl.querySelector('#f-mistakes').addEventListener('input', e => { state.commonMistakes = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); });

    panelEl.querySelectorAll('[data-remove-res]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [key, idx] = btn.dataset.removeRes.split(':');
        state.resources[key].splice(Number(idx), 1);
        renderForm();
      });
    });
    RESOURCE_GROUPS.forEach(([key]) => {
      const addBtn = panelEl.querySelector(`[data-add-res="${key}"]`);
      addBtn.addEventListener('click', () => {
        const title = panelEl.querySelector(`#f-res-title-${key}`).value.trim();
        const url = panelEl.querySelector(`#f-res-url-${key}`).value.trim();
        const sourceType = panelEl.querySelector(`#f-res-type-${key}`).value;
        const language = panelEl.querySelector(`#f-res-lang-${key}`).value;
        const checkedDate = panelEl.querySelector(`#f-res-date-${key}`).value;
        const candidate = { id: genGuideId('res'), title, url, sourceType, language, checkedDate };
        const v = validateResource(candidate);
        const errEl = panelEl.querySelector('#f-errors');
        if (!v.valid) { errEl.style.display = 'block'; errEl.textContent = v.errors.join(' | '); return; }
        errEl.style.display = 'none';
        state.resources[key].push(candidate);
        renderForm();
      });
    });

    panelEl.querySelectorAll('[data-remove-step]').forEach(btn => {
      btn.addEventListener('click', () => { state.workOrder.splice(Number(btn.dataset.removeStep), 1); renderForm(); });
    });
    panelEl.querySelector('#f-step-add').addEventListener('click', () => {
      const title = panelEl.querySelector('#f-step-title').value.trim();
      const description = panelEl.querySelector('#f-step-desc').value.trim();
      if (!title) return;
      state.workOrder.push({ id: genGuideId('step'), order: state.workOrder.length, title, description });
      renderForm();
    });

    panelEl.querySelectorAll('[data-remove-ex]').forEach(btn => {
      btn.addEventListener('click', () => { state.exercises.splice(Number(btn.dataset.removeEx), 1); renderForm(); });
    });
    panelEl.querySelector('#f-ex-add').addEventListener('click', () => {
      const title = panelEl.querySelector('#f-ex-title').value.trim();
      const description = panelEl.querySelector('#f-ex-desc').value.trim();
      const diffVal = panelEl.querySelector('#f-ex-diff').value;
      if (!title) return;
      const ex = { id: genGuideId('ex'), title, description };
      if (diffVal) ex.difficulty = Number(diffVal);
      state.exercises.push(ex);
      renderForm();
    });

    panelEl.querySelectorAll('[data-remove-q]').forEach(btn => {
      btn.addEventListener('click', () => { state.selfTest.splice(Number(btn.dataset.removeQ), 1); renderForm(); });
    });
    panelEl.querySelector('#f-q-add').addEventListener('click', () => {
      const prompt = panelEl.querySelector('#f-q-prompt').value.trim();
      const answer = panelEl.querySelector('#f-q-answer').value.trim();
      if (!prompt) return;
      const q = { id: genGuideId('q'), prompt };
      if (answer) q.answer = answer;
      state.selfTest.push(q);
      renderForm();
    });

    panelEl.querySelector('#f-mp-title').addEventListener('input', e => {
      if (!state.miniProject) state.miniProject = { title: '', description: '', acceptanceCriteria: [] };
      state.miniProject.title = e.target.value;
    });
    panelEl.querySelector('#f-mp-desc').addEventListener('input', e => {
      if (!state.miniProject) state.miniProject = { title: '', description: '', acceptanceCriteria: [] };
      state.miniProject.description = e.target.value;
    });
    panelEl.querySelector('#f-mp-ac').addEventListener('input', e => {
      if (!state.miniProject) state.miniProject = { title: '', description: '', acceptanceCriteria: [] };
      state.miniProject.acceptanceCriteria = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    });

    panelEl.querySelector('#f-cancel').addEventListener('click', () => {
      renderGuidePanel(criterionId, panelEl);
    });
    panelEl.querySelector('#f-save').addEventListener('click', () => {
      // Mini-projekt zapisujemy tylko, jeśli ma choć tytuł — pusty
      // formularz mini-projektu nie tworzy pustego obiektu w danych.
      const content = { ...state };
      if (state.miniProject && !state.miniProject.title.trim()) content.miniProject = undefined;
      const result = saveLessonGuide(criterionId, content);
      const errEl = panelEl.querySelector('#f-errors');
      if (!result.ok) { errEl.style.display = 'block'; errEl.textContent = result.errors.join(' | '); return; }
      renderGuidePanel(criterionId, panelEl);
    });
  }

  renderForm();
}

/* ============================================================
   MODUŁ / LearningModule (IT)
   ============================================================
   Zgodność z kontraktem Module: id, name, getTasks, getStats,
   render — wymagane; setTaskStatus — opcjonalne, obecne.
   Każde zadanie zwrócone przez getTasks() ma WSZYSTKIE pola
   wymagane w tym kroku: moduleId, goalId, stageId, title, why,
   estimatedMinutes, difficulty, xp, priority, status.

   NIEZALEŻNOŚĆ OD TRENINGU: ten moduł nigdy nie odwołuje się do
   TrainingModule, TRAINING_DAYS ani żadnej nazwy z tamtego pliku.
   Jedyna wspólna warstwa to Core (Store, EventBus, ModuleRegistry).
   ============================================================ */
const LearningModule = {
  id: 'it',
  name: 'Nauka IT',

  getTasks() {
    const activeStage = RoadmapEngine.getActiveStage();
    if (!activeStage) return []; // cała roadmapa ukończona — brak aktywnego etapu
    const state = RoadmapEngine.getCriteriaState();

    return activeStage.criteria.map(c => {
      const rec = state[c.id];
      return {
        id: c.id,
        moduleId: this.id,
        goalId: 'it-job',
        stageId: activeStage.id,
        title: c.title,
        why: activeStage.why,
        estimatedMinutes: c.estimatedMinutes,
        difficulty: c.difficulty,
        xp: c.xp,
        priority: 4, // pozycja "Nauka IT" w ustalonej hierarchii priorytetów
        status: (rec && rec.status === 'done') ? 'done' : 'todo',
        completedDate: rec ? rec.completedDate : null
      };
    });
  },

  // 'skipped' traktowane jak nieukończone — kryterium ukończenia
  // etapu nie ma sensownego znaczenia "pominięte" (nie da się
  // zaliczyć etapu pomijając jego wymagania). Świadomy kompromis,
  // opisany w podsumowaniu Kroku 5.
  setTaskStatus(taskId, status) {
    RoadmapEngine.setCriterionStatus(taskId, status === 'done' ? 'done' : 'todo');
    EventBus.emit('task:status', { moduleId: this.id, taskId, status });
  },

  getStats() {
    const overall = RoadmapEngine.getOverallProgress();
    return { done: overall.done, total: overall.total, label: this.name };
  },

  getLessonGuide, saveLessonGuide, importLessonGuideFromJson, // re-eksport — patrz sekcja LessonGuide wyżej
  confirmSourcesChecked, markLessonGuideReviewed, deleteLegacyContent,

  render(container) {
    const statuses = RoadmapEngine.getStageStatuses();
    const overall = RoadmapEngine.getOverallProgress();

    container.innerHTML = `
      <div class="card">
        <h3>🗺️ Droga do pierwszej pracy w IT</h3>
        <div class="field-row" style="margin-bottom:14px;">
          <span class="badge ok">${overall.done}/${overall.total} etapów ukończonych</span>
          <span class="badge">${overall.percent}% całej roadmapy</span>
        </div>
        <div id="roadmap-tree"></div>
      </div>
    `;

    const treeEl = container.querySelector('#roadmap-tree');

    const renderTree = () => {
      const statusesNow = RoadmapEngine.getStageStatuses();
      treeEl.innerHTML = ROADMAP_STAGES.map(stage => {
        const status = statusesNow[stage.id];
        const progress = RoadmapEngine.getProgress(stage.id);
        const icon = status === 'done' ? '✓' : status === 'active' ? '●' : '🔒';
        const statusClass = status === 'done' ? 'ok' : status === 'active' ? '' : '';
        return `
          <div class="stage-card ${status}" data-stage="${stage.id}">
            <div class="stage-head">
              <span class="stage-icon">${icon}</span>
              <span class="stage-name">${stage.order}. ${stage.name}</span>
              <span class="badge ${statusClass}">${status === 'locked' ? 'zablokowany' : progress + '%'}</span>
            </div>
            <div class="stage-body" style="display:none;"></div>
          </div>
        `;
      }).join('');

      treeEl.querySelectorAll('.stage-card').forEach(card => {
        const stageId = card.dataset.stage;
        card.querySelector('.stage-head').addEventListener('click', () => {
          const body = card.querySelector('.stage-body');
          const isOpen = body.style.display !== 'none';
          treeEl.querySelectorAll('.stage-body').forEach(b => b.style.display = 'none');
          if (!isOpen) { body.style.display = 'block'; renderStageDetail(stageId, body); }
        });
      });
    };

    const renderStageDetail = (stageId, bodyEl) => {
      const stage = RoadmapEngine.getStage(stageId);
      const status = RoadmapEngine.getStageStatuses()[stageId];
      const progress = RoadmapEngine.getProgress(stageId);

      if (status === 'locked') {
        const prereqNames = stage.prerequisites.map(id => RoadmapEngine.getStage(id)?.name).join(', ') || '—';
        bodyEl.innerHTML = `<p class="ex-detail">🔒 Zablokowane. Wymaga ukończenia: <b>${prereqNames}</b></p>`;
        return;
      }

      bodyEl.innerHTML = `
        <div class="ex-detail"><b>Opis</b>${stage.description}</div>
        <div class="ex-detail"><b>Dlaczego teraz</b>${stage.why}</div>
        <div class="ex-detail"><b>Czego się nauczę</b>${stage.willLearn.join(' · ')}</div>
        <div class="ex-detail"><b>Umiejętności</b>${stage.skillsGained.join(' · ')}</div>
        <div class="ex-detail"><b>Szacowany czas</b>${stage.estimatedHours}h</div>
        ${stage.projects.length ? `<div class="ex-detail"><b>Projekty</b>${stage.projects.join(' · ')}</div>` : ''}
        <div class="ex-detail"><b>Test zaliczeniowy</b>${stage.finalTest}</div>
        <div class="pillar-tag" style="margin:10px 0 4px;">Kryteria ukończenia (${progress}%)</div>
        <div id="criteria-list-${stage.id}"></div>
        ${status === 'active' ? `<button class="ghost" id="complete-stage-${stage.id}" style="margin-top:10px;">Zamknij etap — test zaliczeniowy zdany</button>
          <div class="log-errors" id="complete-errors-${stage.id}" style="display:none;color:#f87171;font-size:11px;margin-top:6px;"></div>` : ''}
      `;

      const critListEl = bodyEl.querySelector(`#criteria-list-${stage.id}`);
      const renderCriteria = () => {
        critListEl.innerHTML = stage.criteria.map(c => {
          const done = RoadmapEngine.isCriterionDone(c.id);
          return `
          <div class="item ${done ? 'done' : ''}">
            <input type="checkbox" class="cb" id="crit-${c.id}" ${done ? 'checked' : ''} ${status !== 'active' ? 'disabled' : ''}>
            <label for="crit-${c.id}">${c.title}</label>
            <span class="xptag">+${c.xp} XP</span>
            <button class="mini-btn guide-toggle-btn" data-crit="${c.id}">📘 Przewodnik</button>
          </div>
          <div class="guide-panel" id="guide-panel-${c.id}" style="display:none;"></div>
        `;
        }).join('');
        critListEl.querySelectorAll('.cb').forEach(cb => {
          cb.addEventListener('change', () => {
            LearningModule.setTaskStatus(cb.id.replace('crit-', ''), cb.checked ? 'done' : 'todo');
            renderCriteria();
            const badge = document.querySelector(`.stage-card[data-stage="${stage.id}"] .stage-head .badge`);
            if (badge) badge.textContent = RoadmapEngine.getProgress(stage.id) + '%';
            if (typeof renderTodayTasks === 'function') renderTodayTasks();
          });
        });
        // Panel przewodnika — czysto UI, nigdy nie dotyka getTasks/setTaskStatus
        // ani statusu kryterium. Toggle otwiera/zamyka panel jednego kryterium
        // na raz (analogicznie do rozwijania etapu w renderTree wyżej).
        critListEl.querySelectorAll('.guide-toggle-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const critId = btn.dataset.crit;
            const panel = critListEl.querySelector(`#guide-panel-${critId}`);
            const isOpen = panel.style.display !== 'none';
            critListEl.querySelectorAll('.guide-panel').forEach(p => p.style.display = 'none');
            if (!isOpen) { panel.style.display = 'block'; renderGuidePanel(critId, panel); }
          });
        });
      };
      renderCriteria();

      const completeBtn = bodyEl.querySelector(`#complete-stage-${stage.id}`);
      if (completeBtn) {
        completeBtn.addEventListener('click', () => {
          const result = RoadmapEngine.completeStage(stage.id);
          const errEl = bodyEl.querySelector(`#complete-errors-${stage.id}`);
          if (!result.ok) {
            errEl.style.display = 'block';
            errEl.textContent = result.reason;
            return;
          }
          renderTree(); // pełne odświeżenie — nowy etap mógł się odblokować
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        });
      }
    };

    renderTree();
  }
};
/* ============================================================
   WALIDACJA I REJESTRACJA LearningModule
   Roadmapa jest walidowana PRZED użyciem — błąd definicji
   zatrzymuje rejestrację modułu, żeby zła struktura (duplikat id,
   cykl, rozgałęzienie w modelu liniowym...) nigdy nie trafiła do UI.
   reconcileRoadmapState() uruchamiana od razu po pozytywnej
   walidacji, przed pierwszym renderem — synchronizuje zapisany
   stan z aktualną definicją ROADMAP_STAGES.
   ============================================================ */
const roadmapValidation = validateRoadmapDefinition(ROADMAP_STAGES);
if (!roadmapValidation.valid) {
  console.error('Roadmapa IT nieprawidłowa — LearningModule NIE zostanie zarejestrowany:');
  roadmapValidation.errors.forEach(e => console.error('  - ' + e));
} else {
  RoadmapEngine.reconcileRoadmapState();
  ModuleRegistry.register(LearningModule);
}


/* ============================================================
   DANE / SCHOOL — typy zadań szkolnych i ich wagi
   ============================================================
   Deterministyczne, jawne reguły (wymóg pkt 14) — zero AI,
   zero heurystyk "domyślanych". Każda liczba niżej ma wyraźne
   uzasadnienie w komentarzu, żeby dało się to zmienić świadomie,
   nie zgadywać dlaczego akurat taka wartość.
   ============================================================ */
const SCHOOL_TYPE_LABELS = {
  homework: 'Zadanie domowe', test: 'Sprawdzian', quiz: 'Kartkówka',
  project: 'Projekt', exam: 'Egzamin', review: 'Powtórka', material: 'Materiał do nauki'
};

// Priorytet BAZOWY typu (przed uwzględnieniem terminu) — mieści się
// świadomie w przedziale 3.2-4.8, czyli MIĘDZY treningiem (3) a
// angielskim (5): szkoła jako całość jest ważniejsza niż projekty
// poboczne, ale bez pilnego terminu nie przebija zdrowia/snu/treningu.
const SCHOOL_TYPE_BASE_PRIORITY = {
  exam: 3.2, test: 3.4, quiz: 3.6, project: 3.8, homework: 4.2, review: 4.4, material: 4.8
};

// XP bazowe per typ — większy ciężar = większa nagroda, spójne
// z resztą aplikacji (nie z pamięci, jawnie ustalone tutaj).
const SCHOOL_TYPE_XP = {
  exam: 100, test: 60, quiz: 30, project: 80, homework: 25, review: 20, material: 15
};

// Nazwane stałe formuły obciążenia dnia (pkt D/15-16). Lekcje same
// w sobie nie powinny móc osiągnąć progu 'high' — stąd niska waga
// lessonMinutes. Zadanie przeterminowane waży WIĘCEJ niż zadanie na
// dziś/jutro, żeby zaległości były wyraźnie widoczne w obciążeniu.
const SCHOOL_LOAD_LESSON_WEIGHT = 0.25;
const SCHOOL_LOAD_URGENT_TASK_WEIGHT = 1;
const SCHOOL_LOAD_OVERDUE_TASK_WEIGHT = 1.5;
const SCHOOL_LOAD_MEDIUM_THRESHOLD = 180;
const SCHOOL_LOAD_HIGH_THRESHOLD = 360;

// Prawdziwa walidacja kalendarzowa — regex sprawdza tylko kształt
// (pkt B/5). new Date() po cichu "przenosi" nieistniejące daty
// (np. 2026-02-31 → 2026-03-03), więc dopiero porównanie odczytanych
// z powrotem rok/miesiąc/dzień z tym, co wpisano, wykrywa błąd.
function isValidCalendarDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// Walidacja godziny GG:MM w pełnym zakresie 00-23 / 00-59 (pkt B/6) —
// sam regex formatu przepuściłby np. 29:70.
function isValidTimeString(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(timeStr || '')) return false;
  const [h, m] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function daysUntil(dueDate) {
  if (!dueDate) return null;
  if (!isValidCalendarDateString(dueDate)) return null; // pkt 9: nigdy NaN do priorytetów
  const today = new Date(localDateKey() + 'T00:00:00');
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  return Number.isNaN(diff) ? null : diff;
}

// Jawna reguła eskalacji priorytetu wg terminu (wymóg pkt 10).
// Termin dziś/jutro potrafi przebić trening (3) — to jest właśnie
// mechanizm, dzięki któremu trening "przesuwa się" pod dużym
// obciążeniem szkolnym: PriorityEngine i tak już wypełnia budżet
// czasu wg priorytetu, więc pilne zadanie szkolne naturalnie
// wygrywa o czas z treningiem BEZ ŻADNEJ specjalnej logiki
// w PriorityEngine/DecisionEngine — obie te warstwy zostają
// dokładnie takie, jak w Kroku 3.
function computeSchoolPriority(item, mode) {
  // UWAGA: widoczność w trybie wakacyjnym jest już rozstrzygnięta w
  // SchoolModule.getTasks() (filtr dueDate / activeDuringVacation) —
  // ta funkcja NIE decyduje o widoczności, tylko o priorytecie
  // elementów, które i tak zostały uznane za widoczne. Parametr `mode`
  // zostaje w sygnaturze dla ewentualnych przyszłych, jawnych różnic
  // w priorytecie między rokiem szkolnym a wakacjami (obecnie brak).
  const base = SCHOOL_TYPE_BASE_PRIORITY[item.type] ?? 4.5;
  const daysLeft = daysUntil(item.dueDate);
  if (daysLeft === null) return base;       // brak terminu (np. materiał) — priorytet bazowy typu
  if (daysLeft <= 0) return 2.5;             // termin dziś/przekroczony — nad treningiem
  if (daysLeft === 1) return 2.8;            // jutro — wciąż nad treningiem
  if (daysLeft <= 3) return Math.min(base, 3.5); // pilne — blisko/nad treningiem zależnie od typu
  return base;                                // spokojny termin — zwykły priorytet typu
}

/* ============================================================
   WALIDACJA / validateSchoolItem
   ============================================================ */
const SCHOOL_ALLOWED_TYPES = Object.keys(SCHOOL_TYPE_LABELS);

function validateSchoolItem(raw) {
  const errors = [];
  if (!SCHOOL_ALLOWED_TYPES.includes(raw.type)) errors.push('Typ: musi być jednym z ' + SCHOOL_ALLOWED_TYPES.join(', '));
  if (typeof raw.subject !== 'string' || !raw.subject.trim()) errors.push('Przedmiot: wymagany');
  if (typeof raw.title !== 'string' || !raw.title.trim()) errors.push('Tytuł: wymagany');
  if (raw.dueDate && !isValidCalendarDateString(raw.dueDate)) errors.push('Termin: nieprawidłowa data (format RRRR-MM-DD, musi istnieć w kalendarzu)');
  const minutes = parseInt(raw.estimatedMinutes, 10);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) errors.push('Szacowany czas: liczba całkowita 5-600 minut');
  const difficulty = parseInt(raw.difficulty, 10);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) errors.push('Trudność: liczba całkowita 1-5');
  return { valid: errors.length === 0, errors, minutes, difficulty };
}

// existingSchedule (opcjonalnie) — lista już zapisanych lekcji, do
// wykrycia nakładania się w obrębie tego samego dnia tygodnia
// (pkt B/8). excludeLessonId pozwala w przyszłości na edycję lekcji
// bez fałszywej kolizji z samą sobą — obecnie addLesson zawsze
// wywołuje bez tego parametru, bo edycji jeszcze nie ma.
function validateLesson(raw, existingSchedule, excludeLessonId) {
  const errors = [];
  const weekday = parseInt(raw.weekday, 10);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) errors.push('Dzień tygodnia: liczba 0-6');
  if (typeof raw.subject !== 'string' || !raw.subject.trim()) errors.push('Przedmiot: wymagany');
  const startOk = isValidTimeString(raw.startTime);
  const endOk = isValidTimeString(raw.endTime);
  if (!startOk) errors.push('Godzina rozpoczęcia: nieprawidłowa (zakres 00:00-23:59)');
  if (!endOk) errors.push('Godzina zakończenia: nieprawidłowa (zakres 00:00-23:59)');
  if (startOk && endOk && raw.startTime >= raw.endTime) errors.push('Godzina zakończenia musi być późniejsza niż rozpoczęcia');

  if (startOk && endOk && raw.startTime < raw.endTime && Number.isInteger(weekday) && Array.isArray(existingSchedule)) {
    const overlaps = existingSchedule.some(l =>
      l.id !== excludeLessonId &&
      l.weekday === weekday &&
      raw.startTime < l.endTime && l.startTime < raw.endTime // klasyczny test nakładania przedziałów
    );
    if (overlaps) errors.push('Ta lekcja nakłada się z inną lekcją tego samego dnia');
  }

  return { valid: errors.length === 0, errors, weekday };
}

/* ============================================================
   MODUŁ / SchoolModule
   ============================================================
   Zgodność z kontraktem Module: id, name, getTasks, getStats,
   render (wymagane), setTaskStatus, getDayContext (opcjonalne, oba
   obecne). Tryb rok_szkolny/wakacje — w wakacjach getTasks() NIE
   zwraca [] (poprawka Kroku 6, pkt 10-13): elementy z dueDate
   pozostają zawsze widoczne, elementy bez dueDate są widoczne tylko
   gdy activeDuringVacation === true, inaczej są "uśpione" (nadal
   istnieją w Store, tylko niewidoczne w getTasks()).

   NIEZALEŻNOŚĆ: SchoolModule nigdy nie odwołuje się do
   TrainingModule/LearningModule/TRAINING_DAYS/ROADMAP_STAGES.
   Integracja z Treningiem i IT (pkt 11-12) odbywa się WYŁĄCZNIE
   przez: (a) mechanizm priorytetów w PriorityEngine — bez zmian
   w tamtym kodzie, oraz (b) opcjonalny, generyczny kontrakt
   getDayContext(), odczytywany przez pętlę po ModuleRegistry.all()
   w renderTodayTasks() — nigdy przez ModuleRegistry.get('school')
   na sztywno. Ten sam wzorzec, którego DecisionEngine już używa do
   wywołania setTaskStatus na dowolnym module. Żaden moduł nie
   importuje drugiego po nazwie.
   ============================================================ */
const SchoolModule = {
  id: 'school',
  name: 'Szkoła',

  getMode() { return Store.get('school:mode', 'school_year'); },
  setMode(mode) {
    if (mode !== 'school_year' && mode !== 'vacation') return;
    Store.set('school:mode', mode);
    EventBus.emit('school:modeChange', { mode });
  },

  getItems() { return Store.get('school:items', []); },
  getSchedule() { return Store.get('school:schedule', []); },

  addItem(raw) {
    const result = validateSchoolItem(raw);
    if (!result.valid) return { ok: false, errors: result.errors };
    const items = this.getItems();
    items.push({
      id: 'si-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: raw.type, subject: raw.subject.trim(), title: raw.title.trim(),
      dueDate: raw.dueDate || null, estimatedMinutes: result.minutes, difficulty: result.difficulty,
      notes: (raw.notes || '').trim(), status: 'todo', completedDate: null,
      // Dotyczy WYŁĄCZNIE elementów bez dueDate — decyduje, czy materiał
      // bez terminu jest widoczny (aktywny) czy uśpiony w trybie wakacyjnym.
      // Elementy z dueDate są widoczne w wakacje niezależnie od tej flagi.
      activeDuringVacation: !!raw.activeDuringVacation
    });
    Store.set('school:items', items);
    EventBus.emit('school:itemAdded', {});
    return { ok: true, errors: [] };
  },

  deleteItem(itemId) {
    const items = this.getItems().filter(i => i.id !== itemId);
    Store.set('school:items', items);
    EventBus.emit('school:itemDeleted', { itemId });
  },

  addLesson(raw) {
    const schedule = this.getSchedule();
    const result = validateLesson(raw, schedule);
    if (!result.valid) return { ok: false, errors: result.errors };
    schedule.push({ id: 'lsn-' + Date.now(), weekday: result.weekday, subject: raw.subject.trim(), startTime: raw.startTime, endTime: raw.endTime });
    Store.set('school:schedule', schedule);
    return { ok: true, errors: [] };
  },

  deleteLesson(lessonId) {
    Store.set('school:schedule', this.getSchedule().filter(l => l.id !== lessonId));
  },

  // ==== Kontrakt Module ====
  getTasks() {
    const mode = this.getMode();
    return this.getItems()
      // Kontrakt Module (pkt 10.4): getTasks() zwraca WSZYSTKIE statusy —
      // to PriorityEngine.collectOpenTasks() filtruje 'todo' do planowania,
      // a ekran "Ukończone dziś" potrzebuje 'done'. SchoolModule wcześniej
      // zwracał tylko 'todo', przez co ukończone zadanie szkolne znikało
      // bez możliwości cofnięcia — to była realna niespójność z resztą
      // aplikacji (patrz TrainingModule.getTasks()).
      //
      // W trybie wakacyjnym (pkt 10-13): element z dueDate jest ZAWSZE
      // widoczny niezależnie od trybu i activeDuringVacation — świadomie
      // aktywne zadanie z terminem (np. poprawka, praca domowa na powrót)
      // nie może zniknąć. Element BEZ dueDate (typowo materiał) jest
      // widoczny w wakacje tylko gdy activeDuringVacation === true,
      // inaczej jest "uśpiony" — ale nadal istnieje w Store, nic nie jest
      // kasowane ani modyfikowane przez sam odczyt.
      .filter(i => {
        if (mode !== 'vacation') return true;
        if (i.dueDate) return true;
        return !!i.activeDuringVacation;
      })
      .map(i => {
        const daysLeft = daysUntil(i.dueDate);
        const why = i.dueDate
          ? (daysLeft <= 0 ? 'Termin dziś (albo minął) — najwyższy priorytet w obrębie szkoły.'
             : daysLeft === 1 ? 'Termin jutro — wymaga uwagi już dziś.'
             : `Termin za ${daysLeft} dni.`)
          : 'Materiał bez sztywnego terminu — nadrabiaj w wolnych chwilach.';
        return {
          id: i.id, moduleId: this.id, goalId: 'school', schoolItemType: i.type,
          title: `${SCHOOL_TYPE_LABELS[i.type]}: ${i.subject} — ${i.title}`,
          why, estimatedMinutes: i.estimatedMinutes, difficulty: i.difficulty,
          xp: SCHOOL_TYPE_XP[i.type] ?? 20, priority: computeSchoolPriority(i, mode),
          status: i.status, completedDate: i.completedDate, dueDate: i.dueDate
        };
      });
  },

  setTaskStatus(taskId, status) {
    const items = this.getItems();
    const idx = items.findIndex(i => i.id === taskId);
    if (idx < 0) return;
    items[idx] = { ...items[idx], status, completedDate: status === 'done' ? localDateKey() : null };
    Store.set('school:items', items);
    EventBus.emit('task:status', { moduleId: this.id, taskId, status });
  },

  getStats() {
    const items = this.getItems();
    return { done: items.filter(i => i.status === 'done').length, total: items.length, label: this.name };
  },

  // ==== Obciążenie dnia — hak dla generycznej integracji (pkt 11-12) ====
  // Zwraca 'low'|'medium'|'high'. Odczyt tylko generyczny: przez
  // getDayContext() poniżej, wystawiane widokowi "Dziś" przez pętlę
  // po ModuleRegistry.all() — nigdy przez bezpośredni import ani
  // twardo zakodowane ModuleRegistry.get('school').
  getTodayLoadLevel() {
    const mode = this.getMode();
    // Plan lekcji nie obciąża dnia w wakacje (pkt 14) — w roku
    // szkolnym liczymy minuty lekcji dzisiejszego dnia tygodnia.
    const todayWeekday = new Date().getDay();
    const lessonMinutes = mode === 'vacation' ? 0 : this.getSchedule()
      .filter(l => l.weekday === todayWeekday)
      .reduce((sum, l) => {
        const [sh, sm] = l.startTime.split(':').map(Number);
        const [eh, em] = l.endTime.split(':').map(Number);
        return sum + ((eh * 60 + em) - (sh * 60 + sm));
      }, 0);

    // Zadania z terminem są zawsze brane pod uwagę (niezależnie od
    // trybu — patrz getTasks()), rozdzielone na "dziś/jutro" i
    // "po terminie" z różnymi wagami (pkt 15).
    const dueItems = this.getItems().filter(i => i.status === 'todo' && i.dueDate);
    const urgentMinutes = dueItems
      .filter(i => { const dl = daysUntil(i.dueDate); return dl !== null && dl >= 0 && dl <= 1; })
      .reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0);
    const overdueMinutes = dueItems
      .filter(i => { const dl = daysUntil(i.dueDate); return dl !== null && dl < 0; })
      .reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0);

    const total = lessonMinutes * SCHOOL_LOAD_LESSON_WEIGHT
      + urgentMinutes * SCHOOL_LOAD_URGENT_TASK_WEIGHT
      + overdueMinutes * SCHOOL_LOAD_OVERDUE_TASK_WEIGHT;

    if (total >= SCHOOL_LOAD_HIGH_THRESHOLD) return 'high';
    if (total >= SCHOOL_LOAD_MEDIUM_THRESHOLD) return 'medium';
    return 'low';
  },

  // ==== Generyczny kontekst dnia (pkt 17) ====
  // Zastępuje bezpośrednie odwołanie widoku "Dziś" do
  // ModuleRegistry.get('school'). Każdy moduł, który chce pokazać
  // notatkę/ostrzeżenie na ekranie "Dziś", implementuje ten sam
  // opcjonalny kontrakt — widok głównego ekranu nie zna ID 'school'.
  getDayContext() {
    const level = this.getTodayLoadLevel();
    if (level !== 'high') return null;
    return {
      moduleId: this.id,
      level,
      message: '⚠ Duże obciążenie szkolne dziś — priorytety poniżej mogą odzwierciedlać to, że pilne terminy wyprzedziły dziś trening. To normalne i celowe.'
    };
  },

  render(container) {
    const mode = this.getMode();
    container.innerHTML = `
      <div class="card">
        <h3>🎓 Szkoła</h3>
        <div class="field-row" style="margin-bottom:14px;">
          <button class="ghost mode-btn" data-mode="school_year">Rok szkolny</button>
          <button class="ghost mode-btn" data-mode="vacation">Wakacje</button>
          <span class="badge ${mode === 'vacation' ? 'warn' : 'ok'}">${mode === 'vacation' ? 'Tryb wakacyjny — plan lekcji wyłączony, wybrane zadania pozostają aktywne' : 'Tryb roku szkolnego'}</span>
        </div>
        <div class="tabs" id="school-tabs">
          <button class="ghost school-tab" data-tab="items">Zadania i terminy</button>
          <button class="ghost school-tab" data-tab="schedule">Plan lekcji</button>
        </div>
        <div id="school-content"></div>
      </div>
    `;

    container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
      btn.addEventListener('click', () => { this.setMode(btn.dataset.mode); this.render(container); if (typeof renderTodayTasks === 'function') renderTodayTasks(); });
    });

    const contentEl = container.querySelector('#school-content');
    const tabsEl = container.querySelector('#school-tabs');

    const renderItemsTab = () => {
      const items = this.getItems().slice().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
      contentEl.innerHTML = `
        <div class="profile-form" style="margin-bottom:14px;">
          <div class="field-row">
            <select id="si-type">${SCHOOL_ALLOWED_TYPES.map(t => `<option value="${t}">${SCHOOL_TYPE_LABELS[t]}</option>`).join('')}</select>
            <input type="text" id="si-subject" placeholder="przedmiot" style="width:120px;">
            <input type="text" id="si-title" placeholder="tytuł/opis" style="width:160px;">
          </div>
          <div class="field-row">
            <input type="date" id="si-due">
            <input type="number" id="si-minutes" placeholder="czas (min)" style="width:110px;">
            <select id="si-difficulty">${[1,2,3,4,5].map(n => `<option value="${n}">trudność ${n}</option>`).join('')}</select>
            <button class="ghost" id="si-add">+ dodaj</button>
          </div>
          <div class="field-row">
            <label style="font-size:12px;color:var(--text3);display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="si-active-vacation">
              aktywne w wakacjach (dotyczy tylko elementów bez terminu)
            </label>
          </div>
          <div class="log-errors" id="si-errors" style="display:none;color:#f87171;font-size:12px;margin-top:6px;"></div>
        </div>
        <div id="si-list"></div>
      `;
      const listEl = contentEl.querySelector('#si-list');
      const renderList = () => {
        const current = this.getItems().slice().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
        listEl.innerHTML = current.map(i => {
          const dl = daysUntil(i.dueDate);
          const dueLabel = i.dueDate ? `${i.dueDate}${dl != null ? ` (${dl <= 0 ? 'dziś/po terminie' : 'za ' + dl + ' dni'})` : ''}` : 'brak terminu';
          const vacationLabel = !i.dueDate ? (i.activeDuringVacation ? ', aktywne w wakacje' : ', uśpione w wakacje') : '';
          return `
          <div class="item ${i.status === 'done' ? 'done' : ''}">
            <input type="checkbox" class="cb si-cb" data-id="${escapeAttr(i.id)}" ${i.status === 'done' ? 'checked' : ''}>
            <label>${SCHOOL_TYPE_LABELS[i.type]}: <b>${escapeHtml(i.subject)}</b> — ${escapeHtml(i.title)} <span class="pillar-tag">(${dueLabel}${vacationLabel}, priorytet ${computeSchoolPriority(i, mode)})</span></label>
            <button class="mini-btn si-del" data-id="${escapeAttr(i.id)}">usuń</button>
          </div>`;
        }).join('') || '<p style="color:var(--text3);font-size:12px;">Brak zadań szkolnych.</p>';

        listEl.querySelectorAll('.si-cb').forEach(cb => cb.addEventListener('change', () => {
          this.setTaskStatus(cb.dataset.id, cb.checked ? 'done' : 'todo');
          renderList();
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        }));
        listEl.querySelectorAll('.si-del').forEach(btn => btn.addEventListener('click', () => {
          if (!confirm('Usunąć to zadanie szkolne?')) return;
          this.deleteItem(btn.dataset.id);
          renderList();
          if (typeof renderTodayTasks === 'function') renderTodayTasks();
        }));
      };
      renderList();

      contentEl.querySelector('#si-add').addEventListener('click', () => {
        const raw = {
          type: contentEl.querySelector('#si-type').value,
          subject: contentEl.querySelector('#si-subject').value,
          title: contentEl.querySelector('#si-title').value,
          dueDate: contentEl.querySelector('#si-due').value,
          estimatedMinutes: contentEl.querySelector('#si-minutes').value,
          difficulty: contentEl.querySelector('#si-difficulty').value,
          activeDuringVacation: contentEl.querySelector('#si-active-vacation').checked
        };
        const result = this.addItem(raw);
        const errEl = contentEl.querySelector('#si-errors');
        if (!result.ok) { errEl.style.display = 'block'; errEl.textContent = result.errors.join(' · '); return; }
        errEl.style.display = 'none';
        renderList();
        if (typeof renderTodayTasks === 'function') renderTodayTasks();
      });
    };

    const renderScheduleTab = () => {
      const DAY_NAMES = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
      const schedule = this.getSchedule().slice().sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
      contentEl.innerHTML = `
        <div class="profile-form" style="margin-bottom:14px;">
          <div class="field-row">
            <select id="lsn-weekday">${[1,2,3,4,5].map(d => `<option value="${d}">${DAY_NAMES[d]}</option>`).join('')}</select>
            <input type="text" id="lsn-subject" placeholder="przedmiot" style="width:140px;">
            <input type="time" id="lsn-start">
            <input type="time" id="lsn-end">
            <button class="ghost" id="lsn-add">+ dodaj</button>
          </div>
          <div class="log-errors" id="lsn-errors" style="display:none;color:#f87171;font-size:12px;margin-top:6px;"></div>
        </div>
        <div id="lsn-list"></div>
      `;
      const listEl = contentEl.querySelector('#lsn-list');
      const renderList = () => {
        const current = this.getSchedule().slice().sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
        listEl.innerHTML = current.map(l => `
          <div class="item">
            <label style="flex:1;">${DAY_NAMES[l.weekday]}: <b>${escapeHtml(l.subject)}</b> ${l.startTime}–${l.endTime}</label>
            <button class="mini-btn lsn-del" data-id="${escapeAttr(l.id)}">usuń</button>
          </div>
        `).join('') || '<p style="color:var(--text3);font-size:12px;">Brak zaplanowanych lekcji.</p>';
        listEl.querySelectorAll('.lsn-del').forEach(btn => btn.addEventListener('click', () => { this.deleteLesson(btn.dataset.id); renderList(); }));
      };
      renderList();

      contentEl.querySelector('#lsn-add').addEventListener('click', () => {
        const raw = {
          weekday: contentEl.querySelector('#lsn-weekday').value,
          subject: contentEl.querySelector('#lsn-subject').value,
          startTime: contentEl.querySelector('#lsn-start').value,
          endTime: contentEl.querySelector('#lsn-end').value
        };
        const result = this.addLesson(raw);
        const errEl = contentEl.querySelector('#lsn-errors');
        if (!result.ok) { errEl.style.display = 'block'; errEl.textContent = result.errors.join(' · '); return; }
        errEl.style.display = 'none';
        renderList();
      });
    };

    let activeTab = 'items';
    function selectTab(tab) {
      activeTab = tab;
      tabsEl.querySelectorAll('.school-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      if (tab === 'items') renderItemsTab(); else renderScheduleTab();
    }
    tabsEl.querySelectorAll('.school-tab').forEach(btn => btn.addEventListener('click', () => selectTab(btn.dataset.tab)));
    selectTab('items');
  }
};
ModuleRegistry.register(SchoolModule);




/* ============================================================
   BACKUP / EXPORT / IMPORT (Krok 8)
   Odpowiedzialność: bezpieczne, transakcyjne przechowywanie kopii
   zapasowej całego stanu Personal OS poza aplikacją i jej odtwarzanie
   bez ryzyka przypadkowego, częściowego zniszczenia istniejących
   danych. Import działa wyłącznie w trybie Replace (nie ma Merge —
   semantyka scalania jest niejednoznaczna dla co najmniej czterech
   domen, patrz specyfikacja Kroku 8).

   Fazy importu:
     FAZA 1 (parseAndValidateBackupFile) — parsowanie + bezpieczeństwo
       + walidacja koperty. ZERO dotknięcia jakiegokolwiek Store.
     FAZA 2 (stageAndValidateBackup) — MemoryStore, migracje, pełna
       walidacja domenowa. ZERO zapisów do prawdziwego Store.
     FAZA 3 (commitStagedImport) — jedyny moment dotknięcia prawdziwych
       danych. Migawka rollbackowa budowana W PAMIĘCI przed pierwszym
       zapisem. Store.set z {strict:true, silent:true} dla każdego
       namespace'u; awaria dowolnego zapisu -> natychmiastowy rollback
       ze wszystkich namespace'ów z migawki, bez przerywania na
       pierwszym niepowodzeniu rollbacku.
   ============================================================ */

// Jawna, zakodowana na sztywno lista namespace'ów Store należących do
// Personal OS. Eksport i import NIGDY nie iterują po całym localStorage
// ani po kluczach dostarczonych przez backup — zawsze po tej liście.
const KNOWN_NAMESPACES = [
  'dayRecords', 'habitDefs', 'habitLogs', 'ui:timeBudget',
  'training:profile', 'training:sessions', 'training:exerciseLogs',
  'it:stageStatuses', 'it:criteriaDone', 'it:lessonGuides', 'it:lessonGuidesRecoveredContainer',
  'school:mode', 'school:items', 'school:schedule', 'sandbox:tasks'
];

// Fallback dla każdego namespace'u — MUSI być identyczny z fallbackiem,
// którego już używa właściwy moduł/silnik przy Store.get(). Rozjazd
// fallbacków między dwoma miejscami czytającymi ten sam klucz był już
// raz realnym błędem (Krok 6, school:items) — tutaj pilnowany od
// pierwszej linii, nie po fakcie.
const NAMESPACE_DEFAULTS = {
  'dayRecords': {},
  'habitDefs': DEFAULT_HABITS,
  'habitLogs': {},
  'ui:timeBudget': 'normal',
  'training:profile': null,
  'training:sessions': {},
  'training:exerciseLogs': {},
  'it:stageStatuses': null,
  'it:criteriaDone': {},
  'it:lessonGuides': {},
  'it:lessonGuidesRecoveredContainer': null,
  'school:mode': 'school_year',
  'school:items': [],
  'school:schedule': [],
  'sandbox:tasks': null
};

// Rejestr wersjonowany, dopisywany w każdym przyszłym kroku zmieniającym
// zakres backupu, NIGDY przepisywany wstecznie — ten sam wzorzec co
// MIGRATIONS. Krok 8 jest pierwszą wersją, która w ogóle tworzy backupy,
// więc jedyny dowodliwy wpis dziś to appDataVersion=5 (obecny
// DATA_VERSION w momencie wprowadzenia tej funkcji). Backup z wersji
// spoza tego rejestru (teoretycznie możliwe dopiero w przyszłości) nie
// ma żadnego namespace'u traktowanego jako ściśle wymagany — wszystkie
// brakujące dostają bezpieczny domyślny, zgodnie z zasadą "starszy
// backup może legalnie nie mieć namespace'u, który jeszcze wtedy nie
// istniał".
const REQUIRED_NAMESPACES_BY_APP_DATA_VERSION = {
  5: [
    'dayRecords', 'habitDefs', 'habitLogs', 'ui:timeBudget',
    'training:profile', 'training:sessions', 'training:exerciseLogs',
    'it:stageStatuses', 'it:criteriaDone', 'it:lessonGuides',
    'school:mode', 'school:items', 'school:schedule', 'sandbox:tasks'
    // it:lessonGuidesRecoveredContainer CELOWO POMINIĘTY — jedyny
    // namespace, którego istnienie jest z definicji warunkowe (tylko
    // po awaryjnym odzysku uszkodzonego kontenera w migracji 5),
    // niezależnie od appDataVersion.
  ]
};

/* ---------- Walidatory per namespace ----------
   Reużywają istniejące walidatory domenowe tam, gdzie rzeczywiście
   wystarczają (validateProfile, isValidLessonGuide, validateSchoolItem,
   validateLesson). Tam, gdzie istniejący walidator sprawdza tylko
   podzbiór pól pojedynczego elementu (nie cały zapisany kształt ani
   cały kontener), dodany jest minimalny wrapper — nigdy nowy model
   domenowy, tylko dodatkowe sprawdzenie pól, których oryginalny
   walidator nie dotyka. */

const TASK_STATUSES = ['todo', 'done', 'skipped'];
const STAGE_STATUSES = ['locked', 'active', 'done'];
// Kryteria roadmapy IT NIE mają stanu "pominięte" — w przeciwieństwie
// do SchoolItem/sandbox:tasks, których model to dopuszcza. Osobny
// zbiór, żeby zaostrzenie tutaj nie zawęziło przypadkiem walidacji
// innych namespace'ów, które legalnie używają 'skipped'.
const CRITERION_STATUSES = ['todo', 'done'];
// Wyprowadzone z AKTUALNEJ, rzeczywistej definicji roadmapy — nie z
// osobnej, ręcznie utrzymywanej listy, która mogłaby się rozjechać.
const ROADMAP_STAGE_IDS = ROADMAP_STAGES.map(s => s.id);
const ROADMAP_CRITERION_IDS = ROADMAP_STAGES.flatMap(s => s.criteria.map(c => c.id));
const TRAINING_SESSION_STATUSES = ['planned', 'in_progress', 'partial', 'completed', 'skipped'];

function validateDayRecordsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['dayRecords: wymagany obiekt'] };
  const errors = [];
  for (const [date, rec] of Object.entries(raw)) {
    if (!isValidCalendarDateString(date)) { errors.push(`dayRecords: nieprawidłowy klucz daty "${date}"`); continue; }
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { errors.push(`dayRecords[${date}]: wymagany obiekt`); continue; }
    if (rec.sleepHours !== undefined && !(typeof rec.sleepHours === 'number' && rec.sleepHours >= 0 && rec.sleepHours <= 24)) errors.push(`dayRecords[${date}].sleepHours: nieprawidłowy`);
    if (rec.sleepQuality !== undefined && !(typeof rec.sleepQuality === 'number' && rec.sleepQuality >= 1 && rec.sleepQuality <= 5)) errors.push(`dayRecords[${date}].sleepQuality: nieprawidłowy`);
    if (rec.energyScore !== undefined && !(typeof rec.energyScore === 'number' && rec.energyScore >= 0 && rec.energyScore <= 100)) errors.push(`dayRecords[${date}].energyScore: nieprawidłowy`);
    if (rec.trainingLoad !== undefined && !(typeof rec.trainingLoad === 'number' && rec.trainingLoad >= 0)) errors.push(`dayRecords[${date}].trainingLoad: nieprawidłowy`);
  }
  return { valid: errors.length === 0, errors };
}

function validateHabitDefsArray(raw) {
  if (!Array.isArray(raw)) return { valid: false, errors: ['habitDefs: wymagana tablica'] };
  const errors = [];
  raw.forEach((h, i) => {
    if (!h || typeof h !== 'object') { errors.push(`habitDefs[${i}]: wymagany obiekt`); return; }
    if (typeof h.id !== 'string' || !h.id) errors.push(`habitDefs[${i}].id: wymagany`);
    if (typeof h.label !== 'string' || !h.label) errors.push(`habitDefs[${i}].label: wymagany`);
    if (typeof h.goalPillar !== 'string' || !h.goalPillar) errors.push(`habitDefs[${i}].goalPillar: wymagany`);
    if (!Number.isFinite(h.xp) || h.xp < 0) errors.push(`habitDefs[${i}].xp: nieprawidłowy`);
    if (typeof h.frequency !== 'string' || !h.frequency) errors.push(`habitDefs[${i}].frequency: wymagany`);
    if (typeof h.active !== 'boolean') errors.push(`habitDefs[${i}].active: wymagany boolean`);
  });
  return { valid: errors.length === 0, errors };
}

function validateHabitLogsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['habitLogs: wymagany obiekt'] };
  const errors = [];
  for (const [habitId, byDate] of Object.entries(raw)) {
    if (!byDate || typeof byDate !== 'object' || Array.isArray(byDate)) { errors.push(`habitLogs[${habitId}]: wymagany obiekt`); continue; }
    for (const [date, done] of Object.entries(byDate)) {
      if (!isValidCalendarDateString(date)) { errors.push(`habitLogs[${habitId}]: nieprawidłowa data "${date}"`); continue; }
      if (typeof done !== 'boolean') errors.push(`habitLogs[${habitId}][${date}]: wymagany boolean`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateUiTimeBudgetValue(raw) {
  const ok = ['short', 'normal', 'long'].includes(raw);
  return { valid: ok, errors: ok ? [] : ['ui:timeBudget: nieprawidłowa wartość'] };
}

function validateTrainingProfileValue(raw) {
  if (raw === null) return { valid: true, errors: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['training:profile: wymagany obiekt albo null'] };
  return validateProfile(raw);
}

function validateTrainingSessionsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['training:sessions: wymagany obiekt'] };
  const errors = [];
  for (const [taskId, s] of Object.entries(raw)) {
    if (!s || typeof s !== 'object') { errors.push(`training:sessions[${taskId}]: wymagany obiekt`); continue; }
    if (!TRAINING_SESSION_STATUSES.includes(s.status)) errors.push(`training:sessions[${taskId}].status: nieprawidłowy`);
    if (!(s.completedDate === null || isValidCalendarDateString(s.completedDate))) errors.push(`training:sessions[${taskId}].completedDate: nieprawidłowy`);
  }
  return { valid: errors.length === 0, errors };
}

function validateExerciseLogsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['training:exerciseLogs: wymagany obiekt'] };
  const errors = [];
  for (const [exerciseId, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) { errors.push(`training:exerciseLogs[${exerciseId}]: wymagana tablica`); continue; }
    entries.forEach((e, i) => {
      if (!e || typeof e !== 'object') { errors.push(`training:exerciseLogs[${exerciseId}][${i}]: wymagany obiekt`); return; }
      if (!isValidCalendarDateString(e.date)) errors.push(`training:exerciseLogs[${exerciseId}][${i}].date: nieprawidłowa`);
      ['sets', 'reps', 'durationSeconds', 'weight', 'rpe'].forEach(f => {
        if (e[f] !== undefined && !Number.isFinite(e[f])) errors.push(`training:exerciseLogs[${exerciseId}][${i}].${f}: musi być liczbą`);
      });
    });
  }
  return { valid: errors.length === 0, errors };
}

function validateStageStatusesMap(raw) {
  // UWAGA: null NIE jest tu już traktowane jako poprawny fallback —
  // to zostało celowo usunięte (Krok 8.2). Legalny brak stanu w
  // starszych backupach jest normalizowany do pełnej mapy WCZEŚNIEJ,
  // w stageAndValidateBackup() (przez RoadmapEngine.deriveInitialStatuses()),
  // więc jeśli ten walidator w ogóle dostanie null, to dla backupu
  // AKTUALNEJ wersji — czyli dowód spreparowanego/uszkodzonego pliku,
  // nie legalny stan. Wymagany jest zawsze pełny, poprawny obiekt.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['it:stageStatuses: wymagany obiekt (null niedozwolone)'] };
  const errors = [];
  // Żadnych nieznanych stageId — backup nie może wprowadzić etapu,
  // którego aktualna roadmapa w ogóle nie definiuje.
  Object.keys(raw).forEach(stageId => {
    if (!ROADMAP_STAGE_IDS.includes(stageId)) errors.push(`it:stageStatuses: nieznany stageId "${stageId}" (nie istnieje w aktualnej roadmapie)`);
  });
  // Wymagane WSZYSTKIE aktualne stageId — częściowa mapa statusów
  // etapów jest niespójnym stanem, nie legalnym częściowym profilem
  // (w przeciwieństwie np. do TrainingProfile).
  ROADMAP_STAGE_IDS.forEach(stageId => {
    if (!(stageId in raw)) errors.push(`it:stageStatuses: brak wymaganego stageId "${stageId}"`);
  });
  for (const [stageId, status] of Object.entries(raw)) {
    if (!STAGE_STATUSES.includes(status)) errors.push(`it:stageStatuses[${stageId}]: nieprawidłowy status`);
  }
  return { valid: errors.length === 0, errors };
}

function validateCriteriaDoneMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['it:criteriaDone: wymagany obiekt'] };
  const errors = [];
  for (const [critId, rec] of Object.entries(raw)) {
    if (!ROADMAP_CRITERION_IDS.includes(critId)) { errors.push(`it:criteriaDone: nieznany criterionId "${critId}" (nie istnieje w aktualnej roadmapie)`); continue; }
    if (!rec || typeof rec !== 'object') { errors.push(`it:criteriaDone[${critId}]: wymagany obiekt`); continue; }
    if (!CRITERION_STATUSES.includes(rec.status)) errors.push(`it:criteriaDone[${critId}].status: nieprawidłowy (dozwolone wyłącznie todo/done, nie skipped)`);
    if (!(rec.completedDate === null || isValidCalendarDateString(rec.completedDate))) errors.push(`it:criteriaDone[${critId}].completedDate: nieprawidłowy`);
  }
  return { valid: errors.length === 0, errors };
}

function validateLessonGuidesMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['it:lessonGuides: wymagany obiekt'] };
  const errors = [];
  for (const [criterionId, entry] of Object.entries(raw)) {
    const check = isValidLessonGuide(entry, criterionId);
    if (!check.valid) errors.push(`it:lessonGuides[${criterionId}]: ${check.errors.join('; ')}`);
  }
  return { valid: errors.length === 0, errors };
}

// Waliduje WYŁĄCZNIE zewnętrzną kopertę {recoveredAt, originalValue}.
// originalValue NIGDY nie jest walidowane strukturalnie — z definicji
// jest to nieinterpretowana, dowolnego kształtu treść odzyskana z
// uszkodzonego kontenera (Krok 7, migracja 5).
function validateRecoveredContainerEnvelope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, errors: ['it:lessonGuidesRecoveredContainer: wymagany obiekt'] };
  if (!isValidIsoTimestamp(raw.recoveredAt)) return { valid: false, errors: ['it:lessonGuidesRecoveredContainer.recoveredAt: nieprawidłowy'] };
  if (!('originalValue' in raw)) return { valid: false, errors: ['it:lessonGuidesRecoveredContainer.originalValue: wymagany klucz'] };
  return { valid: true, errors: [] };
}

function validateSchoolModeValue(raw) {
  const ok = raw === 'school_year' || raw === 'vacation';
  return { valid: ok, errors: ok ? [] : ['school:mode: nieprawidłowa wartość'] };
}

function validateSchoolItemsArray(raw) {
  if (!Array.isArray(raw)) return { valid: false, errors: ['school:items: wymagana tablica'] };
  const errors = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== 'object') { errors.push(`school:items[${i}]: wymagany obiekt`); return; }
    const baseCheck = validateSchoolItem(item); // reużyty istniejący walidator (type/subject/title/dueDate/estimatedMinutes/difficulty)
    if (!baseCheck.valid) errors.push(`school:items[${i}]: ${baseCheck.errors.join('; ')}`);
    if (typeof item.id !== 'string' || !item.id) errors.push(`school:items[${i}].id: wymagany`); // pole POZA zakresem validateSchoolItem
    if (!TASK_STATUSES.includes(item.status)) errors.push(`school:items[${i}].status: nieprawidłowy`);
    if (!(item.completedDate === null || isValidCalendarDateString(item.completedDate))) errors.push(`school:items[${i}].completedDate: nieprawidłowy`);
    if (typeof item.activeDuringVacation !== 'boolean') errors.push(`school:items[${i}].activeDuringVacation: wymagany boolean`);
  });
  return { valid: errors.length === 0, errors };
}

function validateScheduleArray(raw) {
  if (!Array.isArray(raw)) return { valid: false, errors: ['school:schedule: wymagana tablica'] };
  const errors = [];
  const builtSoFar = [];
  raw.forEach((lesson, i) => {
    if (!lesson || typeof lesson !== 'object') { errors.push(`school:schedule[${i}]: wymagany obiekt`); return; }
    if (typeof lesson.id !== 'string' || !lesson.id) errors.push(`school:schedule[${i}].id: wymagany`); // pole POZA zakresem validateLesson
    const check = validateLesson(lesson, builtSoFar, lesson.id); // reużyty istniejący walidator, budowany przyrostowo dla poprawnego wykrycia nakładania
    if (!check.valid) errors.push(`school:schedule[${i}]: ${check.errors.join('; ')}`);
    builtSoFar.push(lesson);
  });
  return { valid: errors.length === 0, errors };
}

function validateSandboxTasksArray(raw) {
  if (raw === null) return { valid: true, errors: [] };
  if (!Array.isArray(raw)) return { valid: false, errors: ['sandbox:tasks: wymagana tablica albo null'] };
  const errors = [];
  raw.forEach((t, i) => {
    if (!t || typeof t !== 'object') { errors.push(`sandbox:tasks[${i}]: wymagany obiekt`); return; }
    if (typeof t.id !== 'string' || !t.id) errors.push(`sandbox:tasks[${i}].id: wymagany`);
    if (!TASK_STATUSES.includes(t.status)) errors.push(`sandbox:tasks[${i}].status: nieprawidłowy`);
  });
  return { valid: errors.length === 0, errors };
}

const NAMESPACE_VALIDATORS = {
  'dayRecords': validateDayRecordsMap,
  'habitDefs': validateHabitDefsArray,
  'habitLogs': validateHabitLogsMap,
  'ui:timeBudget': validateUiTimeBudgetValue,
  'training:profile': validateTrainingProfileValue,
  'training:sessions': validateTrainingSessionsMap,
  'training:exerciseLogs': validateExerciseLogsMap,
  'it:stageStatuses': validateStageStatusesMap,
  'it:criteriaDone': validateCriteriaDoneMap,
  'it:lessonGuides': validateLessonGuidesMap,
  'it:lessonGuidesRecoveredContainer': validateRecoveredContainerEnvelope,
  'school:mode': validateSchoolModeValue,
  'school:items': validateSchoolItemsArray,
  'school:schedule': validateScheduleArray,
  'sandbox:tasks': validateSandboxTasksArray
};

/* ---------- Bezpieczeństwo wejścia (backup to niezaufane dane) ---------- */

const BACKUP_MAX_BYTES = 20 * 1024 * 1024; // 20 MB — hojny margines względem realnego limitu localStorage (~5-10 MB)
const BACKUP_MAX_DEPTH = 50; // chroni przed DoS przez sztucznie głębokie zagnieżdżenie

// Rekurencyjnie odrzuca własne klucze __proto__/constructor/prototype
// na dowolnej głębokości. JSON.parse sam w sobie NIE poluuje
// Object.prototype (tworzy je jako zwykłą własną właściwość przez
// [[DefineOwnProperty]]), ale jakikolwiek późniejszy kod robiący
// generyczne kopiowanie właściwości (Object.assign, spread, pętla
// for..in z przypisaniem) mógłby to zamienić w prawdziwe zanieczyszczenie
// prototypu — dlatego cały backup jest odrzucany W CAŁOŚCI, zanim
// cokolwiek dalej go przetworzy.
function scanForDangerousKeys(value, depth) {
  depth = depth || 0;
  if (depth > BACKUP_MAX_DEPTH) return true;
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(v => scanForDangerousKeys(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
    if (scanForDangerousKeys(value[key], depth + 1)) return true;
  }
  return false;
}

const BACKUP_FORMAT_ID = 'personal-os-v2-backup';
const BACKUP_FORMAT_VERSION = 1;

function isValidBackupEnvelope(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { valid: false, errors: ['Nieprawidłowa struktura pliku backupu'] };
  const errors = [];
  if (parsed.backupFormat !== BACKUP_FORMAT_ID) errors.push('Nieznany format backupu');
  if (parsed.backupVersion !== BACKUP_FORMAT_VERSION) errors.push('Nieobsługiwana wersja formatu backupu');
  if (!Number.isInteger(parsed.appDataVersion) || parsed.appDataVersion < 1) errors.push('Nieprawidłowa wersja danych aplikacji w backupie');
  if (!isValidIsoTimestamp(parsed.exportedAt)) errors.push('Nieprawidłowa data eksportu');
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) errors.push('Nieprawidłowa zawartość danych backupu');
  return { valid: errors.length === 0, errors };
}

/* ---------- Eksport ---------- */

// Czysto odczytowy — zero Store.set, deterministyczny poza exportedAt.
// Iteruje WYŁĄCZNIE po KNOWN_NAMESPACES, nigdy po localStorage.
function exportBackup() {
  const data = {};
  for (const ns of KNOWN_NAMESPACES) {
    const value = Store.get(ns, NAMESPACE_DEFAULTS[ns]);
    if (ns === 'it:lessonGuidesRecoveredContainer' && value === null) continue; // opcjonalny — pomijamy, gdy nigdy nie zaistniał
    data[ns] = value;
  }
  return {
    backupFormat: BACKUP_FORMAT_ID,
    backupVersion: BACKUP_FORMAT_VERSION,
    appDataVersion: DATA_VERSION,
    exportedAt: nowIso(),
    data
  };
}

function downloadBackupFile() {
  const envelope = exportBackup();
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personal-os-backup-${localDateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return envelope;
}

/* ---------- Import — FAZA 1: parsowanie + bezpieczeństwo + koperta ---------- */

function utf8ByteLength(str) {
  // string.length liczy jednostki UTF-16, nie bajty — dla tekstu z
  // polskimi znakami/emoji BYŁOBY to zaniżeniem względem realnego
  // rozmiaru pliku. BACKUP_MAX_BYTES ma oznaczać bajty dosłownie,
  // więc mierzymy przez rzeczywiste kodowanie UTF-8.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length;
  return Buffer.byteLength(str, 'utf8'); // środowisko bez TextEncoder (np. Node w testach)
}

function parseAndValidateBackupFile(rawJsonText) {
  if (typeof rawJsonText !== 'string' || rawJsonText.length === 0) {
    return { ok: false, errors: ['Pusty albo nieprawidłowy plik.'] };
  }
  if (utf8ByteLength(rawJsonText) > BACKUP_MAX_BYTES) {
    return { ok: false, errors: ['Plik jest zbyt duży.'] };
  }

  let parsed;
  try { parsed = JSON.parse(rawJsonText); }
  catch (e) { return { ok: false, errors: ['Nieprawidłowy plik JSON: ' + e.message] }; }

  if (scanForDangerousKeys(parsed, 0)) {
    return { ok: false, errors: ['Plik zawiera niebezpieczne klucze (__proto__/constructor/prototype) albo zbyt głęboką strukturę — odrzucony w całości.'] };
  }

  const envCheck = isValidBackupEnvelope(parsed);
  if (!envCheck.valid) return { ok: false, errors: envCheck.errors };

  if (parsed.appDataVersion > DATA_VERSION) {
    return { ok: false, errors: [`Ten backup pochodzi z nowszej wersji Personal OS (v${parsed.appDataVersion}), ta wersja aplikacji (v${DATA_VERSION}) nie może go bezpiecznie odczytać.`] };
  }

  return { ok: true, envelope: parsed };
}

/* ---------- Import — FAZA 2: staging (MemoryStore) + migracje + walidacja ---------- */

function stageAndValidateBackup(envelope) {
  const required = REQUIRED_NAMESPACES_BY_APP_DATA_VERSION[envelope.appDataVersion];
  if (required) {
    const missing = required.filter(ns => !(ns in envelope.data));
    if (missing.length) {
      return { ok: false, errors: [`Backup nie zawiera wymaganych danych dla tej wersji: ${missing.join(', ')}`] };
    }
  }
  // Backup z wersji spoza rejestru (teoretycznie możliwe dopiero
  // w przyszłości) — żaden namespace nie jest ściśle wymagany,
  // wszystko brakujące dostaje bezpieczny domyślny niżej.

  const staging = createMemoryStore();
  for (const ns of KNOWN_NAMESPACES) {
    staging.set(ns, (ns in envelope.data) ? envelope.data[ns] : NAMESPACE_DEFAULTS[ns]);
  }

  staging.set('meta:schemaVersion', envelope.appDataVersion);
  runMigrations(staging); // TA SAMA logika migracji co na prawdziwych danych, w pełnej izolacji

  // it:stageStatuses = null jest legalne WYŁĄCZNIE jako naturalny brak
  // stanu w backupach STARSZYCH niż aktualna wersja — wtedy
  // normalizujemy do pełnej mapy przez RoadmapEngine.deriveInitialStatuses(),
  // dokładnie tak jak zrobiłaby to sama aplikacja (reconcileRoadmapState())
  // przy pierwszym uruchomieniu na takich danych. Dla backupu AKTUALNEJ
  // wersji null NIE jest normalizowany — prawdziwy exportBackup() nigdy
  // go nie produkuje (reconcileRoadmapState() uruchamia się już przy
  // starcie aplikacji, przed jakimkolwiek eksportem), więc null w
  // backupie v5 jest dowodem spreparowanego/uszkodzonego pliku, nie
  // legalnym stanem — ma zostać odrzucony przez walidator niżej, nie
  // po cichu naprawiony. Nie dotyka RoadmapEngine ani zasad
  // odblokowywania etapów — to wyłącznie normalizacja wejścia importu.
  if (envelope.appDataVersion < DATA_VERSION && staging.get('it:stageStatuses', null) === null) {
    staging.set('it:stageStatuses', RoadmapEngine.deriveInitialStatuses());
  }

  // it:lessonGuidesRecoveredContainer: jedyny świadomy wyjątek od reguły
  // "błąd jednej domeny = odrzucenie całego importu" — to opcjonalne,
  // z definicji nieinterpretowalne dane odzyskowe. Niepoprawna
  // zewnętrzna koperta nie blokuje reszty importu — ten fragment jest
  // po prostu porzucany, jakby nigdy go nie było.
  const rc = staging.get('it:lessonGuidesRecoveredContainer', null);
  if (rc !== null && !validateRecoveredContainerEnvelope(rc).valid) {
    staging.set('it:lessonGuidesRecoveredContainer', null);
  }

  const errors = [];
  for (const ns of KNOWN_NAMESPACES) {
    if (ns === 'it:lessonGuidesRecoveredContainer') continue; // zwalidowany/oczyszczony powyżej, nigdy nie blokuje całości
    const value = staging.get(ns, NAMESPACE_DEFAULTS[ns]);
    const check = NAMESPACE_VALIDATORS[ns](value);
    if (!check.valid) errors.push(`${ns}: ${check.errors.join('; ')}`);
  }
  if (errors.length) return { ok: false, errors };

  return { ok: true, staging };
}

/* ---------- Import — FAZA 3: commit + rollback ---------- */

// Migawka W PAMIĘCI, deep clone, budowana PRZED pierwszym zapisem —
// zero zależności od jakiegokolwiek dodatkowego localStorage.
function buildRollbackSnapshot() {
  const snapshot = {};
  for (const ns of KNOWN_NAMESPACES) {
    snapshot[ns] = JSON.parse(JSON.stringify(Store.get(ns, NAMESPACE_DEFAULTS[ns])));
  }
  return snapshot;
}

// Próbuje przywrócić WSZYSTKIE namespace'y z migawki, nie przerywając
// się po pierwszym niepowodzeniu — minimalizuje szkodę. Zwraca
// jednoznaczne rozróżnienie: IMPORT_FAILED_ROLLBACK_OK vs
// IMPORT_FAILED_ROLLBACK_FAILED (nigdy nie twierdzi "przywrócono",
// jeśli którykolwiek zapis przywracający też zawiódł).
function attemptRollback(rollbackSnapshot) {
  const failed = [];
  for (const ns of KNOWN_NAMESPACES) {
    try {
      Store.set(ns, rollbackSnapshot[ns], { strict: true, silent: true });
    } catch (e) {
      failed.push(ns);
    }
  }
  return failed.length === 0
    ? { status: 'IMPORT_FAILED_ROLLBACK_OK' }
    : { status: 'IMPORT_FAILED_ROLLBACK_FAILED', failedNamespaces: failed };
}

function commitStagedImport(staging) {
  const rollbackSnapshot = buildRollbackSnapshot();
  const finalValues = KNOWN_NAMESPACES.map(ns => [ns, staging.get(ns, NAMESPACE_DEFAULTS[ns])]);

  try {
    for (const [ns, value] of finalValues) {
      Store.set(ns, value, { strict: true, silent: true });
    }
  } catch (commitError) {
    const rollbackResult = attemptRollback(rollbackSnapshot);
    const errorMessage = String((commitError && commitError.message) || commitError);
    if (rollbackResult.status === 'IMPORT_FAILED_ROLLBACK_OK') {
      return { ok: false, status: 'IMPORT_FAILED_ROLLBACK_OK', error: errorMessage };
    }
    return { ok: false, status: 'IMPORT_FAILED_ROLLBACK_FAILED', error: errorMessage, failedNamespaces: rollbackResult.failedNamespaces };
  }

  EventBus.emit('backup:importCompleted', {}); // JEDNO zbiorcze zdarzenie po pełnym sukcesie
  return { ok: true };
}

/* ---------- Orkiestracja wysokiego poziomu ---------- */

// Pełny import od surowego tekstu pliku do committed stanu. Używane
// przez testy i jako fallback — UI (patrz niżej) zwykle woli osobno
// wywołać previewBackupFile() (podgląd bez zapisu) i dopiero po
// potwierdzeniu commitStagedImport() na TYM SAMYM już zwalidowanym
// stagingu, żeby uniknąć podwójnego uruchamiania migracji.
function importBackup(rawJsonText) {
  const parseResult = parseAndValidateBackupFile(rawJsonText);
  if (!parseResult.ok) return { ok: false, phase: 'parse', errors: parseResult.errors };

  const stageResult = stageAndValidateBackup(parseResult.envelope);
  if (!stageResult.ok) return { ok: false, phase: 'validate', errors: stageResult.errors };

  const commitResult = commitStagedImport(stageResult.staging);
  if (!commitResult.ok) return { ok: false, phase: 'commit', status: commitResult.status, error: commitResult.error, failedNamespaces: commitResult.failedNamespaces };

  return { ok: true };
}

// Parsuje + staginguje + liczy podstawowe statystyki, bez jakiegokolwiek
// zapisu do prawdziwego Store. UI wywołuje to przy wyborze pliku, żeby
// pokazać podgląd przed potwierdzeniem Replace.
function previewBackupFile(rawJsonText) {
  const parseResult = parseAndValidateBackupFile(rawJsonText);
  if (!parseResult.ok) return { ok: false, errors: parseResult.errors };

  const stageResult = stageAndValidateBackup(parseResult.envelope);
  if (!stageResult.ok) return { ok: false, errors: stageResult.errors };

  const staging = stageResult.staging;
  const stats = {
    trainingSessions: Object.keys(staging.get('training:sessions', {})).length,
    criteriaDone: Object.values(staging.get('it:criteriaDone', {})).filter(c => c.status === 'done').length,
    schoolItems: staging.get('school:items', []).length,
    lessonGuides: Object.keys(staging.get('it:lessonGuides', {})).length
  };

  return { ok: true, envelope: parseResult.envelope, stats, staging };
}

/* ============================================================
   INICJALIZACJA UI
   ============================================================ */
function buildNav() {
  const nav = document.getElementById('nav');
  const views = [
    { id: 'dzis', label: '☀️ Dziś' },
    { id: 'status', label: '⚙️ Status fundamentu' },
    ...ModuleRegistry.all().map(m => ({ id: m.id, label: '🧩 ' + m.name })),
    { id: 'settings', label: '💾 Ustawienia / Dane' },
    { id: 'docs', label: '📄 Kontrakt Module' }
  ];
  nav.innerHTML = views.map(v => `<button class="navbtn" data-view="${v.id}">${v.label}</button>`).join('');
  nav.querySelectorAll('.navbtn').forEach(btn => {
    btn.addEventListener('click', () => Router.go(btn.dataset.view));
  });
}

function renderStatusBadges() {
  const el = document.getElementById('status-badges');
  const modCount = ModuleRegistry.all().length;
  el.innerHTML = `
    <span class="badge ok">✓ Store aktywny</span>
    <span class="badge ok">✓ EventBus aktywny</span>
    <span class="badge ok">✓ Router aktywny</span>
    <span class="badge">${modCount} zarejestrowany moduł</span>
  `;
}

function initEventLog() {
  const logEl = document.getElementById('event-log');
  const entries = [];
  EventBus.on('store:change', ({ key, value }) => {
    entries.unshift(`[${new Date().toLocaleTimeString('pl-PL')}] store:change → ${key}`);
    logEl.innerHTML = entries.slice(0, 15).map(e => `<div>${e}</div>`).join('');
  });
  EventBus.on('route:change', (viewId) => {
    entries.unshift(`[${new Date().toLocaleTimeString('pl-PL')}] route:change → ${viewId}`);
    logEl.innerHTML = entries.slice(0, 15).map(e => `<div>${e}</div>`).join('');
  });
  logEl.innerHTML = '<div style="color:var(--text3);">Zaloguj serię w module Trening albo zmień status zadania, żeby zobaczyć zdarzenie.</div>';
}

/* ---------- UI: Ustawienia / Dane (Krok 8) ---------- */

function renderSettingsView() {
  const container = document.getElementById('view-settings');
  if (!container) return;
  container.innerHTML = `
    <div class="card">
      <h3>💾 Kopia zapasowa</h3>
      <p>Personal OS nie ma backendu — wszystkie dane żyją wyłącznie w tej przeglądarce. Eksportuj kopię, żeby zabezpieczyć się przed wyczyszczeniem danych albo zmianą urządzenia.</p>
      <p style="font-size:12px;color:var(--text3);">Plik zawiera Twoje prywatne dane Personal OS (postęp nauki, dane szkolne, sesje treningowe) — przechowuj go tak ostrożnie jak inne prywatne pliki.</p>
      <button class="ghost" id="backup-export-btn">⬇ Eksportuj kopię</button>
    </div>
    <div class="card">
      <h3>📥 Przywracanie z kopii</h3>
      <p style="font-size:12px;color:var(--text3);">Import <b>całkowicie zastępuje</b> Twoje aktualne dane zawartością pliku — to nie jest scalanie (Merge nie jest dostępny).</p>
      <input type="file" id="backup-import-file" accept="application/json,.json" style="display:none;">
      <button class="ghost" id="backup-import-btn">⬆ Importuj kopię</button>
      <div id="backup-import-panel" style="margin-top:10px;"></div>
    </div>
  `;

  container.querySelector('#backup-export-btn').addEventListener('click', () => {
    downloadBackupFile();
  });

  const fileInput = container.querySelector('#backup-import-file');
  container.querySelector('#backup-import-btn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // pozwala wybrać dokładnie ten sam plik ponownie później
    if (!file) return;
    // Sprawdzenie PRZED uruchomieniem FileReader — plik zbyt duży
    // nigdy nie jest w ogóle wczytywany do pamięci. file.size to
    // realny rozmiar w bajtach raportowany przez przeglądarkę, więc
    // porównanie z BACKUP_MAX_BYTES jest tu bezpośrednie, bez
    // potrzeby dodatkowego przeliczania kodowania.
    if (file.size > BACKUP_MAX_BYTES) {
      renderImportError(['Plik jest zbyt duży.']);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleBackupFileSelected(String(reader.result));
    reader.onerror = () => renderImportError(['Nie udało się odczytać pliku.']);
    reader.readAsText(file);
  });
}

function handleBackupFileSelected(rawJsonText) {
  const preview = previewBackupFile(rawJsonText);
  if (!preview.ok) { renderImportError(preview.errors); return; }

  const env = preview.envelope;
  const panel = document.getElementById('backup-import-panel');
  panel.innerHTML = `
    <div class="ex-detail">
      <b>Podgląd kopii przed przywróceniem</b>
      <div style="font-size:12px;margin-top:6px;">
        Wyeksportowano: ${escapeHtml(new Date(env.exportedAt).toLocaleString('pl-PL'))}<br>
        Wersja danych: v${escapeHtml(String(env.appDataVersion))}<br>
        Sesje treningowe: ${preview.stats.trainingSessions}<br>
        Ukończone kryteria IT: ${preview.stats.criteriaDone}<br>
        Elementy szkolne: ${preview.stats.schoolItems}<br>
        Przewodniki LessonGuide: ${preview.stats.lessonGuides}
      </div>
      <div class="banner-warn" style="margin-top:10px;">⚠ Import ZASTĄPI całkowicie Twoje aktualne dane zawartością tego pliku (tryb Replace). Tej operacji nie można cofnąć po ostatecznym potwierdzeniu.</div>
      <div class="field-row" style="margin-top:8px;">
        <button class="ghost" id="backup-import-confirm1">Chcę zastąpić aktualne dane</button>
        <button class="ghost" id="backup-import-cancel">Anuluj</button>
      </div>
      <div id="backup-import-confirm2-wrap" style="display:none;margin-top:8px;">
        <span style="color:#f87171;font-size:12px;">Na pewno? Aktualne dane zostaną trwale zastąpione.</span>
        <button class="ghost" id="backup-import-confirm2">Potwierdź i zastąp</button>
      </div>
    </div>
  `;

  panel.querySelector('#backup-import-cancel').addEventListener('click', () => { panel.innerHTML = ''; });
  panel.querySelector('#backup-import-confirm1').addEventListener('click', () => {
    panel.querySelector('#backup-import-confirm2-wrap').style.display = 'block';
  });
  panel.querySelector('#backup-import-confirm2').addEventListener('click', () => {
    const commitResult = commitStagedImport(preview.staging);
    if (!commitResult.ok) { renderImportCommitFailure(commitResult); return; }
    panel.innerHTML = `<div class="ex-detail" style="border-color:#4ade80;"><b>✅ Import zakończony sukcesem.</b> Dane zostały zastąpione zawartością kopii.</div>`;
  });
}

function renderImportError(errors) {
  const panel = document.getElementById('backup-import-panel');
  panel.innerHTML = `<div class="banner-warn">Nie udało się wczytać pliku:<br>${errors.map(e => '• ' + escapeHtml(e)).join('<br>')}</div>`;
}

function renderImportCommitFailure(commitResult) {
  const panel = document.getElementById('backup-import-panel');
  if (commitResult.status === 'IMPORT_FAILED_ROLLBACK_OK') {
    panel.innerHTML = `<div class="banner-warn">Import nie powiódł się (${escapeHtml(commitResult.error)}). Poprzedni stan został przywrócony — Twoje dane sprzed importu są bezpieczne.</div>`;
  } else {
    panel.innerHTML = `<div class="banner-warn" style="border-color:#f87171;">
      <b>⚠ KRYTYCZNY BŁĄD</b><br>
      Import nie powiódł się, a przywrócenie poprzedniego stanu również nie powiodło się. Stan aplikacji może być niespójny. Nie wykonuj dalszych zmian i nie zamykaj tej strony.
    </div>`;
  }
}

// Pełny re-render UI po udanym imporcie (dane zmieniły się hurtowo,
// pojedyncze store:change nie zostały wyemitowane celowo — patrz
// Store.set({silent:true}) w commitStagedImport).
function refreshWholeAppUI() {
  renderStatusBadges();
  renderDzis();
  ModuleRegistry.all().forEach(mod => {
    const c = document.getElementById('view-' + mod.id);
    if (c) mod.render(c);
  });
}


(function init() {
  runMigrations(Store); // ZAWSZE pierwsze — zanim jakikolwiek moduł/silnik odczyta dane z Store
  buildNav();
  renderStatusBadges();
  initEventLog();
  renderDzis();
  renderSettingsView();
  EventBus.on('backup:importCompleted', refreshWholeAppUI); // jeden zbiorczy re-render po udanym Replace

  // każdy moduł renderuje się do własnego kontenera .view-<id>
  // (Core tworzy kontener dynamicznie, jeśli moduł go nie ma w HTML)
  ModuleRegistry.all().forEach(mod => {
    let container = document.getElementById('view-' + mod.id);
    if (!container) {
      container = document.createElement('div');
      container.className = 'view';
      container.id = 'view-' + mod.id;
      document.querySelector('.wrap').appendChild(container);
    }
    mod.render(container);
  });

  Router.go('dzis');
})();

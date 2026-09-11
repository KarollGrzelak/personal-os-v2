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

// Priorytet BAZOWY typu (przed uwzględnieniem terminu) — całkowita
// skala Task v2 zachowuje wcześniejszą kolejność typów: szkoła
// jako całość jest ważniejsza niż projekty
// poboczne, ale bez pilnego terminu nie przebija zdrowia/snu/treningu.
const SCHOOL_TYPE_BASE_PRIORITY = {
  exam: 32, test: 34, quiz: 36, project: 38, homework: 42, review: 44, material: 48
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

// Walidacja godziny GG:MM w pełnym zakresie 00-23 / 00-59 (pkt B/6) —
// sam regex formatu przepuściłby np. 29:70.
function isValidTimeString(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(timeStr || '')) return false;
  const [h, m] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function daysUntil(dueDate, baseDate) {
  if (!dueDate) return null;
  if (!isValidCalendarDateString(dueDate)) return null; // pkt 9: nigdy NaN do priorytetów
  return differenceInCalendarDays(baseDate, dueDate);
}

// Jawna reguła eskalacji priorytetu wg terminu (wymóg pkt 10).
// Termin dziś/jutro potrafi przebić trening (30) — to jest właśnie
// mechanizm, dzięki któremu trening "przesuwa się" pod dużym
// obciążeniem szkolnym: PriorityEngine i tak już wypełnia budżet
// czasu wg priorytetu, więc pilne zadanie szkolne naturalnie
// wygrywa o czas z treningiem BEZ ŻADNEJ specjalnej logiki
// w PriorityEngine/DecisionEngine — obie te warstwy zostają
// dokładnie takie, jak w Kroku 3.
function computeSchoolPriority(item, mode, date) {
  // UWAGA: widoczność w trybie wakacyjnym jest już rozstrzygnięta w
  // SchoolModule.getTasks(date) (filtr dueDate / activeDuringVacation) —
  // ta funkcja NIE decyduje o widoczności, tylko o priorytecie
  // elementów, które i tak zostały uznane za widoczne. Parametr `mode`
  // zostaje w sygnaturze dla ewentualnych przyszłych, jawnych różnic
  // w priorytecie między rokiem szkolnym a wakacjami (obecnie brak).
  const base = SCHOOL_TYPE_BASE_PRIORITY[item.type] ?? 45;
  const daysLeft = daysUntil(item.dueDate, date);
  if (daysLeft === null) return base;       // brak terminu (np. materiał) — priorytet bazowy typu
  if (daysLeft <= 0) return 25;             // termin dziś/przekroczony — nad treningiem
  if (daysLeft === 1) return 28;            // jutro — wciąż nad treningiem
  if (daysLeft <= 3) return Math.min(base, 35); // bliski termin — zachowana kolejność typów
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

const SCHOOL_TASK_TITLE_MAX_LENGTH = 300;
const SCHOOL_WEEKDAY_LABELS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const SCHOOL_DIFFICULTY_LABELS = {
  1: 'Bardzo łatwe',
  2: 'Łatwe',
  3: 'Umiarkowane',
  4: 'Wymagające',
  5: 'Bardzo wymagające'
};
const SCHOOL_COLLECTION_VISIBLE_LIMIT = 8;

function schoolItemVisibleInMode(item, mode) {
  if (mode !== 'vacation') return true;
  if (item.dueDate) return true;
  return !!item.activeDuringVacation;
}

function schoolDuePresentation(item, date) {
  const daysLeft = daysUntil(item.dueDate, date);
  if (daysLeft === null) return { kind: 'none', label: 'Bez terminu' };
  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return { kind: 'overdue', label: `Po terminie o ${overdueDays} ${overdueDays === 1 ? 'dzień' : 'dni'}` };
  }
  if (daysLeft === 0) return { kind: 'today', label: 'Termin dzisiaj' };
  if (daysLeft === 1) return { kind: 'tomorrow', label: 'Termin jutro' };
  return { kind: daysLeft <= 3 ? 'soon' : 'future', label: `Termin za ${daysLeft} dni` };
}

function schoolStatusLabel(status) {
  if (status === 'done') return 'Ukończone';
  if (status === 'skipped') return 'Pominięte';
  return 'Do zrobienia';
}

function schoolTaskTitle(item) {
  const fullTitle = `${SCHOOL_TYPE_LABELS[item.type]}: ${item.subject} — ${item.title}`;
  if (fullTitle.length <= SCHOOL_TASK_TITLE_MAX_LENGTH) return fullTitle;

  // Iteracja po punktach kodowych zapobiega pozostawieniu samotnej
  // połówki pary surogatów przy granicy skrócenia. Limit odpowiada
  // semantyce String.length używanej przez validateTaskV2.
  let shortened = '';
  for (const character of fullTitle) {
    if (shortened.length + character.length > SCHOOL_TASK_TITLE_MAX_LENGTH - 1) break;
    shortened += character;
  }
  return shortened + '…';
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
   obecne). Tryb rok_szkolny/wakacje — w wakacjach getTasks(date) NIE
   zwraca [] (poprawka Kroku 6, pkt 10-13): elementy z dueDate
   pozostają zawsze widoczne, elementy bez dueDate są widoczne tylko
   gdy activeDuringVacation === true, inaczej są "uśpione" (nadal
   istnieją w Store, tylko niewidoczne w getTasks(date)).

   NIEZALEŻNOŚĆ: SchoolModule nigdy nie odwołuje się do
   TrainingModule/LearningModule/TRAINING_DAYS/ROADMAP_STAGES.
   Integracja z Treningiem i IT (pkt 11-12) odbywa się WYŁĄCZNIE
   przez: (a) mechanizm priorytetów w PriorityEngine — bez zmian
   w tamtym kodzie, oraz (b) opcjonalny, generyczny kontrakt
   getDayContext(), odczytywany przez pętlę po ModuleRegistry.all()
   w rendererze planu Today — nigdy przez ModuleRegistry.get('school')
   na sztywno. Ten sam publiczny wzorzec rejestru stosuje Today do
   delegowania setTaskStatus właścicielowi. Żaden moduł nie
   importuje drugiego po nazwie.
   ============================================================ */
const SchoolModule = {
  id: 'school',
  name: 'Szkoła',

  getMode() { return Store.get('school:mode', 'school_year'); },
  setMode(mode) {
    if (mode !== 'school_year' && mode !== 'vacation') return;
    if (this.getMode() === mode) return;
    Store.set('school:mode', mode);
    EventBus.emit('school:modeChange', { mode });
    emitTasksChanged(this.id, 'configuration');
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
    emitTasksChanged(this.id, 'created');
    return { ok: true, errors: [] };
  },

  deleteItem(itemId) {
    const current = this.getItems();
    if (!current.some(item => item.id === itemId)) return;
    Store.set('school:items', current.filter(i => i.id !== itemId));
    EventBus.emit('school:itemDeleted', { itemId });
    emitTasksChanged(this.id, 'deleted');
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
  getTasks(date) {
    assertPlanningDate(date);
    const mode = this.getMode();
    return this.getItems()
      // Kontrakt Module: getTasks(date) zwraca WSZYSTKIE statusy —
      // to PriorityEngine.collectOpenTasks() filtruje 'todo' do planowania,
      // a ekran "Ukończone dziś" potrzebuje 'done'. SchoolModule wcześniej
      // zwracał tylko 'todo', przez co ukończone zadanie szkolne znikało
      // bez możliwości cofnięcia — to była realna niespójność z resztą
      // aplikacji (patrz TrainingModule.getTasks(date)).
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
        const daysLeft = daysUntil(i.dueDate, date);
        const why = i.dueDate
          ? (daysLeft <= 0 ? 'Termin dziś (albo minął) — najwyższy priorytet w obrębie szkoły.'
             : daysLeft === 1 ? 'Termin jutro — wymaga uwagi już dziś.'
             : `Termin za ${daysLeft} dni.`)
          : 'Materiał bez sztywnego terminu — nadrabiaj w wolnych chwilach.';
        return {
          id: i.id, moduleId: this.id, goalId: 'school', schoolItemType: i.type,
          title: schoolTaskTitle(i),
          why, estimatedMinutes: i.estimatedMinutes, difficulty: i.difficulty,
          xp: SCHOOL_TYPE_XP[i.type] ?? 20, priority: computeSchoolPriority(i, mode, date),
          planningClass: daysLeft !== null && daysLeft <= 1 ? 'urgent' : 'flexible',
          status: i.status, completedDate: i.completedDate, dueDate: i.dueDate
        };
      });
  },

  setTaskStatus(taskId, status) {
    if (!['todo', 'done', 'skipped'].includes(status)) return;
    const items = this.getItems();
    const idx = items.findIndex(i => i.id === taskId);
    if (idx < 0) return;
    if (items[idx].status === status) return;
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
    const today = localDateKey();
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
    // trybu — patrz getTasks(date)), rozdzielone na "dziś/jutro" i
    // "po terminie" z różnymi wagami (pkt 15).
    const dueItems = this.getItems().filter(i => i.status === 'todo' && i.dueDate);
    const urgentMinutes = dueItems
      .filter(i => { const dl = daysUntil(i.dueDate, today); return dl !== null && dl >= 0 && dl <= 1; })
      .reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0);
    const overdueMinutes = dueItems
      .filter(i => { const dl = daysUntil(i.dueDate, today); return dl !== null && dl < 0; })
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
    const today = localDateKey();
    const items = this.getItems().slice().sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'));
    const schedule = this.getSchedule().slice().sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    const visibleItems = items.filter(item => schoolItemVisibleInMode(item, mode));
    const openVisibleItems = visibleItems.filter(item => item.status === 'todo');
    const urgentItems = openVisibleItems.filter(item => {
      const left = daysUntil(item.dueDate, today);
      return left !== null && left <= 1;
    });
    const urgentIds = new Set(urgentItems.map(item => item.id));
    const remainingItems = items.filter(item => !urgentIds.has(item.id));
    const todayWeekday = new Date().getDay();
    const lessonsToday = mode === 'vacation' ? [] : schedule.filter(lesson => lesson.weekday === todayWeekday);
    const overdueCount = urgentItems.filter(item => daysUntil(item.dueDate, today) < 0).length;
    const sleepingVacationCount = mode === 'vacation'
      ? items.filter(item => !schoolItemVisibleInMode(item, mode)).length
      : 0;
    const loadLevel = this.getTodayLoadLevel();

    const renderSchoolItem = item => {
      const itemIndex = items.indexOf(item);
      const controlId = `school-item-status-${itemIndex}`;
      const due = schoolDuePresentation(item, today);
      const sleeping = mode === 'vacation' && !schoolItemVisibleInMode(item, mode);
      const status = schoolStatusLabel(item.status);
      const statusClass = item.status === 'done' ? 'ok' : due.kind === 'overdue' || due.kind === 'today' || due.kind === 'tomorrow' ? 'warn' : '';
      const difficulty = SCHOOL_DIFFICULTY_LABELS[item.difficulty] || 'Trudność nieznana';
      return `
        <article class="school-task ${item.status === 'done' ? 'done' : ''} ${sleeping ? 'sleeping' : ''}" data-school-item="${escapeAttr(item.id)}">
          <div class="school-task-status-control">
            <input type="checkbox" class="cb si-cb" id="${controlId}" data-id="${escapeAttr(item.id)}" ${item.status === 'done' ? 'checked' : ''}>
            <label class="sr-only" for="${controlId}">Oznacz jako ${item.status === 'done' ? 'do zrobienia' : 'ukończone'}: ${escapeHtml(item.title)}</label>
          </div>
          <div class="school-task-body">
            <div class="school-task-heading">
              <div>
                <span class="school-task-type">${escapeHtml(SCHOOL_TYPE_LABELS[item.type] || 'Element szkolny')}</span>
                <h3>${escapeHtml(item.subject)} — ${escapeHtml(item.title)}</h3>
              </div>
              <span class="badge ${statusClass}">${escapeHtml(status)}</span>
            </div>
            <div class="school-task-meta">
              <span class="school-due school-due-${due.kind}">${escapeHtml(due.label)}${item.dueDate ? ` · ${escapeHtml(item.dueDate)}` : ''}</span>
              <span>${escapeHtml(item.estimatedMinutes)} min</span>
              <span>${escapeHtml(difficulty)}</span>
              ${sleeping ? '<span>Uśpione w trybie wakacyjnym</span>' : !item.dueDate && item.activeDuringVacation ? '<span>Aktywne także w wakacje</span>' : ''}
            </div>
            ${item.notes ? `<p class="school-task-notes">${escapeHtml(item.notes)}</p>` : ''}
          </div>
          <button type="button" class="mini-btn si-del" data-id="${escapeAttr(item.id)}" aria-label="Usuń zadanie: ${escapeAttr(item.title)}">Usuń</button>
        </article>`;
    };

    const renderLesson = lesson => `
      <article class="school-lesson" data-school-lesson="${escapeAttr(lesson.id)}">
        <div>
          <span class="school-lesson-day">${escapeHtml(SCHOOL_WEEKDAY_LABELS[lesson.weekday] || 'Nieznany dzień')}</span>
          <strong>${escapeHtml(lesson.subject)}</strong>
        </div>
        <time>${escapeHtml(lesson.startTime)}–${escapeHtml(lesson.endTime)}</time>
        <button type="button" class="mini-btn lsn-del" data-id="${escapeAttr(lesson.id)}" aria-label="Usuń lekcję: ${escapeAttr(lesson.subject)}, ${escapeAttr(SCHOOL_WEEKDAY_LABELS[lesson.weekday] || 'nieznany dzień')}">Usuń</button>
      </article>`;

    const renderProgressiveCollection = (records, renderRecord, emptyMessage, collectionName, moreLabel) => {
      if (!records.length) return `<p class="school-empty">${emptyMessage}</p>`;
      const visibleRecords = records.slice(0, SCHOOL_COLLECTION_VISIBLE_LIMIT);
      const hiddenRecords = records.slice(SCHOOL_COLLECTION_VISIBLE_LIMIT);
      return `
        ${visibleRecords.map(renderRecord).join('')}
        ${hiddenRecords.length ? `
          <details class="school-more" data-school-collection="${collectionName}">
            <summary>${moreLabel} (${hiddenRecords.length})</summary>
            <div class="school-more-body">${hiddenRecords.map(renderRecord).join('')}</div>
          </details>` : ''}`;
    };

    container.innerHTML = `
      <div class="school-product-layout">
        <section class="card school-overview" id="school-overview" aria-labelledby="school-overview-title">
          <div class="school-section-heading">
            <div>
              <p class="school-eyebrow">Najpierw sprawdź sytuację</p>
              <h2 id="school-overview-title" tabindex="-1">Przegląd szkoły</h2>
            </div>
            <span class="badge ${mode === 'vacation' ? 'warn' : 'ok'}">${mode === 'vacation' ? 'Tryb wakacyjny' : 'Rok szkolny'}</span>
          </div>
          <div class="school-overview-grid">
            <div><strong>${openVisibleItems.length}</strong><span>aktywnych zadań</span></div>
            <div><strong>${urgentItems.length}</strong><span>wymaga uwagi teraz</span></div>
            <div><strong>${lessonsToday.length}</strong><span>${mode === 'vacation' ? 'lekcji liczonych dziś' : 'lekcji dzisiaj'}</span></div>
          </div>
          <div class="school-mode-control" role="group" aria-label="Tryb szkoły">
            <span>Aktualny tryb</span>
            <div>
              <button type="button" class="ghost mode-btn" data-mode="school_year" aria-pressed="${mode === 'school_year'}">Rok szkolny</button>
              <button type="button" class="ghost mode-btn" data-mode="vacation" aria-pressed="${mode === 'vacation'}">Wakacje</button>
            </div>
          </div>
          ${mode === 'vacation' ? `<p class="school-mode-note">Plan lekcji nie zwiększa dziś obciążenia. Zadania z terminem oraz materiały oznaczone jako aktywne w wakacje pozostają widoczne. ${sleepingVacationCount ? `${sleepingVacationCount} ${sleepingVacationCount === 1 ? 'element jest uśpiony' : 'elementy są uśpione'}.` : ''}</p>` : ''}
          ${loadLevel === 'high' ? `<div class="banner-warn" role="status"><strong>Duże obciążenie szkolne</strong> Zacznij od pilnych terminów i zaplanuj realne przerwy.</div>` : ''}
        </section>

        <section class="card school-urgent" id="school-urgent" aria-labelledby="school-urgent-title">
          <div class="school-section-heading">
            <div>
              <p class="school-eyebrow">Do działania</p>
              <h2 id="school-urgent-title" tabindex="-1">Pilne zadania</h2>
            </div>
            ${overdueCount ? `<span class="badge warn">${overdueCount} po terminie</span>` : ''}
          </div>
          <div class="school-task-list">${renderProgressiveCollection(urgentItems, renderSchoolItem, 'Nic pilnego. Możesz spokojnie przejść do dalszych terminów.', 'urgent', 'Pozostałe pilne zadania')}</div>
        </section>

        <section class="card school-deadlines" id="school-deadlines" aria-labelledby="school-deadlines-title">
          <div class="school-section-heading">
            <div>
              <p class="school-eyebrow">Po pilnych</p>
              <h2 id="school-deadlines-title" tabindex="-1">Pozostałe terminy i zadania</h2>
            </div>
            <span class="school-section-count">${remainingItems.length} ${remainingItems.length === 1 ? 'element' : 'elementów'}</span>
          </div>
          <div class="school-task-list">${renderProgressiveCollection(remainingItems, renderSchoolItem, 'Brak pozostałych zadań szkolnych.', 'deadlines', 'Pozostałe zadania i terminy')}</div>
        </section>

        <section class="card school-schedule" id="school-schedule" aria-labelledby="school-schedule-title">
          <div class="school-section-heading">
            <div>
              <p class="school-eyebrow">Stały rytm tygodnia</p>
              <h2 id="school-schedule-title" tabindex="-1">Plan lekcji</h2>
            </div>
            <span class="school-section-count">${schedule.length} ${schedule.length === 1 ? 'lekcja' : 'lekcji'}</span>
          </div>
          ${mode === 'vacation' ? '<p class="school-schedule-note">W trybie wakacyjnym plan jest zachowany, ale nie obciąża bieżącego dnia.</p>' : ''}
          <div class="school-lesson-list">${renderProgressiveCollection(schedule, renderLesson, 'Plan lekcji jest pusty.', 'schedule', 'Pozostałe lekcje')}</div>
        </section>

        <details class="card school-create-panel" id="school-add-item">
          <summary><span><strong>Dodaj zadanie lub termin</strong><small>Praca domowa, sprawdzian, projekt albo materiał</small></span></summary>
          <form class="school-form" id="school-item-form" aria-describedby="si-errors">
            <div class="school-form-field"><label for="si-type">Rodzaj zadania</label><select id="si-type">${SCHOOL_ALLOWED_TYPES.map(type => `<option value="${type}">${SCHOOL_TYPE_LABELS[type]}</option>`).join('')}</select></div>
            <div class="school-form-field"><label for="si-subject">Przedmiot</label><input type="text" id="si-subject" placeholder="np. matematyka"></div>
            <div class="school-form-field school-form-wide"><label for="si-title">Tytuł lub opis zadania</label><input type="text" id="si-title" placeholder="np. zadania 1–5 ze strony 42"></div>
            <div class="school-form-field"><label for="si-due">Termin wykonania (opcjonalnie)</label><input type="date" id="si-due"></div>
            <div class="school-form-field"><label for="si-minutes">Szacowany czas w minutach</label><input type="number" min="5" max="600" id="si-minutes" placeholder="np. 45"></div>
            <div class="school-form-field"><label for="si-difficulty">Trudność</label><select id="si-difficulty">${[1,2,3,4,5].map(value => `<option value="${value}">${SCHOOL_DIFFICULTY_LABELS[value]}</option>`).join('')}</select></div>
            <div class="school-form-field school-form-wide"><label for="si-notes">Notatki (opcjonalnie)</label><textarea id="si-notes" rows="3" placeholder="Materiały, zakres albo ważna wskazówka"></textarea></div>
            <label class="school-checkbox-field school-form-wide" for="si-active-vacation"><input type="checkbox" id="si-active-vacation"><span>Aktywne także w wakacje — dotyczy elementów bez terminu</span></label>
            <div class="school-form-actions school-form-wide"><button type="submit" class="primary" id="si-add">Dodaj zadanie</button></div>
            <div class="log-errors school-form-wide" id="si-errors" role="alert" aria-live="polite" hidden></div>
          </form>
        </details>

        <details class="card school-create-panel" id="school-add-lesson">
          <summary><span><strong>Dodaj lekcję do planu</strong><small>Plan tygodniowy szkoły</small></span></summary>
          <form class="school-form" id="school-lesson-form" aria-describedby="lsn-errors">
            <div class="school-form-field"><label for="lsn-weekday">Dzień tygodnia</label><select id="lsn-weekday">${[1,2,3,4,5].map(day => `<option value="${day}">${SCHOOL_WEEKDAY_LABELS[day]}</option>`).join('')}</select></div>
            <div class="school-form-field"><label for="lsn-subject">Przedmiot lekcji</label><input type="text" id="lsn-subject" placeholder="np. język polski"></div>
            <div class="school-form-field"><label for="lsn-start">Godzina rozpoczęcia</label><input type="time" id="lsn-start"></div>
            <div class="school-form-field"><label for="lsn-end">Godzina zakończenia</label><input type="time" id="lsn-end"></div>
            <div class="school-form-actions school-form-wide"><button type="submit" class="primary" id="lsn-add">Dodaj lekcję</button></div>
            <div class="log-errors school-form-wide" id="lsn-errors" role="alert" aria-live="polite" hidden></div>
          </form>
        </details>
      </div>`;

    const focusSchoolSection = sectionId => {
      const heading = container.querySelector(`#${sectionId} h2`);
      heading?.focus();
      return document.activeElement === heading;
    };
    const focusSchoolItem = itemId => {
      const itemElement = [...container.querySelectorAll('[data-school-item]')]
        .find(element => element.dataset.schoolItem === itemId);
      if (!itemElement) return false;
      const disclosure = itemElement.closest('.school-more');
      if (disclosure) disclosure.open = true;
      const control = itemElement.querySelector('.si-cb');
      control?.focus();
      return document.activeElement === control;
    };

    container.querySelectorAll('.mode-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === mode);
      button.addEventListener('click', () => {
        const nextMode = button.dataset.mode;
        this.setMode(nextMode);
        this.render(container);
        [...container.querySelectorAll('.mode-btn')]
          .find(candidate => candidate.dataset.mode === nextMode)?.focus();
      });
    });

    container.querySelectorAll('.si-cb').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const itemId = checkbox.dataset.id;
        this.setTaskStatus(itemId, checkbox.checked ? 'done' : 'todo');
        this.render(container);
        if (!focusSchoolItem(itemId)) focusSchoolSection('school-deadlines');
      });
    });
    container.querySelectorAll('.si-del').forEach(button => {
      button.addEventListener('click', () => {
        if (!confirm('Usunąć to zadanie szkolne?')) return;
        const sectionId = button.closest('section')?.id || 'school-deadlines';
        this.deleteItem(button.dataset.id);
        this.render(container);
        focusSchoolSection(sectionId);
      });
    });
    container.querySelectorAll('.lsn-del').forEach(button => {
      button.addEventListener('click', () => {
        this.deleteLesson(button.dataset.id);
        this.render(container);
        focusSchoolSection('school-schedule');
      });
    });

    const itemForm = container.querySelector('#school-item-form');
    itemForm.addEventListener('submit', event => {
      event.preventDefault();
      const result = this.addItem({
        type: itemForm.querySelector('#si-type').value,
        subject: itemForm.querySelector('#si-subject').value,
        title: itemForm.querySelector('#si-title').value,
        dueDate: itemForm.querySelector('#si-due').value,
        estimatedMinutes: itemForm.querySelector('#si-minutes').value,
        difficulty: itemForm.querySelector('#si-difficulty').value,
        notes: itemForm.querySelector('#si-notes').value,
        activeDuringVacation: itemForm.querySelector('#si-active-vacation').checked
      });
      if (!result.ok) {
        const errorElement = itemForm.querySelector('#si-errors');
        errorElement.hidden = false;
        errorElement.textContent = result.errors.join(' · ');
        return;
      }
      const createdItemId = this.getItems().at(-1)?.id;
      this.render(container);
      if (!focusSchoolItem(createdItemId)) focusSchoolSection('school-deadlines');
    });

    const lessonForm = container.querySelector('#school-lesson-form');
    lessonForm.addEventListener('submit', event => {
      event.preventDefault();
      const result = this.addLesson({
        weekday: lessonForm.querySelector('#lsn-weekday').value,
        subject: lessonForm.querySelector('#lsn-subject').value,
        startTime: lessonForm.querySelector('#lsn-start').value,
        endTime: lessonForm.querySelector('#lsn-end').value
      });
      if (!result.ok) {
        const errorElement = lessonForm.querySelector('#lsn-errors');
        errorElement.hidden = false;
        errorElement.textContent = result.errors.join(' · ');
        return;
      }
      this.render(container);
      focusSchoolSection('school-schedule');
    });
  }
};
ModuleRegistry.register(SchoolModule);

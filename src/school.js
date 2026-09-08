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
      btn.addEventListener('click', () => { this.setMode(btn.dataset.mode); this.render(container); });
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
          const dl = daysUntil(i.dueDate, today);
          const dueLabel = i.dueDate ? `${i.dueDate}${dl != null ? ` (${dl <= 0 ? 'dziś/po terminie' : 'za ' + dl + ' dni'})` : ''}` : 'brak terminu';
          const vacationLabel = !i.dueDate ? (i.activeDuringVacation ? ', aktywne w wakacje' : ', uśpione w wakacje') : '';
          return `
          <div class="item ${i.status === 'done' ? 'done' : ''}">
            <input type="checkbox" class="cb si-cb" data-id="${escapeAttr(i.id)}" ${i.status === 'done' ? 'checked' : ''}>
            <label>${SCHOOL_TYPE_LABELS[i.type]}: <b>${escapeHtml(i.subject)}</b> — ${escapeHtml(i.title)} <span class="pillar-tag">(${dueLabel}${vacationLabel}, priorytet ${computeSchoolPriority(i, mode, today)})</span></label>
            <button class="mini-btn si-del" data-id="${escapeAttr(i.id)}">usuń</button>
          </div>`;
        }).join('') || '<p style="color:var(--text3);font-size:12px;">Brak zadań szkolnych.</p>';

        listEl.querySelectorAll('.si-cb').forEach(cb => cb.addEventListener('change', () => {
          this.setTaskStatus(cb.dataset.id, cb.checked ? 'done' : 'todo');
          renderList();
        }));
        listEl.querySelectorAll('.si-del').forEach(btn => btn.addEventListener('click', () => {
          if (!confirm('Usunąć to zadanie szkolne?')) return;
          this.deleteItem(btn.dataset.id);
          renderList();
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

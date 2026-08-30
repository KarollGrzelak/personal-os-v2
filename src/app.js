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

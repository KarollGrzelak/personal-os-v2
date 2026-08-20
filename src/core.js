/* ============================================================
   CORE / DateUtil
   Odpowiedzialność: jedna — zwraca dzisiejszą datę w LOKALNEJ
   strefie czasowej użytkownika jako 'YYYY-MM-DD'. Celowo NIE
   używamy Date.toISOString(), bo ta metoda konwertuje do UTC —
   dla użytkownika w Polsce (UTC+1/+2) odhaczenie czegoś po 22:00
   mogłoby zostać zapisane pod jutrzejszą datą. Wszystkie silniki
   (DayEngine, HabitEngine) używają WYŁĄCZNIE tej funkcji do
   ustalania "dzisiaj", nigdy własnej logiki dat.
   ============================================================ */
function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ============================================================
   CORE / EVENTBUS
   Prosty publish-subscribe. Moduły nie wołają się nawzajem
   bezpośrednio — komunikują się przez zdarzenia. To jest to,
   co pozwala wymienić jeden moduł bez dotykania innych.
   ============================================================ */
const EventBus = (() => {
  const listeners = {};
  function on(event, fn) {
    (listeners[event] ||= []).push(fn);
    return () => off(event, fn); // zwraca funkcję do odsubskrybowania
  }
  function off(event, fn) {
    listeners[event] = (listeners[event] || []).filter(f => f !== fn);
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => fn(payload));
  }
  return { on, off, emit };
})();

/* ============================================================
   CORE / STORE
   Jedyne miejsce zapisu/odczytu danych. localStorage pod spodem
   (bo to jedyna opcja trwałości działająca po wgraniu na zwykły
   hosting bez backendu), ale moduły nigdy nie wołają localStorage
   bezpośrednio — zawsze przez Store. Dzięki temu, jeśli kiedyś
   zamienimy localStorage na coś innego (np. prawdziwe API),
   zmienia się TYLKO ten jeden obiekt.
   ============================================================ */
const Store = (() => {
  const cache = {};
  function get(key, fallback) {
    if (key in cache) return cache[key];
    let value = fallback;
    try {
      const raw = localStorage.getItem('v2:' + key);
      if (raw !== null) value = JSON.parse(raw);
    } catch (e) { /* uszkodzone dane lub brak dostepu - uzywamy fallback */ }
    cache[key] = value;
    return value;
  }
  // opts.strict (Krok 8): gwarantuje, ze cache NIGDY nie wyprzedza
  // trwalego zapisu. Kolejnosc jest sztywna i celowa:
  //   1. JSON.stringify(value)      - moze rzucic (np. dane cykliczne)
  //   2. localStorage.setItem(...)  - moze rzucic (np. QuotaExceededError)
  //   3. dopiero po sukcesie: cache[key] = value
  //   4. EventBus wylacznie gdy !opts.silent
  // Jesli krok 1 albo 2 rzuci, wyjatek leci dalej NIEZLAPANY tutaj -
  // cache dla tego klucza pozostaje dokladnie taki, jaki byl przed
  // wywolaniem. Nigdy nie moze powstac stan "cache=nowe, localStorage=stare".
  //
  // opts.silent: pomija EventBus.emit - uzywane WYLACZNIE przez import
  // backupu (Krok 8), zeby commit N namespace'ow nie wywolal N osobnych,
  // czesciowo niespojnych re-renderow (EventBus.emit jest synchroniczny).
  //
  // Bez opts (wszystkie dotychczasowe wywolania w calej aplikacji):
  // zachowanie BAJT-W-BAJT identyczne jak przed Krokiem 8 - cache
  // aktualizowany natychmiast, bledy zapisu polykane, EventBus zawsze.
  function set(key, value, opts) {
    const strict = !!(opts && opts.strict);
    const silent = !!(opts && opts.silent);
    if (strict) {
      const raw = JSON.stringify(value); // rzuca -> cache nietkniety, wyjatek w gore
      localStorage.setItem('v2:' + key, raw); // rzuca -> cache nietkniety, wyjatek w gore
      cache[key] = value; // WYLACZNIE po udanym trwalym zapisie
      if (!silent) EventBus.emit('store:change', { key, value });
      return;
    }
    // Dotychczasowa semantyka - zachowana dla kompatybilnosci wstecznej.
    cache[key] = value;
    try { localStorage.setItem('v2:' + key, JSON.stringify(value)); } catch (e) {}
    if (!silent) EventBus.emit('store:change', { key, value });
  }
  return { get, set };
})();

// Store w pamieci - WYLACZNIE do stagingu importu backupu (Krok 8).
// Ten sam kontrakt {get, set}, wiec MIGRATIONS[n](store) dziala
// identycznie niezaleznie od tego, ktory z dwoch dostanie. Nigdy nie
// dotyka localStorage, nigdy nie emituje EventBus - Fazy 1-2 importu
// (parsowanie, migracje, walidacja) maja zerowy efekt uboczny na
// prawdziwy stan aplikacji.
function createMemoryStore() {
  const cache = {};
  function get(key, fallback) { return (key in cache) ? cache[key] : fallback; }
  function set(key, value) {
    // Round-trip przez JSON - dokladnie ten sam efekt serializacji,
    // jaki dalby prawdziwy localStorage (np. undefined znika w
    // obiektach, Date staje sie stringiem) - migracje i walidacja
    // na MemoryStore zachowuja sie identycznie jak na prawdziwym
    // Store, mimo ze nic nie trafia na dysk.
    cache[key] = JSON.parse(JSON.stringify(value));
  }
  return { get, set };
}

/* ============================================================
   CORE / DataMigrations
   Odpowiedzialnosc: jedna - bezpiecznie przeprowadzic dane
   zapisane w Store przez STARSZA wersje schematu do AKTUALNEJ,
   bez utraty danych uzytkownika. Uruchamiana RAZ, na samym
   poczatku init(), zanim jakikolwiek modul czy silnik odczyta
   dane z Store.

   Jak dopisywac kolejne migracje w przyszlych krokach:
   dodaj nowy wpis do MIGRATIONS pod kluczem = docelowa wersja,
   podnies DATA_VERSION o 1. NIE modyfikuj istniejacych wpisow -
   kazda migracja odpowiada za dokladnie jedno przejscie
   wersja->wersja+1, wiec historia jest zawsze odtwarzalna krok
   po kroku, niezaleznie od tego, z jak starej wersji startuje
   uzytkownik.

   Krok 8: kazda migracja przyjmuje `store` jako PARAMETR zamiast
   odwolywac sie do globalnego Store - dzieki temu ta sama, jedyna
   implementacja migracji dziala identycznie na prawdziwym Store
   (normalne uruchomienie aplikacji) i na MemoryStore (staging
   importu backupu). Semantyka kazdej migracji jest niezmieniona
   wzgledem poprzednich Krokow - to wylacznie dependency injection
   store'a, nie zmiana logiki.
   ============================================================ */
const DATA_VERSION = 5; // 1 = pierwotny schemat Sandbox (done: boolean), 2 = status enum (Krok 3), 3 = it:criteriaDone jako rekord {status, completedDate} (Krok 5), 4 = school:items dostaje activeDuringVacation (Krok 6 poprawki), 5 = it:lessonGuides formalizacja modelu LessonGuide (Krok 7)

const MIGRATIONS = {
  2: (store) => {
    const tasks = store.get('sandbox:tasks', null);
    if (!tasks) return;
    const migrated = tasks.map(t => {
      if ('status' in t) return t;
      const { done, ...rest } = t;
      return { ...rest, status: done ? 'done' : 'todo', completedDate: done ? (t.completedDate ?? null) : null };
    });
    store.set('sandbox:tasks', migrated);
  },
  3: (store) => {
    const raw = store.get('it:criteriaDone', {});
    if (!raw || !Object.keys(raw).length) return;
    const migrated = {};
    Object.entries(raw).forEach(([id, val]) => {
      if (val && typeof val === 'object' && 'status' in val) { migrated[id] = val; return; }
      migrated[id] = { status: val ? 'done' : 'todo', completedDate: null };
    });
    store.set('it:criteriaDone', migrated);
  },
  4: (store) => {
    const items = store.get('school:items', []);
    if (!items.length) return;
    const migrated = items.map(i => {
      if ('activeDuringVacation' in i) return i;
      return { ...i, activeDuringVacation: false };
    });
    store.set('school:items', migrated);
  },
  5: (store) => {
    const raw = store.get('it:lessonGuides', {});
    const migratedAtNow = nowIso();

    const isPlainObject = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
    if (!isPlainObject) {
      store.set('it:lessonGuidesRecoveredContainer', {
        recoveredAt: migratedAtNow,
        originalValue: raw
      });
      store.set('it:lessonGuides', {});
      return;
    }

    const migrated = {};
    for (const [criterionId, entry] of Object.entries(raw)) {
      const check = isValidLessonGuide(entry, criterionId);
      if (check.valid) {
        migrated[criterionId] = entry;
        continue;
      }
      migrated[criterionId] = {
        criterionId,
        why: '', skills: [], prerequisites: [],
        resources: { documentation: [], articles: [], videos: [], additional: [] },
        workOrder: [], exercises: [], selfTest: [], commonMistakes: [],
        createdAt: null,
        updatedAt: null,
        migratedAt: migratedAtNow,
        status: 'draft',
        legacyContent: entry
      };
    }
    store.set('it:lessonGuides', migrated);
  }
};

function runMigrations(store) {
  const from = store.get('meta:schemaVersion', 1);
  if (from >= DATA_VERSION) return;

  for (let v = from + 1; v <= DATA_VERSION; v++) {
    if (MIGRATIONS[v]) {
      console.log(`[migracja danych] ${v - 1} -> ${v}`);
      MIGRATIONS[v](store);
    }
    store.set('meta:schemaVersion', v);
  }
}

/* ============================================================
   CORE / MODULE REGISTRY
   Miejsce, gdzie moduły się "zgłaszają". Router i Dashboard
   pytają TYLKO ten rejestr, nigdy nie importują modułów
   bezpośrednio po nazwie — dzięki temu dodanie nowego modułu
   nie wymaga zmian w Core.
   ============================================================ */
const ModuleRegistry = (() => {
  const modules = {};
  function register(mod) {
    // Walidacja kontraktu — sprawdzamy NIE TYLKO obecność pól,
    // ale też że te trzy wymagane są funkcjami (a nie np. stringiem
    // przypadkiem podstawionym pod 'render'). Wychwytujemy to od
    // razu przy rejestracji, nie jako tajemniczy błąd w UI.
    const requiredFns = ['getTasks', 'getStats', 'render'];
    const missing = ['id', 'name', ...requiredFns].filter(k => !(k in mod));
    if (missing.length) {
      console.error(`Moduł "${mod.id || '?'}" nie spełnia kontraktu — brakuje: ${missing.join(', ')}`);
      return;
    }
    const notFunctions = requiredFns.filter(k => typeof mod[k] !== 'function');
    if (notFunctions.length) {
      console.error(`Moduł "${mod.id}" nie spełnia kontraktu — te pola muszą być funkcjami: ${notFunctions.join(', ')}`);
      return;
    }
    // setTaskStatus jest opcjonalne (patrz Krok 3), ale JEŚLI istnieje,
    // musi być funkcją — inaczej DecisionEngine dostanie błąd dopiero
    // przy próbie wywołania, zamiast przy starcie aplikacji.
    if ('setTaskStatus' in mod && typeof mod.setTaskStatus !== 'function') {
      console.error(`Moduł "${mod.id}" ma pole setTaskStatus, ale nie jest ono funkcją.`);
      return;
    }
    modules[mod.id] = mod;
  }
  function get(id) { return modules[id]; }
  function all() { return Object.values(modules); }
  return { register, get, all };
})();

/* ============================================================
   CORE / ROUTER
   Przełącza widoki. Nie wie nic o tym, co jest w środku widoku —
   tylko pokazuje/ukrywa kontener i emituje zdarzenie zmiany.
   ============================================================ */
const Router = (() => {
  let currentView = null;
  function go(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active'));
    const view = document.getElementById('view-' + viewId);
    const btn = document.querySelector(`.navbtn[data-view="${viewId}"]`);
    if (view) view.classList.add('active');
    if (btn) btn.classList.add('active');
    currentView = viewId;
    EventBus.emit('route:change', viewId);
  }
  return { go, current: () => currentView };
})();


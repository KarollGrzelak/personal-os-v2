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



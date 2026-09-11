/* ============================================================
   DANE / ROADMAP_STAGES — droga do pierwszej pracy w IT
   ============================================================
   14 etapów, każdy z jawnym uzasadnieniem "dlaczego teraz".
   Kolejność wynika z realnych zależności (nie da się sensownie
   uczyć OOP przed podstawami Pythona, ani API przed backendem).
   Kryteria ukończenia PODWÓJNIE pełnią rolę: to zarówno "czy etap
   jest zaliczony" (wymóg architektury), JAK I konkretne zadania
   IT eksponowane przez getTasks(date) — bez tego rozdwojenia
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
    emitTasksChanged('it', 'configuration');
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
   NIGDY zadanie. Nie pojawia się w getTasks(date), nie ma wpływu na
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
const RESOURCE_SOURCE_TYPE_LABELS = {
  documentation: 'Dokumentacja', article: 'Artykuł', video: 'Wideo',
  course: 'Kurs', community: 'Społeczność', other: 'Inny materiał'
};
const RESOURCE_LANGUAGE_LABELS = { pl: 'polski', en: 'angielski', other: 'inny język' };
const LEARNING_DIFFICULTY_LABELS = {
  1: 'Bardzo łatwe', 2: 'Łatwe', 3: 'Średnie', 4: 'Trudne', 5: 'Bardzo trudne'
};

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

function guidePanelControlId(panelEl, name) {
  return `${panelEl.id || 'lesson-guide'}-${name}`;
}

function focusGuidePanelControl(panelEl, selector = '[data-guide-primary]') {
  const target = panelEl.querySelector(selector)
    || panelEl.querySelector('.learning-guide-advanced > summary')
    || panelEl;
  target?.focus();
}

function renderGuideEmptyState(criterionId, panelEl) {
  const importId = guidePanelControlId(panelEl, 'import');
  const importButtonId = guidePanelControlId(panelEl, 'import-button');
  const manualButtonId = guidePanelControlId(panelEl, 'manual-button');
  const errorsId = guidePanelControlId(panelEl, 'import-errors');
  panelEl.innerHTML = `
    <div class="learning-guide-empty" role="status">
      <h3>Materiał do tej lekcji nie jest jeszcze przygotowany</h3>
      <p>Nie zapisano jeszcze materiału, instrukcji ani ćwiczenia. Możesz uzupełnić przewodnik ręcznie; aplikacja nie wymyśla źródeł ani treści.</p>
      <button type="button" class="ghost" id="${manualButtonId}" data-guide-primary>Uzupełnij przewodnik</button>
      <details class="learning-guide-advanced">
        <summary>Zaawansowane: import danych przewodnika</summary>
        <div class="learning-guide-advanced-body">
          <label for="${importId}">Dane LessonGuide w formacie JSON</label>
          <textarea id="${importId}" rows="6" placeholder='{"why": "...", "skills": [], "resources": {}, "workOrder": [], "exercises": []}' aria-describedby="${errorsId}"></textarea>
          <button type="button" class="ghost" id="${importButtonId}">Importuj JSON</button>
          <div class="log-errors" id="${errorsId}" role="alert" aria-live="polite" hidden></div>
        </div>
      </details>
    </div>
  `;
  panelEl.querySelector(`#${importButtonId}`).addEventListener('click', () => {
    const text = panelEl.querySelector(`#${importId}`).value;
    const result = importLessonGuideFromJson(criterionId, text);
    const errEl = panelEl.querySelector(`#${errorsId}`);
    if (!result.ok) {
      errEl.hidden = false;
      errEl.textContent = (result.errors || []).join(' | ');
      errEl.focus();
      return;
    }
    renderGuidePanel(criterionId, panelEl);
    focusGuidePanelControl(panelEl);
  });
  panelEl.querySelector(`#${manualButtonId}`).addEventListener('click', () => {
    renderGuideEditForm(criterionId, null, panelEl);
  });
}

function renderGuideView(criterionId, guide, panelEl) {
  const content = normalizeLessonGuide(guide, criterionId);
  const statusLabel = guide.status === 'reviewed' ? 'Treść przejrzana' : 'Wersja robocza';
  const updatedLabel = isValidIsoTimestamp(guide.updatedAt) ? new Date(guide.updatedAt).toLocaleString('pl-PL') : 'brak daty';
  const sourcesLabel = isValidIsoTimestamp(guide.sourcesCheckedAt) ? new Date(guide.sourcesCheckedAt).toLocaleString('pl-PL') : 'nie potwierdzono';
  const migratedNote = isValidIsoTimestamp(guide.migratedAt)
    ? `<p>Odzyskano ze starszego formatu ${escapeHtml(new Date(guide.migratedAt).toLocaleString('pl-PL'))}; pierwotna data utworzenia jest nieznana.</p>`
    : '';
  const editButtonId = guidePanelControlId(panelEl, 'edit');
  const reviewButtonId = guidePanelControlId(panelEl, 'review');
  const sourcesButtonId = guidePanelControlId(panelEl, 'sources');
  const legacyDeleteButtonId = guidePanelControlId(panelEl, 'legacy-delete');
  const legacyConfirmId = guidePanelControlId(panelEl, 'legacy-confirm');
  const legacyConfirmButtonId = guidePanelControlId(panelEl, 'legacy-confirm-button');
  const importId = guidePanelControlId(panelEl, 'replace-import');
  const importButtonId = guidePanelControlId(panelEl, 'replace-import-button');
  const importErrorsId = guidePanelControlId(panelEl, 'replace-import-errors');

  // Resource.url przechodzi walidację również NA RENDERZE (obrona
  // w głębi — nie tylko przy zapisie): jeśli z jakiegoś powodu
  // niepoprawny/niebezpieczny URL trafił do danych (np. stary import
  // sprzed tej poprawki, ręczna ingerencja w Store), link nie jest
  // w ogóle renderowany jako klikalny link, tylko jako sam,
  // zawsze bezpiecznie zescape'owany tekst.
  const resourceGroups = [
    ['Dokumentacja', content.resources.documentation],
    ['Artykuły', content.resources.articles],
    ['Wideo', content.resources.videos],
    ['Dodatkowe', content.resources.additional]
  ];
  const allResources = resourceGroups.flatMap(([label, list]) => (Array.isArray(list) ? list : [])
    .filter(resource => resource && typeof resource === 'object')
    .map(resource => ({ label, resource })));
  const resourcesMarkup = allResources.length
    ? `<ul class="learning-resource-list">${allResources.map(({ label, resource: r }) => {
        const titleSafe = escapeHtml(r.title);
        const sourceLabel = RESOURCE_SOURCE_TYPE_LABELS[r.sourceType] || label;
        const languageLabel = RESOURCE_LANGUAGE_LABELS[r.language] || 'język nieokreślony';
        const metaSafe = `${escapeHtml(sourceLabel)} · ${escapeHtml(languageLabel)} · sprawdzono ${escapeHtml(r.checkedDate || 'brak daty')}`;
        const linkOrText = isValidResourceUrl(r.url)
          ? `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener noreferrer">${titleSafe}</a>`
          : `<span>${titleSafe}</span><strong class="learning-missing-inline">Link zablokowano: nieprawidłowy URL materiału.</strong>`;
        return `<li>${linkOrText}<small>${metaSafe}</small></li>`;
      }).join('')}</ul>`
    : '<p class="learning-missing">Nie zapisano materiału do otwarcia.</p>';
  const workOrder = content.workOrder.filter(step => step && typeof step === 'object');
  const exercises = content.exercises.filter(exercise => exercise && typeof exercise === 'object');
  const selfTest = content.selfTest.filter(question => question && typeof question === 'object');

  panelEl.innerHTML = `
    <div class="learning-guide-content">
      <section class="learning-guide-block" data-guide-section="purpose" tabindex="-1">
        <h3>Po co się tego uczysz</h3>
        ${content.why ? `<p>${escapeHtml(content.why)}</p>` : '<p class="learning-missing">Nie zapisano osobnego wyjaśnienia dla tej lekcji.</p>'}
        ${content.skills.length ? `<p class="learning-guide-support"><strong>Rozwijane umiejętności:</strong> ${content.skills.map(escapeHtml).join(' · ')}</p>` : ''}
        ${content.prerequisites.length ? `<p class="learning-guide-support"><strong>Przed rozpoczęciem:</strong> ${content.prerequisites.map(escapeHtml).join(' · ')}</p>` : ''}
      </section>
      <section class="learning-guide-block" data-guide-section="material" tabindex="-1">
        <h3>Materiał do otwarcia</h3>
        ${resourcesMarkup}
      </section>
      <section class="learning-guide-block" data-guide-section="instruction" tabindex="-1">
        <h3>Instrukcja wykonania</h3>
        ${workOrder.length
          ? `<ol class="learning-step-list">${workOrder.slice().sort((a, b) => Number(a.order) - Number(b.order)).map(step => `<li><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.description)}</span></li>`).join('')}</ol>`
          : '<p class="learning-missing">Nie zapisano jeszcze kolejności wykonania.</p>'}
      </section>
      <section class="learning-guide-block" data-guide-section="exercise" tabindex="-1">
        <h3>Ćwiczenie praktyczne</h3>
        ${exercises.length
          ? `<ul class="learning-exercise-list">${exercises.map(exercise => `<li><strong>${escapeHtml(exercise.title)}</strong>${exercise.difficulty ? `<small>${escapeHtml(LEARNING_DIFFICULTY_LABELS[exercise.difficulty] || `Trudność ${exercise.difficulty}`)}</small>` : ''}<span>${escapeHtml(exercise.description)}</span></li>`).join('')}</ul>`
          : '<p class="learning-missing">Nie zapisano jeszcze ćwiczenia praktycznego.</p>'}
        ${content.miniProject && typeof content.miniProject === 'object' ? `<div class="learning-mini-project"><strong>${escapeHtml(content.miniProject.title)}</strong><p>${escapeHtml(content.miniProject.description)}</p>${Array.isArray(content.miniProject.acceptanceCriteria) && content.miniProject.acceptanceCriteria.length ? `<p><b>Kryteria akceptacji:</b> ${content.miniProject.acceptanceCriteria.map(escapeHtml).join(' · ')}</p>` : ''}</div>` : ''}
      </section>
      <section class="learning-guide-block" data-guide-section="self-test" tabindex="-1">
        <h3>Sprawdź się</h3>
        ${selfTest.length
          ? `<ul class="learning-question-list">${selfTest.map(question => `<li>${escapeHtml(question.prompt)}${question.answer ? `<details><summary>Pokaż odpowiedź</summary><p>${escapeHtml(question.answer)}</p></details>` : ''}</li>`).join('')}</ul>`
          : '<p class="learning-missing">Nie zapisano pytań sprawdzających.</p>'}
        ${content.commonMistakes.length ? `<p class="learning-guide-support"><strong>Uważaj na:</strong> ${content.commonMistakes.map(escapeHtml).join(' · ')}</p>` : ''}
      </section>
      <details class="learning-guide-advanced">
        <summary>Zaawansowane zarządzanie przewodnikiem</summary>
        <div class="learning-guide-advanced-body">
          <div class="learning-guide-meta">
            <span class="badge ${guide.status === 'reviewed' ? 'ok' : 'warn'}">${escapeHtml(statusLabel)}</span>
            <span>Aktualizacja: ${escapeHtml(updatedLabel)}</span>
            <span>Sprawdzenie źródeł: ${escapeHtml(sourcesLabel)}</span>
          </div>
          ${migratedNote}
          <div class="learning-guide-actions">
            <button type="button" class="ghost" id="${editButtonId}" data-guide-primary>Edytuj przewodnik</button>
            ${guide.status === 'draft' ? `<button type="button" class="ghost" id="${reviewButtonId}">Oznacz treść jako przejrzaną</button>` : ''}
            <button type="button" class="ghost" id="${sourcesButtonId}">Potwierdź dzisiejsze sprawdzenie źródeł</button>
          </div>
          <div class="learning-guide-import">
            <label for="${importId}">Zastąp treść danymi LessonGuide w formacie JSON</label>
            <textarea id="${importId}" rows="6" aria-describedby="${importErrorsId}"></textarea>
            <button type="button" class="ghost" id="${importButtonId}">Importuj JSON</button>
            <div class="log-errors" id="${importErrorsId}" role="alert" aria-live="polite" hidden></div>
          </div>
          ${guide.legacyContent !== undefined ? `
            <div class="learning-legacy-content">
              <h4>Odzyskana stara treść</h4>
              <pre>${escapeHtml(JSON.stringify(guide.legacyContent, null, 2))}</pre>
              <button type="button" class="ghost" id="${legacyDeleteButtonId}">Usuń odzyskaną treść</button>
              <div id="${legacyConfirmId}" hidden>
                <p>Na pewno? Tej operacji nie można cofnąć.</p>
                <button type="button" class="ghost" id="${legacyConfirmButtonId}">Potwierdź usunięcie</button>
              </div>
            </div>` : ''}
        </div>
      </details>
    </div>
  `;

  panelEl.querySelector(`#${editButtonId}`).addEventListener('click', () => {
    renderGuideEditForm(criterionId, guide, panelEl);
  });
  const reviewBtn = panelEl.querySelector(`#${reviewButtonId}`);
  if (reviewBtn) reviewBtn.addEventListener('click', () => {
    markLessonGuideReviewed(criterionId);
    renderGuidePanel(criterionId, panelEl);
    const advanced = panelEl.querySelector('.learning-guide-advanced');
    if (advanced) advanced.open = true;
    focusGuidePanelControl(panelEl, `#${sourcesButtonId}`);
  });
  panelEl.querySelector(`#${sourcesButtonId}`).addEventListener('click', () => {
    confirmSourcesChecked(criterionId);
    renderGuidePanel(criterionId, panelEl);
    const advanced = panelEl.querySelector('.learning-guide-advanced');
    if (advanced) advanced.open = true;
    focusGuidePanelControl(panelEl, `#${guidePanelControlId(panelEl, 'sources')}`);
  });
  panelEl.querySelector(`#${importButtonId}`).addEventListener('click', () => {
    const result = importLessonGuideFromJson(criterionId, panelEl.querySelector(`#${importId}`).value);
    const errorElement = panelEl.querySelector(`#${importErrorsId}`);
    if (!result.ok) {
      errorElement.hidden = false;
      errorElement.textContent = (result.errors || []).join(' | ');
      return;
    }
    renderGuidePanel(criterionId, panelEl);
    const advanced = panelEl.querySelector('.learning-guide-advanced');
    if (advanced) advanced.open = true;
    focusGuidePanelControl(panelEl);
  });
  const legacyDelBtn = panelEl.querySelector(`#${legacyDeleteButtonId}`);
  if (legacyDelBtn) legacyDelBtn.addEventListener('click', () => {
    const confirmation = panelEl.querySelector(`#${legacyConfirmId}`);
    confirmation.hidden = false;
    panelEl.querySelector(`#${legacyConfirmButtonId}`)?.focus();
  });
  const legacyConfirmBtn = panelEl.querySelector(`#${legacyConfirmButtonId}`);
  if (legacyConfirmBtn) legacyConfirmBtn.addEventListener('click', () => {
    deleteLegacyContent(criterionId);
    renderGuidePanel(criterionId, panelEl);
    const advanced = panelEl.querySelector('.learning-guide-advanced');
    if (advanced) advanced.open = true;
    focusGuidePanelControl(panelEl);
  });
}

function renderGuideEditForm(criterionId, existingGuide, panelEl) {
  // Stan roboczy WYŁĄCZNIE w pamięci, niezapisany do Store aż do
  // kliknięcia "Zapisz" — Anuluj po prostu wraca do renderGuidePanel
  // bez żadnego zapisu.
  const normalized = normalizeLessonGuide(existingGuide, criterionId);
  const state = {
    why: normalized.why,
    skills: normalized.skills.slice(),
    prerequisites: normalized.prerequisites.slice(),
    resources: {
      documentation: normalized.resources.documentation.slice(),
      articles: normalized.resources.articles.slice(),
      videos: normalized.resources.videos.slice(),
      additional: normalized.resources.additional.slice()
    },
    workOrder: normalized.workOrder.slice(),
    exercises: normalized.exercises.slice(),
    miniProject: normalized.miniProject && typeof normalized.miniProject === 'object'
      ? { ...normalized.miniProject, acceptanceCriteria: Array.isArray(normalized.miniProject.acceptanceCriteria) ? normalized.miniProject.acceptanceCriteria.slice() : [] }
      : null,
    selfTest: normalized.selfTest.slice(),
    commonMistakes: normalized.commonMistakes.slice()
  };

  const RESOURCE_GROUPS = [['documentation', 'Dokumentacja'], ['articles', 'Artykuły'], ['videos', 'Wideo'], ['additional', 'Dodatkowe']];
  const fieldId = name => guidePanelControlId(panelEl, `edit-${name}`);
  const field = name => panelEl.querySelector(`#${fieldId(name)}`);

  function renderForm(focusSelector = null) {
    const errorsId = fieldId('errors');
    panelEl.innerHTML = `
      <form class="learning-guide-form" aria-describedby="${errorsId}">
        <div class="learning-section-heading">
          <div><p class="learning-eyebrow">Edycja treści</p><h3>${existingGuide ? 'Edytuj przewodnik' : 'Utwórz przewodnik'}</h3></div>
        </div>
        <div class="learning-form-field learning-form-wide">
          <label for="${fieldId('why')}">Po co użytkownik uczy się tego tematu</label>
          <textarea id="${fieldId('why')}" rows="3">${escapeHtml(state.why)}</textarea>
        </div>
        <div class="learning-form-field">
          <label for="${fieldId('skills')}">Rozwijane umiejętności (oddziel przecinkami)</label>
          <input type="text" id="${fieldId('skills')}" value="${escapeAttr(state.skills.join(', '))}">
        </div>
        <div class="learning-form-field">
          <label for="${fieldId('prerequisites')}">Wymagania wstępne (oddziel przecinkami)</label>
          <input type="text" id="${fieldId('prerequisites')}" value="${escapeAttr(state.prerequisites.join(', '))}">
        </div>

        ${RESOURCE_GROUPS.map(([key, label]) => `
          <fieldset class="learning-repeatable learning-form-wide">
            <legend>${label}</legend>
            ${state.resources[key].map((r, i) => `
              <div class="learning-repeatable-row">
                <span>${escapeHtml(r.title)} — ${escapeHtml(r.url)}</span>
                <button type="button" class="mini-btn" data-remove-res="${key}:${i}" aria-label="Usuń materiał: ${escapeAttr(r.title)}">Usuń</button>
              </div>
            `).join('')}
            <div class="learning-repeatable-grid">
              <div class="learning-form-field"><label for="${fieldId(`resource-title-${key}`)}">Tytuł</label><input type="text" id="${fieldId(`resource-title-${key}`)}"></div>
              <div class="learning-form-field"><label for="${fieldId(`resource-url-${key}`)}">Adres HTTP lub HTTPS</label><input type="url" id="${fieldId(`resource-url-${key}`)}" placeholder="https://..."></div>
              <div class="learning-form-field"><label for="${fieldId(`resource-type-${key}`)}">Rodzaj źródła</label><select id="${fieldId(`resource-type-${key}`)}">${RESOURCE_SOURCE_TYPES.map(type => `<option value="${type}">${RESOURCE_SOURCE_TYPE_LABELS[type]}</option>`).join('')}</select></div>
              <div class="learning-form-field"><label for="${fieldId(`resource-language-${key}`)}">Język</label><select id="${fieldId(`resource-language-${key}`)}">${RESOURCE_LANGUAGES.map(language => `<option value="${language}">${RESOURCE_LANGUAGE_LABELS[language]}</option>`).join('')}</select></div>
              <div class="learning-form-field"><label for="${fieldId(`resource-date-${key}`)}">Data sprawdzenia</label><input type="date" id="${fieldId(`resource-date-${key}`)}" value="${localDateKey()}"></div>
              <button type="button" class="ghost" data-add-res="${key}">Dodaj materiał</button>
            </div>
          </fieldset>
        `).join('')}

        <fieldset class="learning-repeatable learning-form-wide">
          <legend>Instrukcja wykonania</legend>
          ${state.workOrder.map((s, i) => `
            <div class="learning-repeatable-row">
              <span>${i + 1}. ${escapeHtml(s.title)} — ${escapeHtml(s.description)}</span>
              <button type="button" class="mini-btn" data-remove-step="${i}">Usuń</button>
            </div>
          `).join('')}
          <div class="learning-repeatable-grid">
            <div class="learning-form-field"><label for="${fieldId('step-title')}">Tytuł kroku</label><input type="text" id="${fieldId('step-title')}"></div>
            <div class="learning-form-field"><label for="${fieldId('step-description')}">Opis kroku</label><input type="text" id="${fieldId('step-description')}"></div>
            <button type="button" class="ghost" id="${fieldId('step-add')}">Dodaj krok</button>
          </div>
        </fieldset>

        <fieldset class="learning-repeatable learning-form-wide">
          <legend>Ćwiczenie praktyczne</legend>
          ${state.exercises.map((e, i) => `
            <div class="learning-repeatable-row">
              <span>${escapeHtml(e.title)}${e.difficulty ? ` (${escapeHtml(LEARNING_DIFFICULTY_LABELS[e.difficulty] || `trudność ${e.difficulty}`)})` : ''} — ${escapeHtml(e.description)}</span>
              <button type="button" class="mini-btn" data-remove-ex="${i}">Usuń</button>
            </div>
          `).join('')}
          <div class="learning-repeatable-grid">
            <div class="learning-form-field"><label for="${fieldId('exercise-title')}">Tytuł ćwiczenia</label><input type="text" id="${fieldId('exercise-title')}"></div>
            <div class="learning-form-field"><label for="${fieldId('exercise-description')}">Opis ćwiczenia</label><input type="text" id="${fieldId('exercise-description')}"></div>
            <div class="learning-form-field"><label for="${fieldId('exercise-difficulty')}">Trudność (opcjonalnie)</label><select id="${fieldId('exercise-difficulty')}"><option value="">Bez oceny</option>${[1,2,3,4,5].map(value => `<option value="${value}">${LEARNING_DIFFICULTY_LABELS[value]}</option>`).join('')}</select></div>
            <button type="button" class="ghost" id="${fieldId('exercise-add')}">Dodaj ćwiczenie</button>
          </div>
        </fieldset>

        <fieldset class="learning-repeatable learning-form-wide">
          <legend>Mini-projekt (opcjonalnie)</legend>
          <div class="learning-repeatable-grid">
            <div class="learning-form-field"><label for="${fieldId('project-title')}">Tytuł</label><input type="text" id="${fieldId('project-title')}" value="${state.miniProject ? escapeAttr(state.miniProject.title) : ''}"></div>
            <div class="learning-form-field"><label for="${fieldId('project-description')}">Opis</label><input type="text" id="${fieldId('project-description')}" value="${state.miniProject ? escapeAttr(state.miniProject.description) : ''}"></div>
            <div class="learning-form-field learning-form-wide"><label for="${fieldId('project-acceptance')}">Kryteria akceptacji (oddziel przecinkami)</label><input type="text" id="${fieldId('project-acceptance')}" value="${state.miniProject ? escapeAttr(state.miniProject.acceptanceCriteria.join(', ')) : ''}"></div>
          </div>
        </fieldset>

        <fieldset class="learning-repeatable learning-form-wide">
          <legend>Pytania sprawdzające</legend>
          ${state.selfTest.map((q, i) => `
            <div class="learning-repeatable-row">
              <span>${escapeHtml(q.prompt)}${q.answer ? ' (odp: ' + escapeHtml(q.answer) + ')' : ''}</span>
              <button type="button" class="mini-btn" data-remove-q="${i}">Usuń</button>
            </div>
          `).join('')}
          <div class="learning-repeatable-grid">
            <div class="learning-form-field"><label for="${fieldId('question-prompt')}">Pytanie</label><input type="text" id="${fieldId('question-prompt')}"></div>
            <div class="learning-form-field"><label for="${fieldId('question-answer')}">Odpowiedź (opcjonalnie)</label><input type="text" id="${fieldId('question-answer')}"></div>
            <button type="button" class="ghost" id="${fieldId('question-add')}">Dodaj pytanie</button>
          </div>
        </fieldset>

        <div class="learning-form-field learning-form-wide">
          <label for="${fieldId('mistakes')}">Typowe błędy (jeden na linię)</label>
          <textarea id="${fieldId('mistakes')}" rows="3">${escapeHtml(state.commonMistakes.join('\n'))}</textarea>
        </div>
        <div class="learning-form-actions learning-form-wide">
          <button type="submit" class="primary" id="${fieldId('save')}">Zapisz przewodnik</button>
          <button type="button" class="ghost" id="${fieldId('cancel')}">Anuluj</button>
        </div>
        <div class="log-errors learning-form-wide" id="${errorsId}" role="alert" aria-live="polite" hidden></div>
      </form>
    `;

    field('why').addEventListener('input', event => { state.why = event.target.value; });
    field('skills').addEventListener('input', event => { state.skills = event.target.value.split(',').map(value => value.trim()).filter(Boolean); });
    field('prerequisites').addEventListener('input', event => { state.prerequisites = event.target.value.split(',').map(value => value.trim()).filter(Boolean); });
    field('mistakes').addEventListener('input', event => { state.commonMistakes = event.target.value.split('\n').map(value => value.trim()).filter(Boolean); });

    panelEl.querySelectorAll('[data-remove-res]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [key, idx] = btn.dataset.removeRes.split(':');
        state.resources[key].splice(Number(idx), 1);
        renderForm(`[data-add-res="${key}"]`);
      });
    });
    RESOURCE_GROUPS.forEach(([key]) => {
      const addBtn = panelEl.querySelector(`[data-add-res="${key}"]`);
      addBtn.addEventListener('click', () => {
        const title = field(`resource-title-${key}`).value.trim();
        const url = field(`resource-url-${key}`).value.trim();
        const sourceType = field(`resource-type-${key}`).value;
        const language = field(`resource-language-${key}`).value;
        const checkedDate = field(`resource-date-${key}`).value;
        const candidate = { id: genGuideId('res'), title, url, sourceType, language, checkedDate };
        const v = validateResource(candidate);
        const errEl = field('errors');
        if (!v.valid) { errEl.hidden = false; errEl.textContent = v.errors.join(' | '); return; }
        state.resources[key].push(candidate);
        renderForm(`[data-add-res="${key}"]`);
      });
    });

    panelEl.querySelectorAll('[data-remove-step]').forEach(btn => {
      btn.addEventListener('click', () => { state.workOrder.splice(Number(btn.dataset.removeStep), 1); renderForm(`#${fieldId('step-add')}`); });
    });
    field('step-add').addEventListener('click', () => {
      const title = field('step-title').value.trim();
      const description = field('step-description').value.trim();
      if (!title) return;
      state.workOrder.push({ id: genGuideId('step'), order: state.workOrder.length, title, description });
      renderForm(`#${fieldId('step-add')}`);
    });

    panelEl.querySelectorAll('[data-remove-ex]').forEach(btn => {
      btn.addEventListener('click', () => { state.exercises.splice(Number(btn.dataset.removeEx), 1); renderForm(`#${fieldId('exercise-add')}`); });
    });
    field('exercise-add').addEventListener('click', () => {
      const title = field('exercise-title').value.trim();
      const description = field('exercise-description').value.trim();
      const diffVal = field('exercise-difficulty').value;
      if (!title) return;
      const ex = { id: genGuideId('ex'), title, description };
      if (diffVal) ex.difficulty = Number(diffVal);
      state.exercises.push(ex);
      renderForm(`#${fieldId('exercise-add')}`);
    });

    panelEl.querySelectorAll('[data-remove-q]').forEach(btn => {
      btn.addEventListener('click', () => { state.selfTest.splice(Number(btn.dataset.removeQ), 1); renderForm(`#${fieldId('question-add')}`); });
    });
    field('question-add').addEventListener('click', () => {
      const prompt = field('question-prompt').value.trim();
      const answer = field('question-answer').value.trim();
      if (!prompt) return;
      const q = { id: genGuideId('q'), prompt };
      if (answer) q.answer = answer;
      state.selfTest.push(q);
      renderForm(`#${fieldId('question-add')}`);
    });

    field('project-title').addEventListener('input', e => {
      if (!state.miniProject) state.miniProject = { title: '', description: '', acceptanceCriteria: [] };
      state.miniProject.title = e.target.value;
    });
    field('project-description').addEventListener('input', e => {
      if (!state.miniProject) state.miniProject = { title: '', description: '', acceptanceCriteria: [] };
      state.miniProject.description = e.target.value;
    });
    field('project-acceptance').addEventListener('input', e => {
      if (!state.miniProject) state.miniProject = { title: '', description: '', acceptanceCriteria: [] };
      state.miniProject.acceptanceCriteria = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    });

    field('cancel').addEventListener('click', () => {
      renderGuidePanel(criterionId, panelEl);
      const advanced = panelEl.querySelector('.learning-guide-advanced');
      if (advanced) advanced.open = true;
      focusGuidePanelControl(panelEl);
    });
    panelEl.querySelector('.learning-guide-form').addEventListener('submit', event => {
      event.preventDefault();
      // Mini-projekt zapisujemy tylko, jeśli ma choć tytuł — pusty
      // formularz mini-projektu nie tworzy pustego obiektu w danych.
      const content = { ...state };
      if (!state.miniProject || !state.miniProject.title.trim()) content.miniProject = undefined;
      const result = saveLessonGuide(criterionId, content);
      const errEl = field('errors');
      if (!result.ok) { errEl.hidden = false; errEl.textContent = result.errors.join(' | '); return; }
      renderGuidePanel(criterionId, panelEl);
      const advanced = panelEl.querySelector('.learning-guide-advanced');
      if (advanced) advanced.open = true;
      focusGuidePanelControl(panelEl);
    });

    const focusTarget = focusSelector ? panelEl.querySelector(focusSelector) : field('why');
    focusTarget?.focus();
  }

  renderForm();
}

/* ============================================================
   MODUŁ / LearningModule (IT)
   ============================================================
   Zgodność z kontraktem Module: id, name, getTasks, getStats,
   render — wymagane; setTaskStatus — opcjonalne, obecne.
   Każde zadanie zwrócone przez getTasks(date) ma WSZYSTKIE pola
   wymagane w tym kroku: moduleId, goalId, stageId, title, why,
   estimatedMinutes, difficulty, xp, priority, status.

   NIEZALEŻNOŚĆ OD TRENINGU: ten moduł nigdy nie odwołuje się do
   TrainingModule, TRAINING_DAYS ani żadnej nazwy z tamtego pliku.
   Jedyna wspólna warstwa to Core (Store, EventBus, ModuleRegistry).
   ============================================================ */
const LearningModule = {
  id: 'it',
  name: 'Nauka IT',

  getTasks(date) {
    assertPlanningDate(date);
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
        priority: 40, // całkowita pozycja "Nauka IT" w hierarchii Task v2
        planningClass: 'flexible',
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
    if (!['todo', 'done', 'skipped'].includes(status)) return;
    const normalizedStatus = status === 'done' ? 'done' : 'todo';
    const current = RoadmapEngine.getCriteriaState()[taskId];
    const currentStatus = current?.status === 'done' ? 'done' : 'todo';
    if (currentStatus === normalizedStatus) return;
    RoadmapEngine.setCriterionStatus(taskId, normalizedStatus);
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
    const activeStage = RoadmapEngine.getActiveStage();
    const activeCriterion = activeStage
      ? activeStage.criteria.find(criterion => !RoadmapEngine.isCriterionDone(criterion.id)) || null
      : null;
    const currentGuide = activeCriterion ? getLessonGuide(activeCriterion.id) : null;
    const currentGuideContent = currentGuide ? normalizeLessonGuide(currentGuide, activeCriterion.id) : null;
    const currentResources = currentGuideContent
      ? ['documentation', 'articles', 'videos', 'additional']
          .flatMap(key => currentGuideContent.resources[key])
          .filter(resource => validateResource(resource).valid)
      : [];
    const primaryResource = currentResources[0] || null;

    const focusAfterRender = selector => {
      const target = container.querySelector(selector);
      target?.focus();
    };
    const stageCardFor = stageId => Array.from(container.querySelectorAll('[data-stage]'))
      .find(card => card.dataset.stage === stageId);
    const criterionCheckboxFor = criterionId => Array.from(container.querySelectorAll('[data-criterion-checkbox]'))
      .find(input => input.dataset.criterionCheckbox === criterionId);

    const currentMarkup = !activeStage
      ? `<section class="card learning-current-card learning-complete-state" aria-labelledby="learning-current-title">
          <p class="product-eyebrow">Teraz</p>
          <h2 id="learning-current-title" tabindex="-1">Roadmapa ukończona</h2>
          <p>Wszystkie etapy drogi do pierwszej pracy w IT są zamknięte.</p>
        </section>`
      : activeCriterion
        ? `<section class="card learning-current-card" aria-labelledby="learning-current-title">
            <p class="product-eyebrow">Bieżąca lekcja · etap ${activeStage.order}</p>
            <h2 id="learning-current-title" tabindex="-1">${escapeHtml(activeCriterion.title)}</h2>
            <div class="product-meta" aria-label="Plan lekcji">
              <span>${escapeHtml(activeStage.name)}</span>
              <span>${activeCriterion.estimatedMinutes} min</span>
              <span>${escapeHtml(LEARNING_DIFFICULTY_LABELS[activeCriterion.difficulty] || `Trudność ${activeCriterion.difficulty}`)}</span>
            </div>
            <section class="learning-current-purpose" aria-labelledby="learning-current-purpose-title">
              <h3 id="learning-current-purpose-title">Po co teraz</h3>
              <p>${escapeHtml(activeStage.why)}</p>
            </section>
            <div class="product-primary-action">
              ${primaryResource
                ? `<a class="primary primary-link" href="${escapeAttr(primaryResource.url)}" target="_blank" rel="noopener noreferrer">Otwórz materiał: ${escapeHtml(primaryResource.title)}</a>`
                : currentGuideContent && currentGuideContent.workOrder.length
                  ? '<button type="button" class="primary" id="learning-start-instruction">Zacznij od instrukcji</button>'
                  : '<button type="button" class="primary" id="learning-create-current-guide">Uzupełnij przewodnik</button>'}
            </div>
            <div class="guide-panel learning-current-guide" id="learning-current-guide-${escapeAttr(activeCriterion.id)}" data-guide-criterion="${escapeAttr(activeCriterion.id)}"></div>
            <section class="learning-completion" aria-labelledby="learning-completion-title">
              <h3 id="learning-completion-title">Kryterium ukończenia</h3>
              <p>Oznacz lekcję jako ukończoną dopiero, gdy potrafisz samodzielnie wykonać: <strong>${escapeHtml(activeCriterion.title)}</strong>.</p>
              <button type="button" class="ghost" id="learning-complete-current">Oznacz lekcję jako ukończoną</button>
            </section>
          </section>`
        : `<section class="card learning-current-card" aria-labelledby="learning-current-title">
            <p class="product-eyebrow">Bieżący etap · etap ${activeStage.order}</p>
            <h2 id="learning-current-title" tabindex="-1">${escapeHtml(activeStage.name)}</h2>
            <p>Wszystkie lekcje tego etapu są ukończone. Został ręczny test zaliczeniowy.</p>
            <section class="learning-completion" aria-labelledby="learning-stage-test-title">
              <h3 id="learning-stage-test-title">Test zaliczeniowy</h3>
              <p>${escapeHtml(activeStage.finalTest)}</p>
              <button type="button" class="primary" id="learning-complete-stage-current">Zamknij etap</button>
              <div class="log-errors" id="learning-stage-errors" role="alert" aria-live="polite" hidden></div>
            </section>
          </section>`;

    const roadmapMarkup = ROADMAP_STAGES.map(stage => {
      const status = statuses[stage.id];
      const progress = RoadmapEngine.getProgress(stage.id);
      const stateLabel = status === 'done' ? 'Ukończony' : status === 'active' ? 'Bieżący' : 'Zablokowany';
      const prereqNames = stage.prerequisites
        .map(id => RoadmapEngine.getStage(id)?.name)
        .filter(Boolean)
        .join(', ') || 'poprzedniego etapu';
      const body = status === 'locked'
        ? `<p class="learning-lock-note">Ten etap otworzy się po ukończeniu: <strong>${escapeHtml(prereqNames)}</strong>.</p>`
        : `<div class="stage-overview">
            <p>${escapeHtml(stage.description)}</p>
            <dl>
              <div><dt>Po co</dt><dd>${escapeHtml(stage.why)}</dd></div>
              <div><dt>Szacowany czas</dt><dd>${stage.estimatedHours} h</dd></div>
              <div><dt>Umiejętności</dt><dd>${stage.skillsGained.map(escapeHtml).join(' · ')}</dd></div>
              ${stage.projects.length ? `<div><dt>Projekty</dt><dd>${stage.projects.map(escapeHtml).join(' · ')}</dd></div>` : ''}
            </dl>
            <div class="learning-criteria-list">
              ${stage.criteria.map(criterion => {
                const done = RoadmapEngine.isCriterionDone(criterion.id);
                const isCurrent = activeCriterion?.id === criterion.id;
                return `<div class="learning-criterion ${done ? 'done' : ''}">
                    <div class="learning-criterion-row">
                      <input type="checkbox" class="cb" id="crit-${escapeAttr(criterion.id)}" data-criterion-checkbox="${escapeAttr(criterion.id)}" ${done ? 'checked' : ''} ${status !== 'active' ? 'disabled' : ''}>
                      <label for="crit-${escapeAttr(criterion.id)}">${escapeHtml(criterion.title)}</label>
                      <span class="learning-criterion-time">${criterion.estimatedMinutes} min</span>
                    </div>
                    ${isCurrent
                      ? `<button type="button" class="guide-toggle-btn ghost" data-crit="${escapeAttr(criterion.id)}" data-jump-current>Przejdź do bieżącej lekcji</button>`
                      : `<details class="learning-guide-disclosure">
                          <summary class="guide-toggle-btn" data-crit="${escapeAttr(criterion.id)}">Przewodnik lekcji</summary>
                          <div class="guide-panel" id="guide-panel-${escapeAttr(criterion.id)}" data-guide-criterion="${escapeAttr(criterion.id)}"></div>
                        </details>`}
                  </div>`;
              }).join('')}
            </div>
            <section class="learning-stage-test">
              <h4>Test zaliczeniowy etapu</h4>
              <p>${escapeHtml(stage.finalTest)}</p>
            </section>
          </div>`;
      return `<details class="stage-card ${escapeAttr(status)}" data-stage="${escapeAttr(stage.id)}" ${status === 'active' ? 'open' : ''}>
          <summary class="stage-head">
            <span class="stage-name">${stage.order}. ${escapeHtml(stage.name)}</span>
            <span class="badge ${status === 'done' ? 'ok' : status === 'active' ? 'warn' : ''}">${escapeHtml(stateLabel)} · ${progress}%</span>
          </summary>
          <div class="stage-body">${body}</div>
        </details>`;
    }).join('');

    container.innerHTML = `<div class="learning-product-layout">
      ${currentMarkup}
      <section class="card learning-roadmap-card" aria-labelledby="learning-roadmap-title">
        <div class="product-section-heading">
          <div>
            <p class="product-eyebrow">Pełna ścieżka</p>
            <h2 id="learning-roadmap-title">Roadmapa IT</h2>
          </div>
          <span class="badge ok">${overall.done}/${overall.total} etapów · ${overall.percent}%</span>
        </div>
        <div id="roadmap-tree">${roadmapMarkup}</div>
      </section>
    </div>`;

    container.querySelectorAll('[data-guide-criterion]').forEach(panel => {
      renderGuidePanel(panel.dataset.guideCriterion, panel);
    });

    container.querySelector('#learning-start-instruction')?.addEventListener('click', () => {
      container.querySelector('.learning-current-guide [data-guide-section="instruction"]')?.focus();
    });
    container.querySelector('#learning-create-current-guide')?.addEventListener('click', () => {
      const panel = container.querySelector('.learning-current-guide');
      if (panel && activeCriterion) renderGuideEditForm(activeCriterion.id, currentGuide, panel);
    });
    container.querySelectorAll('[data-jump-current]').forEach(button => {
      button.addEventListener('click', () => focusAfterRender('#learning-current-title'));
    });
    container.querySelectorAll('[data-criterion-checkbox]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const criterionId = checkbox.dataset.criterionCheckbox;
        const stage = ROADMAP_STAGES.find(candidate => candidate.criteria.some(criterion => criterion.id === criterionId));
        LearningModule.setTaskStatus(criterionId, checkbox.checked ? 'done' : 'todo');
        LearningModule.render(container);
        const card = stage ? stageCardFor(stage.id) : null;
        if (card) card.open = true;
        criterionCheckboxFor(criterionId)?.focus();
      });
    });
    container.querySelector('#learning-complete-current')?.addEventListener('click', () => {
      if (!activeCriterion) return;
      LearningModule.setTaskStatus(activeCriterion.id, 'done');
      LearningModule.render(container);
      focusAfterRender('#learning-current-title');
    });
    container.querySelector('#learning-complete-stage-current')?.addEventListener('click', () => {
      if (!activeStage) return;
      const result = RoadmapEngine.completeStage(activeStage.id);
      if (!result.ok) {
        const errorElement = container.querySelector('#learning-stage-errors');
        errorElement.hidden = false;
        errorElement.textContent = result.reason;
        return;
      }
      LearningModule.render(container);
      focusAfterRender('#learning-current-title');
    });
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

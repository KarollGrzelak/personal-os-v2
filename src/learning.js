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



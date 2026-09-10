/* ============================================================
   INICJALIZACJA UI
   ============================================================ */
const APP_VIEW_GROUPS = Object.freeze([
  Object.freeze({ label: 'Dzisiaj', views: Object.freeze([
    Object.freeze({ id: 'dzis', label: 'Dziś', context: 'Twój plan i działania na dzisiaj' })
  ]) }),
  Object.freeze({ label: 'Obszary', views: Object.freeze([
    Object.freeze({ id: 'it', label: 'Nauka IT', context: 'Rozwijaj umiejętności krok po kroku' }),
    Object.freeze({ id: 'school', label: 'Szkoła', context: 'Zadania, terminy i plan lekcji' }),
    Object.freeze({ id: 'training', label: 'Trening', context: 'Plan treningowy i postęp' }),
    Object.freeze({ id: 'english', label: 'Angielski', context: 'Bieżąca aktywność i kolejka' })
  ]) }),
  Object.freeze({ label: 'System', views: Object.freeze([
    Object.freeze({ id: 'settings', label: 'Ustawienia', context: 'Dostępność oraz bezpieczeństwo danych' })
  ]) })
]);
const APP_VIEWS = Object.freeze(APP_VIEW_GROUPS.flatMap(group => group.views));
const MOBILE_NAV_BREAKPOINT = 1024;
let focusHeadingAfterRoute = false;
let mobileMenuOpen = false;
let lastMobileNavigationMode = null;
let todayShellContext = APP_VIEW_GROUPS[0].views[0].context;

function getAppView(viewId) {
  return APP_VIEWS.find(view => view.id === viewId) || null;
}

function buildNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren();
  APP_VIEW_GROUPS.forEach(group => {
    const groupElement = document.createElement('div');
    groupElement.className = 'nav-group';
    const title = document.createElement('p');
    title.className = 'nav-group-title';
    title.textContent = group.label;
    groupElement.appendChild(title);

    group.views.forEach(view => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'navbtn';
      button.dataset.view = view.id;
      button.textContent = view.label;
      button.addEventListener('click', () => navigateFromUser(view.id));
      groupElement.appendChild(button);
    });
    nav.appendChild(groupElement);
  });
}

function isMobileNavigationMode() {
  return window.innerWidth < MOBILE_NAV_BREAKPOINT;
}

function getNavigationElements() {
  return {
    backdrop: document.getElementById('nav-backdrop'),
    closeButton: document.getElementById('menu-close'),
    menuButton: document.getElementById('menu-open'),
    panel: document.getElementById('app-nav-panel')
  };
}

function setMobileMenuOpen(nextOpen, { restoreFocus = false } = {}) {
  const { backdrop, closeButton, menuButton, panel } = getNavigationElements();
  if (!isMobileNavigationMode()) {
    mobileMenuOpen = false;
    panel.hidden = false;
    panel.removeAttribute('inert');
    panel.removeAttribute('aria-hidden');
    backdrop.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
    return;
  }

  mobileMenuOpen = nextOpen === true;
  panel.hidden = !mobileMenuOpen;
  panel.toggleAttribute('inert', !mobileMenuOpen);
  panel.setAttribute('aria-hidden', mobileMenuOpen ? 'false' : 'true');
  backdrop.hidden = !mobileMenuOpen;
  menuButton.setAttribute('aria-expanded', mobileMenuOpen ? 'true' : 'false');
  document.body.classList.toggle('nav-open', mobileMenuOpen);

  if (mobileMenuOpen) closeButton.focus();
  else if (restoreFocus) menuButton.focus();
}

function syncResponsiveNavigation() {
  const { menuButton, panel } = getNavigationElements();
  const mobileMode = isMobileNavigationMode();
  const activeElementWasInPanel = panel.contains(document.activeElement);

  if (mobileMode) {
    if (lastMobileNavigationMode !== true) {
      mobileMenuOpen = false;
      panel.hidden = true;
      panel.setAttribute('inert', '');
      panel.setAttribute('aria-hidden', 'true');
      document.getElementById('nav-backdrop').hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
      if (activeElementWasInPanel) menuButton.focus();
    }
  } else {
    mobileMenuOpen = false;
    panel.hidden = false;
    panel.removeAttribute('inert');
    panel.removeAttribute('aria-hidden');
    document.getElementById('nav-backdrop').hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }
  lastMobileNavigationMode = mobileMode;
}

function getDrawerFocusableElements() {
  const panel = document.getElementById('app-nav-panel');
  return [...panel.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden);
}

function handleDrawerKeydown(event) {
  if (!mobileMenuOpen || !isMobileNavigationMode()) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setMobileMenuOpen(false, { restoreFocus: true });
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = getDrawerFocusableElements();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const panel = document.getElementById('app-nav-panel');
  if (!panel.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function formatAppDate(date = new Date()) {
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric'
  });
}

function updateTodayShellContext(plan) {
  if (!plan || plan.ok !== true) todayShellContext = 'Plan wymaga uwagi';
  else if (plan.partial) todayShellContext = 'Plan częściowy';
  else if (Array.isArray(plan.selected) && plan.selected.length) {
    const title = typeof plan.selected[0].title === 'string' && plan.selected[0].title
      ? plan.selected[0].title
      : 'zadanie bez tytułu';
    todayShellContext = `Następne: ${title}`;
  } else if (Array.isArray(plan.completedToday) && plan.completedToday.length
      && (!Array.isArray(plan.deferred) || plan.deferred.length === 0)) {
    todayShellContext = 'Wszystko na dziś zrobione';
  } else if (Array.isArray(plan.deferred) && plan.deferred.length) {
    todayShellContext = 'Plan wymaga uwagi';
  } else todayShellContext = 'Brak otwartych zadań na dziś';

  if (Router.current() === 'dzis') document.getElementById('app-view-context').textContent = todayShellContext;
  return todayShellContext;
}

function updateShellForRoute(viewId) {
  const view = getAppView(viewId);
  if (!view) {
    focusHeadingAfterRoute = false;
    return;
  }

  const heading = document.getElementById('app-view-title');
  document.title = `${view.label} · Personal OS`;
  document.getElementById('app-date').textContent = formatAppDate();
  heading.textContent = view.label;
  document.getElementById('app-view-context').textContent = view.context;
  document.querySelectorAll('.navbtn').forEach(button => {
    if (button.dataset.view === viewId) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (focusHeadingAfterRoute) heading.focus();
  focusHeadingAfterRoute = false;
}

function navigateFromUser(viewId) {
  if (!getAppView(viewId)) return;
  if (mobileMenuOpen) setMobileMenuOpen(false);
  focusHeadingAfterRoute = true;
  Router.go(viewId);
  if (viewId === 'dzis') queueMicrotask(() => {
    if (Router.current() === 'dzis') document.getElementById('app-view-context').textContent = todayShellContext;
  });
}

function initProductShell() {
  const { backdrop, closeButton, menuButton } = getNavigationElements();
  const mainContent = document.getElementById('main-content');
  const skipLink = document.querySelector('.skip-link');
  skipLink.addEventListener('click', () => mainContent.focus());
  menuButton.addEventListener('click', () => setMobileMenuOpen(true));
  closeButton.addEventListener('click', () => setMobileMenuOpen(false, { restoreFocus: true }));
  backdrop.addEventListener('click', () => setMobileMenuOpen(false, { restoreFocus: true }));
  document.addEventListener('keydown', handleDrawerKeydown);
  window.addEventListener('resize', syncResponsiveNavigation);
  EventBus.on('route:change', updateShellForRoute);
  syncResponsiveNavigation();
}

/* ---------- UI: Ustawienia / Dane ---------- */

function renderSettingsView() {
  const container = document.getElementById('view-settings');
  if (!container) return;
  container.innerHTML = `
    <div id="availability-settings-card"></div>
    <div class="card">
      <h3>💾 Kopia zapasowa</h3>
      <p>Personal OS nie ma backendu — wszystkie dane żyją wyłącznie w tej przeglądarce. Eksportuj kopię, żeby zabezpieczyć się przed wyczyszczeniem danych albo zmianą urządzenia.</p>
      <p style="font-size:12px;color:var(--text3);">Plik zawiera Twoje prywatne dane Personal OS (postęp nauki, dane szkolne, zadeklarowaną dostępność, sesje treningowe) — przechowuj go tak ostrożnie jak inne prywatne pliki.</p>
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

  renderAvailabilitySettings();

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
        Przewodniki LessonGuide: ${preview.stats.lessonGuides}<br>
        Dostępność skonfigurowana: ${preview.stats.availabilityConfigured ? 'tak' : 'nie'}<br>
        Tygodniowe przedziały dostępności: ${preview.stats.availabilityWeeklyIntervals}<br>
        Wyjątki dostępności: ${preview.stats.availabilityExceptions}<br>
        Aktywności angielskie: ${preview.stats.englishActivities}<br>
        Ukończone aktywności angielskie: ${preview.stats.englishActivitiesDone}
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
  renderDzis();
  ModuleRegistry.all().forEach(mod => {
    const c = document.getElementById('view-' + mod.id);
    if (c) mod.render(c);
  });
}


(function init() {
  runMigrations(Store); // ZAWSZE pierwsze — zanim jakikolwiek moduł/silnik odczyta dane z Store
  buildNav();
  initProductShell();
  Router.go('dzis');
  renderDzis();
  renderSettingsView();
  EventBus.on('backup:importCompleted', refreshWholeAppUI); // jeden zbiorczy re-render po udanym Replace
  EventBus.on('backup:importCompleted', renderAvailabilitySettings); // tylko karta Availability; panel backupu zachowuje komunikat końcowy
  EventBus.on('availability:changed', renderAvailabilitySettings);
  EventBus.on('availability:changed', () => renderTodayTasks());
  EventBus.on('day:checkin', () => renderDzis());
  EventBus.on('task:status', () => renderTodayTasks());
  EventBus.on('tasks:changed', () => renderTodayTasks());

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

  TodayPlanLifecycle.start();
})();

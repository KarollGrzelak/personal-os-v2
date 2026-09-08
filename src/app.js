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
  Router.go('dzis');
})();

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApp, readStylesSource } from './helpers/load-app.mjs';

const EXPECTED_VIEWS = [
  { context: 'Twój plan i działania na dzisiaj', id: 'dzis', label: 'Dziś' },
  { context: 'Rozwijaj umiejętności krok po kroku', id: 'it', label: 'Nauka IT' },
  { context: 'Zadania, terminy i plan lekcji', id: 'school', label: 'Szkoła' },
  { context: 'Plan treningowy i postęp', id: 'training', label: 'Trening' },
  { context: 'Bieżąca aktywność i kolejka', id: 'english', label: 'Angielski' },
  { context: 'Dostępność oraz bezpieczeństwo danych', id: 'settings', label: 'Ustawienia' }
];

function setViewportWidth(app, width) {
  Object.defineProperty(app.window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true
  });
  app.window.dispatchEvent(new app.window.Event('resize'));
}

function click(app, element) {
  element.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function keydown(app, key, options = {}) {
  const event = new app.window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    ...options
  });
  app.document.dispatchEvent(event);
  return event;
}

test('shell ma produktową tożsamość, semantyczne landmarki i nie zawiera powierzchni deweloperskich', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.equal(app.document.title, 'Dziś · Personal OS');
  assert.equal(app.document.querySelector('.product-brand')?.textContent, 'Personal OS');
  assert.equal(app.document.querySelectorAll('header').length, 1);
  assert.equal(app.document.querySelectorAll('nav[aria-label="Główna nawigacja"]').length, 1);
  assert.equal(app.document.querySelectorAll('main#main-content').length, 1);
  assert.equal(app.document.getElementById('main-content')?.getAttribute('tabindex'), '-1');
  assert.equal(app.document.querySelector('.skip-link')?.getAttribute('href'), '#main-content');
  assert.equal(app.document.querySelector('.skip-link')?.textContent, 'Przejdź do treści');
  assert.equal(app.document.querySelectorAll('h1').length, 1);
  assert.equal(app.document.querySelector('h1')?.textContent, 'Dziś');
  assert.match(app.document.getElementById('app-date')?.textContent ?? '', /20 sierpnia 2026/i);

  const shellText = app.document.querySelector('.app-shell')?.textContent ?? '';
  assert.doesNotMatch(shellText, /Krok 8|Backup — eksport|Status fundamentu|Log zdarzeń EventBus|Kontrakt Module|Store aktywny|Router aktywny/);
  assert.equal(app.document.getElementById('view-status'), null);
  assert.equal(app.document.getElementById('view-docs'), null);
  assert.equal(app.document.getElementById('status-badges'), null);
  assert.equal(app.document.getElementById('event-log'), null);
});

test('skip link przenosi fokus do głównej treści bez efektów ubocznych', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const mainContent = app.document.getElementById('main-content');
  const skipLink = app.document.querySelector('.skip-link');
  const routeBefore = app.api.Router.current();
  const domainEvents = [];
  const routeEvents = [];
  app.api.EventBus.on('route:change', payload => routeEvents.push(payload));
  ['store:change', 'day:checkin', 'task:status', 'tasks:changed', 'availability:changed', 'backup:importCompleted']
    .forEach(eventName => app.api.EventBus.on(eventName, payload => domainEvents.push({ eventName, payload })));
  app.storageControl.reset();

  const activation = new app.window.MouseEvent('click', { bubbles: true, cancelable: true });
  skipLink.dispatchEvent(activation);

  assert.equal(activation.defaultPrevented, false);
  assert.equal(app.document.activeElement, mainContent);
  assert.equal(app.api.Router.current(), routeBefore);
  assert.deepEqual(routeEvents, []);
  assert.deepEqual(app.storageControl.attempts, []);
  assert.deepEqual(domainEvents, []);
});

test('nawigacja ma dokładne grupy, kolejność i jeden aktywny widok', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  const groups = [...app.document.getElementById('nav').children];
  assert.deepEqual(groups.map(group => group.querySelector('.nav-group-title')?.textContent), ['Dzisiaj', 'Obszary', 'System']);
  assert.deepEqual(groups.map(group => [...group.querySelectorAll('.navbtn')].map(button => button.textContent)), [
    ['Dziś'],
    ['Nauka IT', 'Szkoła', 'Trening', 'Angielski'],
    ['Ustawienia']
  ]);
  assert.deepEqual([...app.document.querySelectorAll('.navbtn')].map(button => button.dataset.view), EXPECTED_VIEWS.map(view => view.id));
  assert.deepEqual([...app.document.querySelectorAll('.navbtn[aria-current="page"]')].map(button => button.dataset.view), ['dzis']);
  assert.equal(app.document.querySelectorAll('.view.active').length, 1);
  assert.equal(app.document.querySelector('.view.active')?.id, 'view-dzis');
});

test('każda nawigacja użytkownika aktualizuje Router, tytuł, h1, kontekst, aria-current i fokus', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.notEqual(app.document.activeElement, app.document.getElementById('app-view-title'));
  for (const view of EXPECTED_VIEWS) {
    const button = app.document.querySelector(`.navbtn[data-view="${view.id}"]`);
    click(app, button);
    assert.equal(app.api.Router.current(), view.id);
    assert.equal(app.document.title, `${view.label} · Personal OS`);
    assert.equal(app.document.getElementById('app-view-title').textContent, view.label);
    assert.equal(app.document.getElementById('app-view-context').textContent, view.context);
    assert.equal(app.document.activeElement, app.document.getElementById('app-view-title'));
    assert.deepEqual([...app.document.querySelectorAll('.navbtn[aria-current="page"]')].map(item => item.dataset.view), [view.id]);
    assert.equal(app.document.querySelectorAll('.view.active').length, 1);
    assert.equal(app.document.querySelector('.view.active')?.id, `view-${view.id}`);
  }
});

test('inicjalizacja nie wymusza fokusu na h1', async t => {
  const app = await loadApp();
  t.after(() => app.close());

  assert.notEqual(app.document.activeElement, app.document.getElementById('app-view-title'));
  assert.equal(app.api.Router.current(), 'dzis');
});

test('mobilny drawer otwiera się i zamyka przyciskiem ze zwrotem fokusu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  setViewportWidth(app, 375);

  const panel = app.document.getElementById('app-nav-panel');
  const menuButton = app.document.getElementById('menu-open');
  const closeButton = app.document.getElementById('menu-close');
  assert.equal(panel.hidden, true);
  assert.equal(panel.hasAttribute('inert'), true);
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
  assert.equal(menuButton.getAttribute('aria-expanded'), 'false');
  assert.equal(menuButton.getAttribute('aria-controls'), 'app-nav-panel');

  click(app, menuButton);
  assert.equal(panel.hidden, false);
  assert.equal(panel.hasAttribute('inert'), false);
  assert.equal(panel.getAttribute('aria-hidden'), 'false');
  assert.equal(menuButton.getAttribute('aria-expanded'), 'true');
  assert.equal(app.document.body.classList.contains('nav-open'), true);
  assert.equal(app.document.activeElement, closeButton);

  click(app, closeButton);
  assert.equal(panel.hidden, true);
  assert.equal(panel.hasAttribute('inert'), true);
  assert.equal(menuButton.getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.body.classList.contains('nav-open'), false);
  assert.equal(app.document.activeElement, menuButton);
});

test('Escape i tło zamykają mobilny drawer oraz zwracają fokus do Menu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  setViewportWidth(app, 320);

  const menuButton = app.document.getElementById('menu-open');
  const panel = app.document.getElementById('app-nav-panel');
  const backdrop = app.document.getElementById('nav-backdrop');

  click(app, menuButton);
  const escapeEvent = keydown(app, 'Escape');
  assert.equal(escapeEvent.defaultPrevented, true);
  assert.equal(panel.hidden, true);
  assert.equal(app.document.activeElement, menuButton);

  click(app, menuButton);
  assert.equal(backdrop.hidden, false);
  click(app, backdrop);
  assert.equal(panel.hidden, true);
  assert.equal(backdrop.hidden, true);
  assert.equal(app.document.activeElement, menuButton);
});

test('wybór widoku w drawerze zamyka go i przenosi fokus do nowego h1', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  setViewportWidth(app, 768);

  click(app, app.document.getElementById('menu-open'));
  click(app, app.document.querySelector('.navbtn[data-view="school"]'));

  assert.equal(app.document.getElementById('app-nav-panel').hidden, true);
  assert.equal(app.document.body.classList.contains('nav-open'), false);
  assert.equal(app.api.Router.current(), 'school');
  assert.equal(app.document.getElementById('app-view-title').textContent, 'Szkoła');
  assert.equal(app.document.activeElement, app.document.getElementById('app-view-title'));
});

test('pułapka fokusu zawija Tab i Shift+Tab wewnątrz otwartego draweru', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  setViewportWidth(app, 375);
  click(app, app.document.getElementById('menu-open'));

  const first = app.document.getElementById('menu-close');
  const last = app.document.querySelector('.navbtn[data-view="settings"]');
  first.focus();
  const backwards = keydown(app, 'Tab', { shiftKey: true });
  assert.equal(backwards.defaultPrevented, true);
  assert.equal(app.document.activeElement, last);

  const forwards = keydown(app, 'Tab');
  assert.equal(forwards.defaultPrevented, true);
  assert.equal(app.document.activeElement, first);

  app.document.getElementById('menu-open').focus();
  const outside = keydown(app, 'Tab');
  assert.equal(outside.defaultPrevented, true);
  assert.equal(app.document.activeElement, first);
});

test('zmiana breakpointu usuwa blokadę, aria-hidden i ryzyko fokusu w ukrytym panelu', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const panel = app.document.getElementById('app-nav-panel');
  const menuButton = app.document.getElementById('menu-open');

  setViewportWidth(app, 375);
  click(app, menuButton);
  assert.equal(app.document.body.classList.contains('nav-open'), true);

  setViewportWidth(app, 1024);
  assert.equal(panel.hidden, false);
  assert.equal(panel.hasAttribute('aria-hidden'), false);
  assert.equal(panel.hasAttribute('inert'), false);
  assert.equal(app.document.body.classList.contains('nav-open'), false);
  assert.equal(menuButton.getAttribute('aria-expanded'), 'false');

  app.document.querySelector('.navbtn[data-view="it"]').focus();
  setViewportWidth(app, 768);
  assert.equal(panel.hidden, true);
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
  assert.equal(panel.hasAttribute('inert'), true);
  assert.equal(app.document.activeElement, menuButton);
});

test('nawigacja nie zapisuje Store, nie emituje zdarzeń domenowych i nie odpytuje źródeł Task', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const modules = app.api.ModuleRegistry.all();
  const moduleCount = modules.length;
  const originalGetTasks = new Map();
  let taskReads = 0;
  modules.forEach(module => {
    originalGetTasks.set(module, module.getTasks);
    module.getTasks = (...args) => {
      taskReads += 1;
      return originalGetTasks.get(module)(...args);
    };
  });
  t.after(() => originalGetTasks.forEach((getTasks, module) => { module.getTasks = getTasks; }));

  const domainEvents = [];
  ['store:change', 'day:checkin', 'task:status', 'tasks:changed', 'availability:changed', 'backup:importCompleted']
    .forEach(eventName => app.api.EventBus.on(eventName, payload => domainEvents.push({ eventName, payload })));
  const requestsBefore = [...app.resourceControl.requests];
  app.storageControl.reset();

  for (const view of EXPECTED_VIEWS) {
    click(app, app.document.querySelector(`.navbtn[data-view="${view.id}"]`));
  }

  assert.deepEqual(app.storageControl.attempts, []);
  assert.deepEqual(domainEvents, []);
  assert.equal(taskReads, 0);
  assert.equal(app.api.ModuleRegistry.all().length, moduleCount);
  assert.deepEqual(app.resourceControl.requests, requestsBefore);
  assert.deepEqual(app.resourceControl.blocked, []);
});

test('CSS shella zawiera breakpoint, bezpieczne obramowanie fokusu, safe-area i reduced motion bez sieci', async () => {
  const css = await readStylesSource();
  assert.match(css, /@media\s*\(max-width:1023\.98px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /env\(safe-area-inset-/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(css, /@import|https?:\/\/|url\s*\(/i);
});

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import { JSDOM, requestInterceptor, VirtualConsole } from 'jsdom';

process.env.TZ = 'Europe/Warsaw';

const FIXED_NOW = '2026-08-20T08:00:00.000Z';
const TEST_URL = 'https://personal-os.test/personal-os-v2/';
const EXPECTED_SCRIPT_SOURCES = ['./src/core.js', './src/today.js', './src/app.js'];
const EXPECTED_STYLESHEET_SOURCE = './src/styles.css';
const EXPECTED_CORE_SCRIPT_URL = new URL(EXPECTED_SCRIPT_SOURCES[0], TEST_URL).href;
const EXPECTED_TODAY_SCRIPT_URL = new URL(EXPECTED_SCRIPT_SOURCES[1], TEST_URL).href;
const EXPECTED_APP_SCRIPT_URL = new URL(EXPECTED_SCRIPT_SOURCES[2], TEST_URL).href;
const EXPECTED_STYLESHEET_URL = new URL(EXPECTED_STYLESHEET_SOURCE, TEST_URL).href;
const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SCRIPT_OPEN_PATTERN = /<script\b[^>]*>/gi;
const SCRIPT_CLOSE_PATTERN = /<\/script\s*>/gi;
const STYLE_OPEN_PATTERN = /<style\b[^>]*>/gi;
const STYLE_CLOSE_PATTERN = /<\/style\s*>/gi;
const LINK_PATTERN = /<link\b([^>]*)>/gi;
const TEST_BRIDGE = `
;globalThis.__PERSONAL_OS_TEST__ = Object.freeze({
  DATA_VERSION,
  EventBus,
  Store,
  createMemoryStore,
  MIGRATIONS,
  runMigrations,
  ModuleRegistry,
  Router,
  DayEngine,
  HabitEngine,
  PriorityEngine,
  DecisionEngine,
  RoadmapEngine,
  ROADMAP_STAGES,
  validateRoadmapDefinition,
  normalizeLessonGuide,
  isValidLessonGuide,
  isValidCalendarDateString,
  isValidTimeString,
  isValidResourceUrl,
  KNOWN_NAMESPACES,
  NAMESPACE_DEFAULTS,
  BACKUP_MAX_BYTES,
  BACKUP_MAX_DEPTH,
  BACKUP_FORMAT_ID,
  BACKUP_FORMAT_VERSION,
  exportBackup,
  downloadBackupFile,
  utf8ByteLength,
  parseAndValidateBackupFile,
  stageAndValidateBackup,
  commitStagedImport,
  importBackup,
  previewBackupFile,
  handleBackupFileSelected,
  renderImportError,
  renderImportCommitFailure
});
`;

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(helperDirectory, '..', '..');
const indexPath = path.join(projectRoot, 'index.html');
const corePath = path.join(projectRoot, 'src', 'core.js');
const todayPath = path.join(projectRoot, 'src', 'today.js');
const appPath = path.join(projectRoot, 'src', 'app.js');
const stylesPath = path.join(projectRoot, 'src', 'styles.css');

export function toPlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readAttribute(attributes, name) {
  const match = attributes.match(new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))", 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function hasAttribute(attributes, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`, 'i').test(attributes);
}

export function inspectIndexHtml(html) {
  const scripts = [...html.matchAll(SCRIPT_PATTERN)];
  const openingTags = html.match(SCRIPT_OPEN_PATTERN) ?? [];
  const closingTags = html.match(SCRIPT_CLOSE_PATTERN) ?? [];

  if (openingTags.length !== closingTags.length || scripts.length !== openingTags.length) {
    throw new Error(`Niejednoznaczna struktura skryptów: ${openingTags.length} otwarć, ${closingTags.length} zamknięć.`);
  }
  if (scripts.length !== EXPECTED_SCRIPT_SOURCES.length) {
    throw new Error(`Oczekiwano ${EXPECTED_SCRIPT_SOURCES.length} skryptów, znaleziono ${scripts.length}.`);
  }

  const scriptDetails = scripts.map((script, index) => {
    const attributes = script[1];
    const source = readAttribute(attributes, 'src');
    const type = (readAttribute(attributes, 'type') ?? '').trim().toLowerCase();
    const hasForbiddenScheduling = ['async', 'defer', 'nomodule'].some(name => hasAttribute(attributes, name));
    return {
      attributes,
      hasForbiddenScheduling,
      hasSource: source !== null,
      inlineCode: script[2],
      isClassic: source !== null
        && source === EXPECTED_SCRIPT_SOURCES[index]
        && script[2].trim() === ''
        && !hasForbiddenScheduling
        && ['', 'text/javascript', 'application/javascript'].includes(type),
      source,
      type
    };
  });
  const styleOpeningTags = html.match(STYLE_OPEN_PATTERN) ?? [];
  const styleClosingTags = html.match(STYLE_CLOSE_PATTERN) ?? [];
  const stylesheetLinks = [...html.matchAll(LINK_PATTERN)].filter(match => {
    const rel = (readAttribute(match[1], 'rel') ?? '').toLowerCase().split(/\s+/);
    return rel.includes('stylesheet');
  });
  const stylesheetSource = stylesheetLinks.length === 1
    ? readAttribute(stylesheetLinks[0][1], 'href')
    : null;
  const bodyOpenIndex = html.toLowerCase().indexOf('<body');
  const bodyCloseIndex = html.toLowerCase().lastIndexOf('</body>');
  const scriptsAreAdjacent = scripts.slice(0, -1).every((script, index) => {
    const scriptEndIndex = script.index + script[0].length;
    return html.slice(scriptEndIndex, scripts[index + 1].index).trim() === '';
  });
  const lastScript = scripts.at(-1);
  const lastScriptEndIndex = lastScript.index + lastScript[0].length;
  const scriptsAtBodyEnd = bodyOpenIndex >= 0
    && bodyCloseIndex >= 0
    && scripts.every(script => script.index >= bodyOpenIndex && script.index <= bodyCloseIndex)
    && html.slice(lastScriptEndIndex, bodyCloseIndex).trim() === '';

  return {
    html,
    isClassic: scriptDetails.every(script => script.isClassic),
    scriptCount: scripts.length,
    scriptDetails,
    scriptsAreAdjacent,
    scriptsAtBodyEnd,
    scriptSources: scriptDetails.map(script => script.source),
    styleBlockCount: Math.max(styleOpeningTags.length, styleClosingTags.length),
    stylesheetCount: stylesheetLinks.length,
    stylesheetSource
  };
}

export async function readIndexHtml() {
  return readFile(indexPath, 'utf8');
}

export async function readCoreSource() {
  return readFile(corePath, 'utf8');
}

export async function readTodaySource() {
  return readFile(todayPath, 'utf8');
}

export async function readAppSource() {
  return readFile(appPath, 'utf8');
}

export async function readStylesSource() {
  return readFile(stylesPath, 'utf8');
}

function createControlledResourceLoader(coreSource, todaySource, appSource, stylesSource, control) {
  return {
    interceptors: [
      requestInterceptor(request => {
        control.requests.push(request.url);
        if (request.url === EXPECTED_CORE_SCRIPT_URL) {
          return new Response(coreSource, {
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          });
        }
        if (request.url === EXPECTED_TODAY_SCRIPT_URL) {
          return new Response(todaySource, {
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          });
        }
        if (request.url === EXPECTED_APP_SCRIPT_URL) {
          return new Response(appSource + TEST_BRIDGE, {
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          });
        }
        if (request.url === EXPECTED_STYLESHEET_URL) {
          return new Response(stylesSource, {
            headers: { 'Content-Type': 'text/css; charset=utf-8' }
          });
        }
        control.blocked.push(request.url);
        throw new Error(`Zablokowano nieoczekiwane żądanie zasobu: ${request.url}`);
      })
    ]
  };
}

async function waitForWindowLoad(window, timeoutMs = 5000) {
  if (window.document.readyState === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Przekroczono limit ${timeoutMs} ms podczas ładowania zasobów aplikacji.`));
    }, timeoutMs);
    window.addEventListener('load', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export async function loadApp({
  fixedNow = FIXED_NOW,
  random = 0.3141592653589793,
  storage = {},
  unexpectedResourceUrl = null
} = {}) {
  const [html, coreSource, todaySource, appSource, stylesSource] = await Promise.all([
    readIndexHtml(),
    readCoreSource(),
    readTodaySource(),
    readAppSource(),
    readStylesSource()
  ]);
  const inspection = inspectIndexHtml(html);
  if (!inspection.isClassic || !inspection.scriptsAreAdjacent || !inspection.scriptsAtBodyEnd) {
    throw new Error('index.html nie zawiera oczekiwanych sąsiadujących klasycznych skryptów core.js → today.js → app.js na końcu body.');
  }
  if (inspection.styleBlockCount !== 0
      || inspection.stylesheetCount !== 1
      || inspection.stylesheetSource !== EXPECTED_STYLESHEET_SOURCE) {
    throw new Error('index.html nie zawiera jednego oczekiwanego zewnętrznego arkusza stylów.');
  }

  const errors = {
    console: [],
    jsdom: [],
    unhandledRejections: [],
    window: []
  };
  const dialogs = {
    alerts: [],
    confirms: [],
    prompts: []
  };
  const downloads = [];
  const anchorClicks = [];
  const fileReaderControl = {
    calls: [],
    outcomes: [],
    enqueueError(message = 'Synthetic FileReader error') {
      this.outcomes.push({ error: new Error(message), type: 'error' });
    },
    enqueueSuccess(result) {
      this.outcomes.push({ result: String(result), type: 'success' });
    },
    reset() {
      this.calls.length = 0;
      this.outcomes.length = 0;
    }
  };
  const storageControl = {
    attempts: [],
    failurePredicate: null,
    clearFailure() {
      this.failurePredicate = null;
    },
    failWhen(predicate) {
      this.failurePredicate = predicate;
    },
    reset() {
      this.attempts.length = 0;
      this.failurePredicate = null;
    }
  };
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.console.push(args));
  virtualConsole.on('jsdomError', error => errors.jsdom.push(error));
  const resourceControl = { blocked: [], requests: [] };
  const resourceLoader = createControlledResourceLoader(coreSource, todaySource, appSource, stylesSource, resourceControl);

  const fixedTimestamp = new Date(fixedNow).getTime();
  if (Number.isNaN(fixedTimestamp)) throw new Error(`Nieprawidłowy stały czas: ${fixedNow}`);
  let randomState = Math.floor(Number(random) * 0x100000000) >>> 0;
  if (!Number.isFinite(Number(random))) throw new Error(`Nieprawidłowe ziarno losowości: ${random}`);

  const dom = new JSDOM(html, {
    beforeParse(window) {
      const NativeDate = window.Date;
      class FixedDate extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [fixedTimestamp]));
        }
        static now() {
          return fixedTimestamp;
        }
      }
      window.Date = FixedDate;
      window.Math.random = () => {
        randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
        return randomState / 0x100000000;
      };
      if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
      if (typeof window.TextDecoder === 'undefined') window.TextDecoder = TextDecoder;

      const nativeSetItem = window.Storage.prototype.setItem;
      window.Storage.prototype.setItem = function controlledSetItem(key, value) {
        const attempt = {
          index: storageControl.attempts.length + 1,
          key: String(key),
          value: String(value)
        };
        storageControl.attempts.push(attempt);
        if (storageControl.failurePredicate?.(attempt)) {
          throw new window.DOMException(`Synthetic localStorage failure: ${attempt.key}`, 'QuotaExceededError');
        }
        return nativeSetItem.call(this, key, value);
      };

      window.FileReader = class ControlledFileReader {
        constructor() {
          this.error = null;
          this.onload = null;
          this.onerror = null;
          this.result = null;
        }
        readAsText(file) {
          const outcome = fileReaderControl.outcomes.shift() ?? { result: '', type: 'success' };
          fileReaderControl.calls.push({ file, outcome: outcome.type });
          window.queueMicrotask(() => {
            if (outcome.type === 'error') {
              this.error = outcome.error;
              this.onerror?.(new window.Event('error'));
              return;
            }
            this.result = outcome.result;
            this.onload?.(new window.Event('load'));
          });
        }
      };

      window.HTMLAnchorElement.prototype.click = function controlledAnchorClick() {
        anchorClicks.push({
          download: this.download,
          href: this.href,
          isConnected: this.isConnected
        });
      };

      window.alert = message => dialogs.alerts.push(String(message));
      window.confirm = message => {
        dialogs.confirms.push(String(message));
        return false;
      };
      window.prompt = (message, defaultValue = '') => {
        dialogs.prompts.push({ message: String(message), defaultValue: String(defaultValue) });
        return null;
      };

      window.URL.createObjectURL = blob => {
        const url = `blob:personal-os-test/${downloads.length + 1}`;
        downloads.push({ blob, revoked: false, url });
        return url;
      };
      window.URL.revokeObjectURL = url => {
        const download = downloads.find(item => item.url === url);
        if (download) download.revoked = true;
      };

      window.addEventListener('error', event => {
        errors.window.push(event.error ?? new Error(event.message));
      });
      window.addEventListener('unhandledrejection', event => {
        errors.unhandledRejections.push(event.reason);
      });

      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    },
    resources: resourceLoader,
    runScripts: 'dangerously',
    url: TEST_URL,
    virtualConsole
  });

  if (unexpectedResourceUrl !== null) {
    const frame = dom.window.document.createElement('iframe');
    frame.hidden = true;
    frame.src = String(unexpectedResourceUrl);
    dom.window.document.body.appendChild(frame);
  }

  try {
    await waitForWindowLoad(dom.window);
  } catch (error) {
    dom.window.close();
    throw error;
  }

  const api = dom.window.__PERSONAL_OS_TEST__;
  if (!api) {
    dom.window.close();
    const startupErrors = [...errors.window, ...errors.unhandledRejections, ...errors.jsdom];
    throw new AggregateError(startupErrors, 'Aplikacja nie uruchomiła adaptera testowego.');
  }
  storageControl.reset();

  return {
    anchorClicks,
    api,
    dialogs,
    document: dom.window.document,
    dom,
    downloads,
    errors,
    inspection,
    fileReaderControl,
    resourceControl,
    storageControl,
    window: dom.window,
    close() {
      dom.window.close();
    }
  };
}

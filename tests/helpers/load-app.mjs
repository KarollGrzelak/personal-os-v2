import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

process.env.TZ = 'Europe/Warsaw';

const FIXED_NOW = '2026-08-20T08:00:00.000Z';
const TEST_URL = 'https://personal-os.test/';
const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SCRIPT_OPEN_PATTERN = /<script\b[^>]*>/gi;
const SCRIPT_CLOSE_PATTERN = /<\/script\s*>/gi;
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
const indexPath = path.resolve(helperDirectory, '..', '..', 'index.html');

export function toPlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function inspectIndexHtml(html) {
  const scripts = [...html.matchAll(SCRIPT_PATTERN)];
  const openingTags = html.match(SCRIPT_OPEN_PATTERN) ?? [];
  const closingTags = html.match(SCRIPT_CLOSE_PATTERN) ?? [];

  if (openingTags.length !== closingTags.length || scripts.length !== openingTags.length) {
    throw new Error(`Niejednoznaczna struktura skryptów: ${openingTags.length} otwarć, ${closingTags.length} zamknięć.`);
  }
  if (scripts.length !== 1) {
    throw new Error(`Oczekiwano jednego skryptu, znaleziono ${scripts.length}.`);
  }

  const attributes = scripts[0][1];
  const hasSource = /\bsrc\s*=/i.test(attributes);
  const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').trim().toLowerCase();
  const isClassic = !hasSource && ['', 'text/javascript', 'application/javascript'].includes(type);

  return {
    attributes,
    hasSource,
    html,
    inlineCode: scripts[0][2],
    isClassic,
    scriptCount: scripts.length,
    scriptMatch: scripts[0]
  };
}

export async function readIndexHtml() {
  return readFile(indexPath, 'utf8');
}

function documentWithTestBridge(html, inspection) {
  const fullMatch = inspection.scriptMatch[0];
  const closingTagIndex = fullMatch.toLowerCase().lastIndexOf('</script');
  if (closingTagIndex < 0) throw new Error('Nie znaleziono zamknięcia skryptu inline.');
  const bridgedScript = fullMatch.slice(0, closingTagIndex) + TEST_BRIDGE + fullMatch.slice(closingTagIndex);
  const matchStart = inspection.scriptMatch.index;
  return html.slice(0, matchStart) + bridgedScript + html.slice(matchStart + fullMatch.length);
}

export async function loadApp({
  fixedNow = FIXED_NOW,
  random = 0.3141592653589793,
  storage = {}
} = {}) {
  const html = await readIndexHtml();
  const inspection = inspectIndexHtml(html);
  if (!inspection.isClassic) throw new Error('index.html nie zawiera jednego klasycznego skryptu inline.');

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

  const fixedTimestamp = new Date(fixedNow).getTime();
  if (Number.isNaN(fixedTimestamp)) throw new Error(`Nieprawidłowy stały czas: ${fixedNow}`);
  let randomState = Math.floor(Number(random) * 0x100000000) >>> 0;
  if (!Number.isFinite(Number(random))) throw new Error(`Nieprawidłowe ziarno losowości: ${random}`);

  const dom = new JSDOM(documentWithTestBridge(html, inspection), {
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
    runScripts: 'dangerously',
    url: TEST_URL,
    virtualConsole
  });

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
    storageControl,
    window: dom.window,
    close() {
      dom.window.close();
    }
  };
}

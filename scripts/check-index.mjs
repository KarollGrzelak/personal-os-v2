import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SCRIPT_OPEN_PATTERN = /<script\b[^>]*>/gi;
const SCRIPT_CLOSE_PATTERN = /<\/script\s*>/gi;
const STYLE_OPEN_PATTERN = /<style\b[^>]*>/gi;
const STYLE_CLOSE_PATTERN = /<\/style\s*>/gi;
const LINK_PATTERN = /<link\b([^>]*)>/gi;

const EXPECTED_SCRIPT_SOURCE = './src/app.js';
const EXPECTED_STYLESHEET_SOURCE = './src/styles.css';

function fail(message) {
  throw new Error(message);
}

function readAttribute(attributes, name) {
  const match = attributes.match(new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))", 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function hasAttribute(attributes, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`, 'i').test(attributes);
}

async function checkIndex() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, '..');
  const indexPath = path.join(projectRoot, 'index.html');
  const appPath = path.join(projectRoot, 'src', 'app.js');
  const stylesPath = path.join(projectRoot, 'src', 'styles.css');
  const [html, appSource, stylesSource] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(appPath, 'utf8'),
    readFile(stylesPath, 'utf8')
  ]);
  const scripts = [...html.matchAll(SCRIPT_PATTERN)];
  const openingTags = html.match(SCRIPT_OPEN_PATTERN) ?? [];
  const closingTags = html.match(SCRIPT_CLOSE_PATTERN) ?? [];

  if (openingTags.length !== closingTags.length || scripts.length !== openingTags.length) {
    fail(`nie można jednoznacznie odczytać skryptów (otwarcia: ${openingTags.length}, zamknięcia: ${closingTags.length})`);
  }
  if (scripts.length !== 1) {
    fail(`oczekiwano dokładnie jednego skryptu, znaleziono: ${scripts.length}`);
  }

  const attributes = scripts[0][1];
  const scriptSource = readAttribute(attributes, 'src');
  if (scriptSource !== EXPECTED_SCRIPT_SOURCE) {
    fail(`jedyny skrypt musi wskazywać dokładnie ${EXPECTED_SCRIPT_SOURCE}`);
  }
  if (scripts[0][2].trim() !== '') {
    fail('zewnętrzny skrypt nie może zawierać kodu inline');
  }
  for (const forbiddenAttribute of ['async', 'defer', 'nomodule']) {
    if (hasAttribute(attributes, forbiddenAttribute)) {
      fail(`klasyczny skrypt nie może mieć atrybutu ${forbiddenAttribute}`);
    }
  }

  const type = (readAttribute(attributes, 'type') ?? '').trim().toLowerCase();
  const classicTypes = new Set(['', 'text/javascript', 'application/javascript']);
  if (!classicTypes.has(type)) {
    fail(`jedyny skrypt nie jest skryptem klasycznym (type=${JSON.stringify(type)})`);
  }

  const bodyCloseIndex = html.toLowerCase().lastIndexOf('</body>');
  const scriptEndIndex = scripts[0].index + scripts[0][0].length;
  if (bodyCloseIndex < 0 || scripts[0].index > bodyCloseIndex || html.slice(scriptEndIndex, bodyCloseIndex).trim() !== '') {
    fail('skrypt musi być ostatnim elementem przed zamknięciem body');
  }

  const styleOpenings = html.match(STYLE_OPEN_PATTERN) ?? [];
  const styleClosings = html.match(STYLE_CLOSE_PATTERN) ?? [];
  if (styleOpenings.length !== 0 || styleClosings.length !== 0) {
    fail('CSS produkcyjny musi być zewnętrzny — bloki style są niedozwolone');
  }

  const stylesheetLinks = [...html.matchAll(LINK_PATTERN)].filter(match => {
    const rel = (readAttribute(match[1], 'rel') ?? '').toLowerCase().split(/\s+/);
    return rel.includes('stylesheet');
  });
  if (stylesheetLinks.length !== 1) {
    fail(`oczekiwano dokładnie jednego arkusza stylów, znaleziono: ${stylesheetLinks.length}`);
  }
  if (readAttribute(stylesheetLinks[0][1], 'href') !== EXPECTED_STYLESHEET_SOURCE) {
    fail(`arkusz stylów musi wskazywać dokładnie ${EXPECTED_STYLESHEET_SOURCE}`);
  }
  const headCloseIndex = html.toLowerCase().indexOf('</head>');
  if (headCloseIndex < 0 || stylesheetLinks[0].index > headCloseIndex) {
    fail('arkusz stylów musi znajdować się w head');
  }

  if (stylesSource.length === 0) fail('src/styles.css jest pusty');
  if (appSource.length === 0) fail('src/app.js jest pusty');

  try {
    new vm.Script(appSource, { filename: 'src/app.js' });
  } catch (error) {
    fail(`błąd składni src/app.js: ${error.message}`);
  }

  console.log('index.html OK: zewnętrzne src/styles.css i klasyczny src/app.js, ścieżki i składnia poprawne.');
}

try {
  await checkIndex();
} catch (error) {
  console.error(`check:index FAILED: ${error.message}`);
  process.exitCode = 1;
}

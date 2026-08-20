import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SCRIPT_OPEN_PATTERN = /<script\b[^>]*>/gi;
const SCRIPT_CLOSE_PATTERN = /<\/script\s*>/gi;

function fail(message) {
  throw new Error(message);
}

async function checkIndex() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const indexPath = path.resolve(scriptDirectory, '..', 'index.html');
  const html = await readFile(indexPath, 'utf8');
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
  if (/\bsrc\s*=/i.test(attributes)) {
    fail('jedyny skrypt musi być skryptem inline, bez atrybutu src');
  }

  const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').trim().toLowerCase();
  const classicTypes = new Set(['', 'text/javascript', 'application/javascript']);
  if (!classicTypes.has(type)) {
    fail(`jedyny skrypt nie jest skryptem klasycznym (type=${JSON.stringify(type)})`);
  }

  try {
    new vm.Script(scripts[0][2], { filename: 'index.html:inline-script' });
  } catch (error) {
    fail(`błąd składni skryptu inline: ${error.message}`);
  }

  console.log('index.html OK: 1 klasyczny skrypt inline, brak skryptów zewnętrznych, składnia poprawna.');
}

try {
  await checkIndex();
} catch (error) {
  console.error(`check:index FAILED: ${error.message}`);
  process.exitCode = 1;
}

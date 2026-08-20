import { readdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const testsDirectory = path.join(projectRoot, 'tests');
const sourceDirectory = path.join(projectRoot, 'src');
const indexPath = path.join(projectRoot, 'index.html');
const watchers = [];
let child = null;
let debounceTimer = null;
let restartRequested = false;
let shuttingDown = false;

async function discoverTests() {
  return (await readdir(testsDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map(entry => path.join('tests', entry.name))
    .sort();
}

async function startTests() {
  if (shuttingDown || child) return;
  restartRequested = false;
  const testFiles = await discoverTests();
  console.log(`[test:watch] uruchamiam ${testFiles.length} plików testowych`);
  child = spawn(process.execPath, [
    '--test',
    '--test-isolation=none',
    '--test-concurrency=1',
    ...testFiles
  ], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  child.once('exit', (code, signal) => {
    child = null;
    if (!shuttingDown) {
      console.log(`[test:watch] testy zakończone (${signal ? `sygnał ${signal}` : `kod ${code}`})`);
      if (restartRequested) void startTests();
    }
  });
}

function requestRestart(changedPath) {
  if (shuttingDown) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    restartRequested = true;
    console.log(`[test:watch] zmiana: ${changedPath}`);
    if (child) child.kill('SIGTERM');
    else void startTests();
  }, 100);
}

watchers.push(watch(testsDirectory, { recursive: true }, (_eventType, filename) => {
  requestRestart(filename ? path.join('tests', String(filename)) : 'tests');
}));
watchers.push(watch(sourceDirectory, { recursive: true }, (_eventType, filename) => {
  requestRestart(filename ? path.join('src', String(filename)) : 'src');
}));
watchers.push(watch(indexPath, () => requestRestart('index.html')));

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(debounceTimer);
  for (const watcher of watchers) watcher.close();
  const exitCode = signal === 'SIGINT' ? 130 : 143;
  if (!child) {
    process.exit(exitCode);
    return;
  }
  child.once('exit', () => process.exit(exitCode));
  child.kill(signal);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

void startTests();

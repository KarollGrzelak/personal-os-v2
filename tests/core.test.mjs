import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApp, toPlain } from './helpers/load-app.mjs';

test('EventBus przekazuje payload i respektuje funkcję odsubskrybowania', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const received = [];
  const unsubscribe = app.api.EventBus.on('test:event', payload => received.push(toPlain(payload)));

  app.api.EventBus.emit('test:event', { value: 1 });
  unsubscribe();
  app.api.EventBus.emit('test:event', { value: 2 });

  assert.deepEqual(received, [{ value: 1 }]);
});

test('Store używa prefiksu v2:, cache i emituje store:change', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const key = 'test:store-contract';
  const events = [];
  const unsubscribe = app.api.EventBus.on('store:change', event => events.push(toPlain(event)));

  assert.deepEqual(toPlain(app.api.Store.get(key, { source: 'fallback' })), { source: 'fallback' });
  app.window.localStorage.setItem(`v2:${key}`, JSON.stringify({ source: 'changed-outside-store' }));
  assert.deepEqual(toPlain(app.api.Store.get(key, null)), { source: 'fallback' });

  app.api.Store.set(key, { source: 'store' });
  unsubscribe();

  assert.equal(app.window.localStorage.getItem(key), null);
  assert.deepEqual(JSON.parse(app.window.localStorage.getItem(`v2:${key}`)), { source: 'store' });
  assert.deepEqual(events, [{ key, value: { source: 'store' } }]);
});

test('createMemoryStore izoluje instancje, odwzorowuje JSON i nie dotyka localStorage', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const first = app.api.createMemoryStore();
  const second = app.api.createMemoryStore();
  const key = 'test:memory-only';

  first.set(key, { kept: true, removed: undefined });

  assert.deepEqual(toPlain(first.get(key, null)), { kept: true });
  assert.deepEqual(toPlain(second.get(key, { isolated: true })), { isolated: true });
  assert.equal(app.window.localStorage.getItem(`v2:${key}`), null);
  assert.equal(app.window.localStorage.getItem(key), null);
});

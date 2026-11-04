import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/recover-cache.js', import.meta.url), 'utf8');
const removedCaches = [];
const unregistered = [];
const keptRegistration = {
  active: { scriptURL: 'http://localhost:8000/other-worker.js' },
  unregister: async () => { unregistered.push('other'); return true; }
};
const appRegistration = {
  active: { scriptURL: 'http://localhost:8000/sw.js' },
  unregister: async () => { unregistered.push('app'); return true; }
};
const cacheKeys = ['mercado-financas-v3-cache', 'mercado-financas-v4-cache', 'another-app-cache'];
const state = { textContent: '' };
let replacedUrl = '';

const cacheApi = {
  keys: async () => [...cacheKeys],
  delete: async key => { removedCaches.push(key); return true; }
};

const sandbox = {
  URL,
  console,
  document: { querySelector: selector => selector === '#state' ? state : null },
  navigator: {
    serviceWorker: {
      getRegistrations: async () => [keptRegistration, appRegistration]
    }
  },
  window: { caches: cacheApi },
  caches: cacheApi,
  location: {
    href: 'http://localhost:8000/atualizar-cache.html',
    replace: url => { replacedUrl = url; }
  },
  setTimeout: callback => callback()
};

vm.runInNewContext(source, sandbox);
await new Promise(resolve => setImmediate(resolve));

assert.deepEqual(unregistered, ['app'], 'Somente o Service Worker do Mercado & Finanças deve ser removido.');
assert.deepEqual(removedCaches.sort(), ['mercado-financas-v3-cache', 'mercado-financas-v4-cache']);
assert.ok(!removedCaches.includes('another-app-cache'), 'Caches de outros aplicativos devem permanecer intactos.');
assert.ok(replacedUrl.includes('/index.html?build=1.4.0'));
assert.match(state.textContent, /Cache antigo removido/);
console.log('OK: limpeza seletiva de caches e Service Worker, sem tocar no armazenamento local.');

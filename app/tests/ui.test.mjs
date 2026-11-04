import assert from 'node:assert/strict';
import { AppController } from '../src/controllers/app-controller.js';
import { LocalDatabase } from '../src/core/local-db.js';
import { createDefaultAppData, createDefaultCredentialData } from '../src/models/default-data.js';

class FakeElement {
  constructor(selector = '') {
    this.selector = selector;
    this.innerHTML = '';
    this.textContent = '';
    this.dataset = {};
    this.listeners = new Map();
    this.classList = {
      add() {}, remove() {}, toggle() {}, contains() { return false; }
    };
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  append() {}
  remove() {}
}

const localValues = new Map();
globalThis.localStorage = {
  getItem: key => localValues.has(key) ? localValues.get(key) : null,
  setItem: (key, value) => localValues.set(key, String(value)),
  removeItem: key => localValues.delete(key)
};

const selectors = [
  '#appShell', '#viewRoot', '#modalRoot', '#toastRoot', '#mobileMenu',
  '#topBalance', '#pageTitle', '#topEyebrow'
];
const elements = new Map(selectors.map(selector => [selector, new FakeElement(selector)]));
const previousDocument = globalThis.document;
globalThis.document = {
  querySelector: selector => elements.get(selector) || null,
  createElement: selector => new FakeElement(selector)
};

try {
  // Confirma que o estado padrão gera a Dashboard sem depender de interação posterior.
  const data = createDefaultAppData();
  const credentials = createDefaultCredentialData();
  const app = new AppController({ appData: data, credentials });
  assert.ok(elements.get('#viewRoot').innerHTML.includes('Seu dinheiro, em perspectiva.'));
  assert.ok(elements.get('#topBalance').textContent.includes('R$'));

  // Toda rota deve produzir conteúdo útil, não uma região vazia.
  const routes = ['dashboard', 'shopping', 'products', 'finance', 'calendar', 'reports', 'credentials', 'settings'];
  for (const route of routes) {
    app.navigate(route);
    const markup = elements.get('#viewRoot').innerHTML;
    assert.ok(markup.length > 100, `A tela ${route} não foi renderizada.`);
    assert.ok(!markup.includes('Não foi possível exibir esta seção'), `A tela ${route} apresentou erro de renderização.`);
  }

  // Um registro JSON corrompido deve gerar erro legível e nunca ser sobrescrito por padrão.
  const key = LocalDatabase.storageKeys().app;
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, '{json-invalido');
  await assert.rejects(() => LocalDatabase.initialize(), /registro local .* está inválido/i);
  assert.equal(localStorage.getItem(key), '{json-invalido');
  if (previous === null) localStorage.removeItem(key);
  else localStorage.setItem(key, previous);

  app.dispose();

  // A ausência do botão móvel é permitida e não pode impedir a aplicação de abrir.
  elements.delete('#mobileMenu');
  const appWithoutMobileMenu = new AppController({ appData: createDefaultAppData(), credentials: createDefaultCredentialData() });
  assert.ok(elements.get('#viewRoot').innerHTML.includes('Seu dinheiro, em perspectiva.'));
  await appWithoutMobileMenu.handleClick({ target: { nodeType: 1, closest: selector => selector === '#mobileMenu' ? {} : null } });
  appWithoutMobileMenu.dispose();

  console.log('OK: inicialização do controlador, Dashboard, 8 rotas, persistência, menu móvel opcional e proteção contra JSON local corrompido.');
} finally {
  globalThis.document = previousDocument;
}

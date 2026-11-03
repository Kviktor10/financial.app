import assert from 'node:assert/strict';
import { CryptoService } from '../src/security/crypto.js';
import { LocalDatabase } from '../src/core/local-db.js';
import { createDefaultAppData } from '../src/models/default-data.js';
import { FinanceService } from '../src/services/finance-service.js';
import { ShoppingService } from '../src/services/shopping-service.js';

// localStorage simulado para validar os serviços sem servidor ou dependências externas.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

assert.equal(CryptoService.validatePassword('curta'), 'Use pelo menos 12 caracteres na senha-mestra.');
assert.equal(CryptoService.validateMasterCode('123'), 'O código mestre precisa ter pelo menos 8 caracteres.');

const masterPassword = 'MinhaSenhaForte2026';
const masterCode = 'CodigoMestre-77';
const session = await LocalDatabase.create(masterPassword, masterCode);
const unlockedKeys = await CryptoService.unlock(masterPassword, session.auth);
assert.equal(await CryptoService.verifyMasterCode(masterCode, session.auth), true);
assert.equal(await CryptoService.verifyMasterCode('codigo-errado', session.auth), false);
await assert.rejects(() => CryptoService.unlock('senha-incorreta', session.auth));

const original = { name: 'dados de teste', amount: 145.65 };
const encrypted = await CryptoService.encryptAppData(unlockedKeys.appKey, original);
assert.deepEqual(await CryptoService.decryptAppData(unlockedKeys.appKey, encrypted), original);
assert.equal(JSON.stringify(encrypted).includes('dados de teste'), false);

const appData = createDefaultAppData();
const credentials = { entries: [{ id: 'credential-1', service: 'Conta teste', password: 'segredo de teste' }] };
let dataToPersist = appData;
const persist = () => LocalDatabase.saveApp(dataToPersist, unlockedKeys.appKey);
const finance = new FinanceService(dataToPersist, persist);
const shopping = new ShoppingService(dataToPersist, finance, persist);

await finance.addTransaction({ type: 'income', description: 'Entrada inicial', category: 'outros', amount: 1000, date: new Date().toISOString() });
await shopping.addProduct({ name: 'Arroz 5 kg', category: 'comida', price: 25.9, unit: 'pacote' });
const productId = dataToPersist.products[0].id;
await shopping.addToCart(productId, 2);
const initialBalance = finance.getBalance();
await shopping.saveList('Lista salva');
assert.equal(finance.getBalance(), initialBalance, 'Salvar lista não pode alterar saldo.');
await shopping.addToCart(productId, 1);
await shopping.finalizePurchase({ name: 'Compra sem vínculo', addToFinance: false });
assert.equal(finance.getBalance(), initialBalance, 'Compra sem vínculo não pode alterar saldo.');
await shopping.addToCart(productId, 1);
await shopping.finalizePurchase({ name: 'Compra vinculada', addToFinance: true });
assert.equal(finance.getBalance(), initialBalance - 25.9, 'Compra vinculada deve gerar uma saída.');

await LocalDatabase.saveCredentials(credentials, unlockedKeys.credentialKey);
const beforeClear = await LocalDatabase.load(unlockedKeys);
assert.equal(beforeClear.appData.purchases.length, 3);
assert.equal(beforeClear.appData.transactions.filter(item => item.source === 'purchase').length, 1);

// A limpeza operacional remove o catálogo e o financeiro, mas mantém o cofre independente.
LocalDatabase.clearOperationalData();
const afterClear = await LocalDatabase.load(unlockedKeys);
assert.equal(afterClear.appData.products.length, 0);
assert.equal(afterClear.appData.transactions.length, 0);
assert.equal(afterClear.credentials.entries[0].password, 'segredo de teste');

console.log('OK: criptografia, autenticação, carrinho, listas, fechamento, saldo e preservação do cofre.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CryptoService } from '../src/security/crypto.js';
import { LocalDatabase } from '../src/core/local-db.js';
import { createDefaultAppData } from '../src/models/default-data.js';
import { FinanceService } from '../src/services/finance-service.js';
import { ShoppingService } from '../src/services/shopping-service.js';
import { ProductImportService } from '../src/services/product-import-service.js';
import { PdfService } from '../src/services/pdf-service.js';
import { ReportService } from '../src/services/report-service.js';
import { renderDashboard, renderProducts, renderReports, renderSettings } from '../src/views/templates.js';

// localStorage simulado para validar persistência e migração sem servidor.
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const legacyPassword = 'Senha da versão anterior';
const legacyApp = createDefaultAppData();
legacyApp.products.push({ id: 'old-product', name: 'Produto legado', price: 9.5, category: 'comida', unit: 'un', updatedAt: new Date().toISOString() });
const legacyCredentials = { entries: [{ id: 'old-credential', service: 'Conta antiga', email: 'teste@exemplo.com', password: 'segredo legado', recoveryCode: '', totpSecret: '', notes: '' }] };
const oldAuth = await CryptoService.createAuth(legacyPassword);
const oldAppRecord = await CryptoService.encryptAppData(oldAuth.keys.appKey, legacyApp);
const oldCredentialsRecord = await CryptoService.encryptCredentials(oldAuth.keys.credentialKey, legacyCredentials);
const legacyKeys = LocalDatabase.legacyStorageKeys();
localStorage.setItem(legacyKeys.auth, JSON.stringify(oldAuth.auth));
localStorage.setItem(legacyKeys.app, JSON.stringify(oldAppRecord));
localStorage.setItem(legacyKeys.credentials, JSON.stringify(oldCredentialsRecord));

// O aplicativo inicializa sem solicitar senha e sinaliza a possibilidade de migração opcional.
const initialSession = await LocalDatabase.initialize();
assert.equal(initialSession.appData.products.length, 0);
assert.equal(initialSession.credentials.entries.length, 0);
assert.equal(initialSession.hasLegacyData, true);
assert.equal(LocalDatabase.hasLegacyData(), true);

await assert.rejects(
  () => LocalDatabase.importLegacy('senha incorreta'),
  /senha anterior não confere/i,
  'Uma tentativa incorreta não deve alterar os dados.'
);

const migrated = await LocalDatabase.importLegacy(legacyPassword);
assert.equal(migrated.appData.products[0].name, 'Produto legado');
assert.equal(migrated.credentials.entries[0].password, 'segredo legado');
assert.equal(LocalDatabase.hasLegacyData(), false);
assert.ok(localStorage.getItem(legacyKeys.app), 'Os registros antigos devem permanecer preservados.');

const appData = createDefaultAppData();
const credentials = { entries: [{ id: 'credential-1', service: 'Conta teste', password: 'segredo de teste' }] };
await LocalDatabase.saveApp(appData);
await LocalDatabase.saveCredentials(credentials);
const persist = () => LocalDatabase.saveApp(appData);
const finance = new FinanceService(appData, persist);
const shopping = new ShoppingService(appData, finance, persist);

await finance.addTransaction({ type: 'income', description: 'Entrada inicial', category: 'outros', amount: 1000, date: new Date().toISOString() });
await shopping.addProduct({ name: 'Arroz 5 kg', category: 'comida', price: 25.9, unit: 'pacote' });
const productId = appData.products[0].id;
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

const csvFile = {
  name: 'produtos.csv', type: 'text/csv',
  text: async () => 'nome;preco;categoria;unidade\r\nLeite integral;5,49;Comida;L\r\n"Sabão em pó";18.90;Limpeza;pacote\r\n'
};
const csvImport = await ProductImportService.parseFile(csvFile, appData.categories);
assert.equal(csvImport.products.length, 2);
assert.equal(csvImport.products[0].price, 5.49);
assert.equal(csvImport.products[1].category, 'limpeza');
const importSummary = await shopping.importProducts(csvImport.products);
assert.deepEqual(importSummary, { created: 2, updated: 0 });
const updateSummary = await shopping.importProducts([{ name: 'Leite integral', price: 6.25, category: 'comida', unit: 'L' }]);
assert.deepEqual(updateSummary, { created: 0, updated: 1 });
assert.equal(appData.products.find(item => item.name === 'Leite integral').price, 6.25);

const jsonFile = {
  name: 'produtos.json', type: 'application/json',
  text: async () => JSON.stringify({ products: [{ nome: 'Caderno', preco: 12.5, categoria: 'escolar', unidade: 'un' }] })
};
const jsonImport = await ProductImportService.parseFile(jsonFile, appData.categories);
assert.equal(jsonImport.products[0].name, 'Caderno');
const badCsv = { name: 'ruim.csv', type: 'text/csv', text: async () => 'nome;preco\nProduto sem preco;abc\n' };
const badRows = await ProductImportService.parseFile(badCsv, appData.categories).catch(error => error);
assert.ok(badRows instanceof Error, 'Importação sem nenhum produto válido deve ser recusada.');

// Backup novo exporta os dados locais, e restauração substitui app e cofre.
const backup = LocalDatabase.exportBackup();
assert.equal(backup.format, 'mercado-financas-local-backup-v2');
assert.equal(backup.appData.products.length, appData.products.length);
LocalDatabase.importBackup({ ...backup, appData: { ...backup.appData, products: [] } });
let restored = await LocalDatabase.initialize();
assert.equal(restored.appData.products.length, 0);
assert.equal(restored.credentials.entries[0].password, 'segredo de teste');

// A limpeza operacional preserva credenciais.
LocalDatabase.clearOperationalData();
restored = await LocalDatabase.initialize();
assert.equal(restored.appData.products.length, 0);
assert.equal(restored.appData.transactions.length, 0);
assert.equal(restored.credentials.entries[0].password, 'segredo de teste');

const dashboardMarkup = renderDashboard(appData, finance);
assert.ok(dashboardMarkup.includes('Seu dinheiro, em perspectiva.'), 'A Dashboard precisa renderizar com dados vazios.');

const productMarkup = renderProducts(appData);
assert.ok(productMarkup.includes('productImportFile'));
assert.ok(productMarkup.includes('download-products-template-csv'));
const reportMarkup = renderReports(appData, finance, 'month');
assert.ok(reportMarkup.includes('export-finance-pdf'));
const settingsMarkup = renderSettings(appData, true);
assert.ok(settingsMarkup.includes('migrate-legacy'));
assert.ok(settingsMarkup.includes('sem criptografia'));
assert.equal(settingsMarkup.includes('currentPassword'), false);
assert.equal(settingsMarkup.includes('change-password'), false);
assert.equal(settingsMarkup.includes('autoLockMinutes'), false);

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(html.includes('authScreen'), false, 'A tela de login não deve existir.');
assert.ok(html.includes('src/boot.js?v=1.4.0'), 'O HTML deve carregar o inicializador versionado.');
assert.ok(html.includes('styles.css?v=1.4.0'), 'A folha de estilos deve ignorar caches anteriores.');
assert.equal(html.includes('lockButton'), false, 'O controle de bloqueio deve ter sido removido.');
assert.equal(html.includes('quickLock'), false, 'O controle de bloqueio rápido deve ter sido removido.');

const reportService = new ReportService(appData, finance);
const csvExport = reportService.createFinanceCsv();
assert.equal(csvExport.mimeType, 'text/csv;charset=utf-8');
assert.ok(csvExport.content.includes('Descrição'));
const financePdfExport = reportService.createFinancePdf('month');
assert.equal(financePdfExport.content.type, 'application/pdf');
assert.ok((await financePdfExport.content.text()).startsWith('%PDF-1.4'));

const pdf = PdfService.createFinancialReport({
  periodLabel: 'Este mês', rangeLabel: '01/11/2026 até 03/11/2026',
  totals: { income: 100, expenses: 25, balance: 75 },
  transactions: [{ date: '03/11/2026 10:30', type: 'Saída', description: 'Compra de pão', category: 'Comida', amount: 25 }],
  categories: [{ name: 'Comida', amount: 25 }], purchases: [], money: value => `R$ ${Number(value).toFixed(2)}`
});
assert.equal(pdf.type, 'application/pdf');
assert.ok((await pdf.text()).startsWith('%PDF-1.4'));

const recoveryPage = await readFile(new URL('../atualizar-cache.html', import.meta.url), 'utf8');
assert.ok(recoveryPage.includes('src/recover-cache.js?v=1.4.0'));
const recoveryScript = await readFile(new URL('../src/recover-cache.js', import.meta.url), 'utf8');
assert.ok(recoveryScript.includes('mercado-financas-'));
console.log('OK: acesso direto, migração opcional, persistência local, carrinho, financeiro, CSV/JSON, backup, PDF e recuperação de cache.');

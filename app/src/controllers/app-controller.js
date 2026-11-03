import { APP_CONFIG, VIEW_META } from '../core/config.js';
import { LocalDatabase } from '../core/local-db.js';
import { CryptoService } from '../security/crypto.js';
import { FinanceService } from '../services/finance-service.js';
import { ShoppingService } from '../services/shopping-service.js';
import { createDefaultAppData } from '../models/default-data.js';
import { uid, money, dateTime, localDateKey, fromLocalDateTimeInput, downloadFile, csvCell, escapeHtml } from '../core/utils.js';
import {
  renderDashboard, renderShopping, renderProducts, renderFinance, renderCalendar, renderReports,
  renderCredentials, renderSettings, pageTitle, renderProductForm, renderCredentialForm,
  renderTransactionEditForm, renderFinalizeForm, renderMasterCodeForm, renderPurchaseReport
} from '../views/templates.js';

export class AppController {
  constructor(session, authController) {
    this.authController = authController;
    this.auth = session.auth || LocalDatabase.getAuth();
    this.keys = session.keys;
    this.data = session.appData;
    this.credentials = session.credentials;
    this.currentView = 'dashboard';
    this.calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.reportPeriod = 'month';
    this.pendingCredentialDelete = null;
    this.lastActivity = Date.now();
    this.finance = new FinanceService(this.data, () => this.persistApp());
    this.shopping = new ShoppingService(this.data, this.finance, () => this.persistApp());
    this.shell = document.querySelector('#appShell');
    this.viewRoot = document.querySelector('#viewRoot');
    this.modalRoot = document.querySelector('#modalRoot');
    this.toastRoot = document.querySelector('#toastRoot');
    this.bindEvents();
    this.show();
    this.render();
    this.startAutoLock();
  }

  bindEvents() {
    this.eventController = new AbortController();
    const options = { signal: this.eventController.signal };
    this.shell.addEventListener('click', event => this.handleClick(event), options);
    this.shell.addEventListener('submit', event => this.handleSubmit(event), options);
    this.shell.addEventListener('input', event => this.handleInput(event), options);
    this.shell.addEventListener('change', event => this.handleChange(event), options);
    this.modalRoot.addEventListener('click', event => this.handleClick(event), options);
    this.modalRoot.addEventListener('submit', event => this.handleSubmit(event), options);
    this.modalRoot.addEventListener('change', event => this.handleChange(event), options);
    document.querySelector('#lockButton').addEventListener('click', () => this.lock(), options);
    document.querySelector('#quickLock').addEventListener('click', () => this.lock(), options);
    document.querySelector('#mobileMenu').addEventListener('click', () => this.shell.classList.toggle('sidebar-open'), options);
    document.addEventListener('pointerdown', () => this.touchActivity(), { ...options, passive: true });
    document.addEventListener('keydown', () => this.touchActivity(), options);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.touchActivity();
    }, options);
  }

  dispose() {
    clearInterval(this.autoLockTimer);
    this.eventController?.abort();
  }

  show() {
    this.shell.classList.remove('hidden');
    document.querySelector('#authScreen').classList.add('hidden');
    this.updateBalanceHeader();
  }

  async persistApp() {
    await LocalDatabase.saveApp(this.data, this.keys.appKey);
    this.updateBalanceHeader();
  }

  async persistCredentials() {
    await LocalDatabase.saveCredentials(this.credentials, this.keys.credentialKey);
  }

  updateBalanceHeader() {
    const balance = this.finance.getBalance();
    const target = document.querySelector('#topBalance');
    if (target) target.textContent = money(balance);
  }

  render() {
    const meta = VIEW_META[this.currentView] || VIEW_META.dashboard;
    document.querySelector('#pageTitle').textContent = meta.title;
    document.querySelector('#topEyebrow').textContent = meta.eyebrow;
    this.shell.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === this.currentView));
    this.updateBalanceHeader();
    switch (this.currentView) {
      case 'shopping': this.viewRoot.innerHTML = renderShopping(this.data); break;
      case 'products': this.viewRoot.innerHTML = renderProducts(this.data); break;
      case 'finance': this.viewRoot.innerHTML = renderFinance(this.data, this.finance); break;
      case 'calendar': this.viewRoot.innerHTML = renderCalendar(this.data, this.calendarCursor); break;
      case 'reports': this.viewRoot.innerHTML = renderReports(this.data, this.finance, this.reportPeriod); break;
      case 'credentials': this.viewRoot.innerHTML = renderCredentials(this.credentials); break;
      case 'settings': this.viewRoot.innerHTML = renderSettings(this.data); break;
      default: this.viewRoot.innerHTML = renderDashboard(this.data, this.finance);
    }
  }

  navigate(view) {
    if (!VIEW_META[view]) return;
    this.currentView = view;
    this.shell.classList.remove('sidebar-open');
    this.modalRoot.innerHTML = '';
    this.render();
  }

  async handleClick(event) {
    if (event.target.classList?.contains('modal-backdrop')) {
      this.modalRoot.innerHTML = '';
      return;
    }
    const nav = event.target.closest('button[data-view]');
    if (nav) {
      this.navigate(nav.dataset.view);
      return;
    }
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    try {
      switch (action) {
        case 'close-modal': this.modalRoot.innerHTML = ''; break;
        case 'go-shopping': this.navigate('shopping'); break;
        case 'add-product': this.modalRoot.innerHTML = renderProductForm(); break;
        case 'add-to-cart': await this.shopping.addToCart(id); this.render(); this.toast('Produto adicionado ao carrinho.'); break;
        case 'remove-cart-item': await this.shopping.removeCartItem(id); this.render(); break;
        case 'clear-cart':
          if (confirm('Deseja remover todos os itens do carrinho atual?')) { this.data.activeCart = []; await this.persistApp(); this.render(); }
          break;
        case 'save-list': this.modalRoot.innerHTML = this.renderSaveListForm(); break;
        case 'finalize-purchase': this.modalRoot.innerHTML = renderFinalizeForm(this.shopping.getCartTotal()); break;
        case 'load-list': await this.shopping.loadSavedList(id); this.render(); this.toast('Lista carregada no carrinho.'); break;
        case 'delete-purchase': {
          const purchase = this.data.purchases.find(item => item.id === id);
          const message = purchase?.transactionId
            ? 'Esta compra também possui uma despesa no financeiro. Excluir a compra e estornar essa despesa?'
            : 'Deseja excluir este registro de compra/lista?';
          if (confirm(message)) { await this.shopping.deletePurchase(id, Boolean(purchase?.transactionId)); this.render(); this.toast('Registro excluído.'); }
          break;
        }
        case 'purchase-report': {
          const purchase = this.data.purchases.find(item => item.id === id);
          if (purchase) this.modalRoot.innerHTML = renderPurchaseReport(purchase);
          break;
        }
        case 'edit-product': {
          const product = this.data.products.find(item => item.id === id);
          if (product) this.modalRoot.innerHTML = renderProductForm(product);
          break;
        }
        case 'delete-product':
          if (confirm('Excluir este produto do catálogo? Os registros de compras anteriores serão preservados.')) { await this.shopping.deleteProduct(id); this.render(); this.toast('Produto excluído.'); }
          break;
        case 'edit-transaction': {
          const item = this.data.transactions.find(transaction => transaction.id === id);
          if (item) this.modalRoot.innerHTML = renderTransactionEditForm(item);
          break;
        }
        case 'delete-transaction':
          if (confirm('Excluir esta movimentação financeira? O saldo será recalculado.')) { await this.finance.deleteTransaction(id); this.render(); this.toast('Movimentação excluída.'); }
          break;
        case 'add-credential': this.modalRoot.innerHTML = renderCredentialForm(); break;
        case 'edit-credential': {
          const entry = this.credentials.entries.find(item => item.id === id);
          if (entry) this.modalRoot.innerHTML = renderCredentialForm(entry);
          break;
        }
        case 'delete-credential':
          this.pendingCredentialDelete = id;
          this.modalRoot.innerHTML = renderMasterCodeForm('Excluir credencial?', 'Esta ação removerá definitivamente a credencial selecionada do cofre.', 'confirm-delete-credential');
          break;
        case 'calendar-prev': this.calendarCursor.setMonth(this.calendarCursor.getMonth() - 1); this.render(); break;
        case 'calendar-next': this.calendarCursor.setMonth(this.calendarCursor.getMonth() + 1); this.render(); break;
        case 'calendar-today': this.calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); this.render(); break;
        case 'calendar-day': this.showDayDetails(button.dataset.date); break;
        case 'report-period': this.reportPeriod = button.dataset.period; this.render(); break;
        case 'export-finance-csv': this.exportFinanceCsv(); break;
        case 'export-backup': this.exportBackup(); break;
        case 'clear-operational-data': this.modalRoot.innerHTML = renderMasterCodeForm('Limpar dados operacionais?', 'Produtos, listas, compras, movimentações e preferências serão apagados. O cofre de credenciais será preservado.', 'confirm-clear-operational-data'); break;
        case 'print-purchase': window.print(); break;
        default: break;
      }
    } catch (error) {
      this.toast(error.message || 'Não foi possível concluir a operação.', 'error');
    }
  }

  renderSaveListForm() {
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card compact-modal" role="dialog" aria-modal="true"><div class="modal-header"><div><span class="eyebrow">SUPERMERCADO</span><h2>Salvar lista</h2></div><button class="icon-button" data-action="close-modal">×</button></div><p class="muted">A lista será armazenada no histórico de compras, mas não reduzirá seu saldo financeiro.</p><form class="form-grid" data-form="save-list"><label class="field full-field">Nome da lista<input name="name" maxlength="90" value="Lista de compras" required></label><div class="modal-actions full-field"><button type="button" class="button subtle" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">Salvar lista</button></div></form></section></div>`;
  }

  async handleSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const formType = form.dataset.form;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      switch (formType) {
        case 'product': {
          if (form.dataset.id) await this.shopping.updateProduct(form.dataset.id, values);
          else await this.shopping.addProduct(values);
          this.modalRoot.innerHTML = '';
          this.render();
          this.toast(form.dataset.id ? 'Produto atualizado.' : 'Produto cadastrado.');
          break;
        }
        case 'transaction':
          await this.finance.addTransaction({ ...values, amount: values.amount, date: fromLocalDateTimeInput(values.date) });
          form.reset();
          this.render();
          this.toast('Movimentação registrada e saldo atualizado.');
          break;
        case 'edit-transaction':
          await this.finance.updateTransaction(form.dataset.id, { ...values, date: fromLocalDateTimeInput(values.date) });
          this.modalRoot.innerHTML = '';
          this.render();
          this.toast('Movimentação atualizada.');
          break;
        case 'save-list': {
          const purchase = await this.shopping.saveList(values.name);
          this.modalRoot.innerHTML = '';
          this.render();
          this.toast(`Lista salva: ${purchase.name}. Saldo não alterado.`);
          break;
        }
        case 'finalize-purchase': {
          const purchase = await this.shopping.finalizePurchase({ name: values.name, addToFinance: formData.get('addToFinance') === 'on' });
          this.modalRoot.innerHTML = renderPurchaseReport(purchase);
          this.render();
          this.toast(purchase.addedToFinance ? 'Compra finalizada e lançada no financeiro.' : 'Compra finalizada sem alterar o saldo.');
          break;
        }
        case 'credential': {
          const existing = this.credentials.entries.find(item => item.id === form.dataset.id);
          const entry = {
            id: existing?.id || uid('cred'), service: values.service.trim(), email: values.email.trim(),
            password: values.password, recoveryCode: values.recoveryCode, totpSecret: values.totpSecret,
            notes: values.notes.trim(), createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
          };
          if (!entry.service) throw new Error('Informe a identificação do serviço.');
          if (existing) Object.assign(existing, entry);
          else this.credentials.entries.unshift(entry);
          await this.persistCredentials();
          this.modalRoot.innerHTML = '';
          this.render();
          this.toast('Credencial salva no cofre criptografado.');
          break;
        }
        case 'confirm-delete-credential': {
          const valid = await CryptoService.verifyMasterCode(String(values.masterCode || ''), this.auth);
          if (!valid) throw new Error('Código mestre incorreto.');
          this.credentials.entries = this.credentials.entries.filter(item => item.id !== this.pendingCredentialDelete);
          await this.persistCredentials();
          this.pendingCredentialDelete = null;
          this.modalRoot.innerHTML = '';
          this.render();
          this.toast('Credencial removida do cofre.');
          break;
        }
        case 'confirm-clear-operational-data': {
          const valid = await CryptoService.verifyMasterCode(String(values.masterCode || ''), this.auth);
          if (!valid) throw new Error('Código mestre incorreto.');
          const fresh = createDefaultAppData();
          await LocalDatabase.saveApp(fresh, this.keys.appKey);
          this.data = fresh;
          this.rebuildServices();
          this.modalRoot.innerHTML = '';
          this.navigate('dashboard');
          this.toast('Dados operacionais removidos. O cofre de credenciais foi preservado.');
          break;
        }
        case 'profile':
          this.data.settings.email = values.email.trim();
          this.data.settings.autoLockMinutes = Number(values.autoLockMinutes) || APP_CONFIG.autoLockMinutes;
          await this.persistApp();
          this.render();
          this.toast('Preferências salvas.');
          break;
        case 'change-master-code': {
          const currentCode = values.currentCode;
          const valid = await CryptoService.verifyMasterCode(currentCode, this.auth);
          if (!valid) throw new Error('Código mestre atual incorreto.');
          const error = CryptoService.validateMasterCode(values.newCode);
          if (error) throw new Error(error);
          if (values.newCode !== values.confirmCode) throw new Error('A confirmação do novo código não corresponde.');
          if (values.newCode === currentCode) throw new Error('Escolha um código mestre diferente do atual.');
          this.auth = await CryptoService.changeMasterCode(values.newCode, this.auth);
          LocalDatabase.saveAuth(this.auth);
          this.render();
          this.toast('Código mestre atualizado.');
          break;
        }
        case 'change-password': {
          const error = CryptoService.validatePassword(values.newPassword);
          if (error) throw new Error(error);
          if (values.newPassword !== values.confirmPassword) throw new Error('A confirmação da senha não corresponde.');
          const valid = await CryptoService.verifyMasterCode(values.masterCode, this.auth);
          if (!valid) throw new Error('Código mestre incorreto.');
          if (values.newPassword === values.masterCode) throw new Error('Senha-mestra e código mestre precisam ser diferentes.');
          const rekeyed = await CryptoService.rekey(values.newPassword, values.masterCode, this.data, this.credentials);
          await LocalDatabase.replaceAll({ auth: rekeyed.auth, appRecord: rekeyed.appRecord, credentialsRecord: rekeyed.credentialsRecord });
          this.auth = rekeyed.auth;
          this.keys = rekeyed.keys;
          this.render();
          this.toast('Senha-mestra alterada. Todos os dados foram recriptografados.');
          break;
        }
        default: break;
      }
    } catch (error) {
      this.toast(error.message || 'Erro ao salvar os dados.', 'error');
      if (submitButton) submitButton.disabled = false;
    }
  }

  handleInput(event) {
    if (event.target.id === 'shoppingSearch' || event.target.id === 'productSearch') {
      const id = event.target.id;
      const value = event.target.value;
      const selection = event.target.selectionStart;
      if (id === 'shoppingSearch') {
        const category = document.querySelector('#shoppingCategory')?.value || 'all';
        const filtered = this.filterProducts(value, category);
        const area = this.viewRoot.querySelector('#shoppingProducts');
        if (area) area.innerHTML = this.renderProductTiles(filtered);
      } else {
        const category = document.querySelector('#productCategory')?.value || 'all';
        const filtered = this.filterProducts(value, category);
        const body = this.viewRoot.querySelector('#productTableBody');
        if (body) body.innerHTML = this.renderProductTableRows(filtered);
      }
      event.target.setSelectionRange?.(selection, selection);
    }
  }

  handleChange(event) {
    const quantityInput = event.target.closest('[data-cart-quantity]');
    if (quantityInput) {
      const id = quantityInput.dataset.cartQuantity;
      this.shopping.setCartQuantity(id, quantityInput.value).then(() => this.render()).catch(error => this.toast(error.message, 'error'));
      return;
    }
    if (event.target.id === 'shoppingCategory' || event.target.id === 'productCategory') {
      const isShopping = event.target.id === 'shoppingCategory';
      const search = document.querySelector(isShopping ? '#shoppingSearch' : '#productSearch')?.value || '';
      const filtered = this.filterProducts(search, event.target.value);
      if (isShopping) {
        const area = this.viewRoot.querySelector('#shoppingProducts');
        if (area) area.innerHTML = this.renderProductTiles(filtered);
      } else {
        const body = this.viewRoot.querySelector('#productTableBody');
        if (body) body.innerHTML = this.renderProductTableRows(filtered);
      }
    }
    if (event.target.id === 'backupFile' && event.target.files?.[0]) this.importBackup(event.target.files[0]);
  }

  filterProducts(search, category) {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return this.data.products.filter(product => (category === 'all' || product.category === category) && product.name.toLocaleLowerCase('pt-BR').includes(query));
  }

  renderProductTiles(products) {
    if (!products.length) return '<div class="empty-inline">Nenhum produto corresponde ao filtro.</div>';
    return products.map(product => {
      const category = this.data.categories.find(item => item.id === product.category) || { name: 'Outros', icon: '📦', color: '#e7e9e5' };
      return `<article class="product-tile"><div class="product-tile-top"><span class="category-bubble" style="--bubble:${category.color}">${category.icon}</span><span class="product-category">${escapeHtml(category.name)}</span></div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.unit || 'un')}</small><div class="product-tile-bottom"><b>${money(product.price)}</b><button class="add-to-cart" data-action="add-to-cart" data-id="${product.id}" title="Adicionar ao carrinho">＋</button></div></article>`;
    }).join('');
  }

  renderProductTableRows(products) {
    if (!products.length) return '<tr><td colspan="6" class="table-empty">Nenhum produto corresponde ao filtro.</td></tr>';
    return products.map(product => {
      const cat = this.data.categories.find(item => item.id === product.category) || { name: 'Outros', icon: '📦' };
      return `<tr><td><div class="table-primary">${escapeHtml(product.name)}</div></td><td>${cat.icon} ${escapeHtml(cat.name)}</td><td><b>${money(product.price)}</b></td><td>${escapeHtml(product.unit || 'un')}</td><td>${new Date(product.updatedAt).toLocaleDateString('pt-BR')}</td><td><div class="table-actions"><button class="mini-action" data-action="edit-product" data-id="${product.id}">✎</button><button class="mini-action danger" data-action="delete-product" data-id="${product.id}">×</button></div></td></tr>`;
    }).join('');
  }

  async showDayDetails(dateKey) {
    const transactions = this.data.transactions.filter(item => localDateKey(new Date(item.date)) === dateKey);
    const title = new Date(`${dateKey}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'full' });
    const total = transactions.filter(item => item.type === 'expense').reduce((acc, item) => acc + item.amount, 0);
    this.modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><div><span class="eyebrow">CALENDÁRIO</span><h2>${escapeHtml(title)}</h2></div><button class="icon-button" data-action="close-modal">×</button></div><div class="day-total"><span>Despesas do dia</span><strong>${money(total)}</strong></div>${transactions.length ? `<div class="day-list">${transactions.map(item => `<div><span>${item.type === 'income' ? '↗' : '↘'} ${escapeHtml(item.description)}</span><b class="${item.type === 'income' ? 'income-text' : 'expense-text'}">${item.type === 'income' ? '+' : '−'} ${money(item.amount)}</b></div>`).join('')}</div>` : '<p class="muted">Nenhuma movimentação registrada neste dia.</p>'}<div class="modal-actions"><button class="button primary" data-action="close-modal">Fechar</button></div></section></div>`;
  }

  exportFinanceCsv() {
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Origem']];
    for (const item of this.data.transactions) {
      const category = this.data.categories.find(cat => cat.id === item.category)?.name || 'Outros';
      rows.push([dateTime(item.date), item.type === 'income' ? 'Entrada' : 'Saída', item.description, category, item.amount.toFixed(2).replace('.', ','), item.source === 'purchase' ? 'Compra de supermercado' : 'Manual']);
    }
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    downloadFile(`movimentacoes-${localDateKey()}.csv`, csv, 'text/csv;charset=utf-8');
    this.toast('Relatório CSV exportado.');
  }

  exportBackup() {
    const backup = LocalDatabase.exportEncryptedBackup();
    downloadFile(`backup-mercado-financas-${localDateKey()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
    this.toast('Backup criptografado exportado.');
  }

  async importBackup(file) {
    try {
      if (!confirm('Importar este backup substituirá os dados atuais deste navegador. Deseja continuar?')) return;
      const backup = JSON.parse(await file.text());
      LocalDatabase.importEncryptedBackup(backup);
      this.toast('Backup importado. O aplicativo será bloqueado para validar a senha original.');
      setTimeout(() => this.lock(), 500);
    } catch (error) {
      this.toast(error.message || 'Não foi possível importar o backup.', 'error');
    } finally {
      const input = document.querySelector('#backupFile');
      if (input) input.value = '';
    }
  }

  rebuildServices() {
    this.finance = new FinanceService(this.data, () => this.persistApp());
    this.shopping = new ShoppingService(this.data, this.finance, () => this.persistApp());
    this.updateBalanceHeader();
  }

  startAutoLock() {
    this.autoLockTimer = window.setInterval(() => {
      const minutes = Number(this.data.settings.autoLockMinutes) || APP_CONFIG.autoLockMinutes;
      if (Date.now() - this.lastActivity > minutes * 60_000) this.lock();
    }, 15_000);
  }

  touchActivity() { this.lastActivity = Date.now(); }

  lock() {
    if (!this.keys) return;
    clearInterval(this.autoLockTimer);
    this.keys = null;
    this.data = null;
    this.credentials = null;
    this.finance = null;
    this.shopping = null;
    this.shell.classList.add('hidden');
    document.querySelector('#authScreen').classList.remove('hidden');
    this.modalRoot.innerHTML = '';
    this.authController.initialize();
    this.toast('Aplicativo bloqueado.');
  }

  toast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.toastRoot.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }
}

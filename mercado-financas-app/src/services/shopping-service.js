import { uid, sum } from '../core/utils.js';

export class ShoppingService {
  constructor(data, financeService, persist) {
    this.data = data;
    this.finance = financeService;
    this.persist = persist;
  }

  async addProduct({ name, category, price, unit = 'un' }) {
    const value = Number(price);
    if (!name?.trim() || !Number.isFinite(value) || value < 0) throw new Error('Informe o nome e um preço válido.');
    const product = {
      id: uid('prod'), name: name.trim(), category: category || 'outros',
      price: Math.round(value * 100) / 100, unit: unit.trim() || 'un',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    this.data.products.unshift(product);
    await this.persist();
    return product;
  }

  async updateProduct(id, changes) {
    const product = this.data.products.find(item => item.id === id);
    if (!product) throw new Error('Produto não encontrado.');
    const price = Number(changes.price);
    if (!changes.name?.trim() || !Number.isFinite(price) || price < 0) throw new Error('Nome e preço válido são obrigatórios.');
    Object.assign(product, { name: changes.name.trim(), category: changes.category || 'outros', price: Math.round(price * 100) / 100, unit: changes.unit || 'un', updatedAt: new Date().toISOString() });
    await this.persist();
  }

  async deleteProduct(id) {
    this.data.products = this.data.products.filter(item => item.id !== id);
    await this.persist();
  }

  async addToCart(productId, quantity = 1) {
    const product = this.data.products.find(item => item.id === productId);
    if (!product) throw new Error('Produto não encontrado.');
    const qty = Math.max(1, Number(quantity) || 1);
    const existing = this.data.activeCart.find(item => item.productId === productId);
    if (existing) existing.quantity += qty;
    else this.data.activeCart.push({
      id: uid('item'), productId: product.id, name: product.name, category: product.category,
      unitPrice: product.price, unit: product.unit, quantity: qty
    });
    await this.persist();
  }

  async setCartQuantity(itemId, quantity) {
    const item = this.data.activeCart.find(entry => entry.id === itemId);
    if (!item) return;
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) this.data.activeCart = this.data.activeCart.filter(entry => entry.id !== itemId);
    else item.quantity = Math.min(9999, Math.round(value * 1000) / 1000);
    await this.persist();
  }

  async removeCartItem(itemId) {
    this.data.activeCart = this.data.activeCart.filter(item => item.id !== itemId);
    await this.persist();
  }

  getCartTotal() {
    return sum(this.data.activeCart, item => item.unitPrice * item.quantity);
  }

  async saveList(name = 'Lista de compras') {
    if (!this.data.activeCart.length) throw new Error('Adicione pelo menos um produto ao carrinho.');
    const purchase = this.createPurchase(name, 'saved');
    this.data.purchases.unshift(purchase);
    this.data.activeCart = [];
    await this.persist();
    return purchase;
  }

  async finalizePurchase({ name = 'Compra de supermercado', addToFinance = false }) {
    if (!this.data.activeCart.length) throw new Error('O carrinho está vazio.');
    const purchase = this.createPurchase(name, 'completed');
    purchase.finalizedAt = new Date().toISOString();
    purchase.addedToFinance = Boolean(addToFinance);
    this.data.purchases.unshift(purchase);
    this.data.activeCart = [];
    if (addToFinance) {
      const transaction = await this.finance.addTransaction({
        type: 'expense', description: `Compra: ${purchase.name}`, category: 'supermercado',
        amount: purchase.total, date: purchase.finalizedAt, notes: `${purchase.items.length} item(ns)`,
        source: 'purchase', sourceId: purchase.id
      });
      purchase.transactionId = transaction.id;
    }
    await this.persist();
    return purchase;
  }

  createPurchase(name, status) {
    const items = this.data.activeCart.map(item => ({ ...item, subtotal: Math.round(item.unitPrice * item.quantity * 100) / 100 }));
    return {
      id: uid('compra'), name: name.trim() || 'Compra de supermercado', status,
      items, total: Math.round(sum(items, item => item.subtotal) * 100) / 100,
      createdAt: new Date().toISOString(), finalizedAt: null, addedToFinance: false, transactionId: null
    };
  }

  async loadSavedList(purchaseId) {
    const purchase = this.data.purchases.find(item => item.id === purchaseId && item.status === 'saved');
    if (!purchase) throw new Error('Lista salva não encontrada.');
    this.data.activeCart = purchase.items.map(item => ({ ...item, id: uid('item') }));
    await this.persist();
  }

  async deletePurchase(purchaseId, reverseFinance = false) {
    const purchase = this.data.purchases.find(item => item.id === purchaseId);
    if (!purchase) return;
    if (purchase.transactionId && !reverseFinance) throw new Error('Esta compra foi lançada no financeiro. Confirme o estorno antes de excluir.');
    if (purchase.transactionId && reverseFinance) {
      this.data.transactions = this.data.transactions.filter(item => item.id !== purchase.transactionId);
    }
    this.data.purchases = this.data.purchases.filter(item => item.id !== purchaseId);
    await this.persist();
  }
}

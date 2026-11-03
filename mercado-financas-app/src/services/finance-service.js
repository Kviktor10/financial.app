import { uid, localDateKey, startOfWeek, endOfDay, dateInRange, sum } from '../core/utils.js';

export class FinanceService {
  constructor(data, persist) {
    this.data = data;
    this.persist = persist;
  }

  getBalance() {
    return sum(this.data.transactions, transaction => transaction.type === 'income' ? transaction.amount : -transaction.amount);
  }

  getTotals(start, end) {
    const transactions = this.data.transactions.filter(item => dateInRange(item.date, start, end));
    const income = sum(transactions.filter(item => item.type === 'income'));
    const expenses = sum(transactions.filter(item => item.type === 'expense'));
    return { income, expenses, balance: income - expenses, transactions };
  }

  getTodayTotals() {
    const today = new Date();
    return this.getTotals(new Date(today.getFullYear(), today.getMonth(), today.getDate()), endOfDay(today));
  }

  getWeekTotals() {
    const today = new Date();
    return this.getTotals(startOfWeek(today), endOfDay(today));
  }

  getMonthTotals(date = new Date()) {
    return this.getTotals(new Date(date.getFullYear(), date.getMonth(), 1), endOfDay(date));
  }

  getYearTotals(date = new Date()) {
    return this.getTotals(new Date(date.getFullYear(), 0, 1), endOfDay(date));
  }

  async addTransaction({ type, description, category, amount, date, notes = '', source = 'manual', sourceId = null }) {
    const value = Number(amount);
    if (!['income', 'expense'].includes(type) || !description?.trim() || !Number.isFinite(value) || value <= 0) {
      throw new Error('Informe descrição e valor maior que zero.');
    }
    const transaction = {
      id: uid('mov'), type, description: description.trim(), category: category || 'outros',
      amount: Math.round(value * 100) / 100, date: date || new Date().toISOString(),
      notes: notes.trim(), source, sourceId, createdAt: new Date().toISOString()
    };
    this.data.transactions.unshift(transaction);
    await this.persist();
    return transaction;
  }

  async updateTransaction(id, changes) {
    const item = this.data.transactions.find(transaction => transaction.id === id);
    if (!item) throw new Error('Movimentação não encontrada.');
    if (item.source === 'purchase') throw new Error('Edite ou estorne a compra na área de supermercado.');
    const amount = Number(changes.amount);
    if (!changes.description?.trim() || !Number.isFinite(amount) || amount <= 0) throw new Error('Descrição e valor válido são obrigatórios.');
    Object.assign(item, {
      description: changes.description.trim(), category: changes.category || item.category,
      amount: Math.round(amount * 100) / 100, date: changes.date || item.date, notes: (changes.notes || '').trim(), updatedAt: new Date().toISOString()
    });
    await this.persist();
  }

  async deleteTransaction(id) {
    const item = this.data.transactions.find(transaction => transaction.id === id);
    if (!item) return;
    if (item.source === 'purchase') throw new Error('Esta movimentação pertence a uma compra. Use o estorno na área de supermercado.');
    this.data.transactions = this.data.transactions.filter(transaction => transaction.id !== id);
    await this.persist();
  }

  getCategoryExpenses(transactions = this.data.transactions) {
    const totals = new Map();
    for (const item of transactions.filter(transaction => transaction.type === 'expense')) {
      totals.set(item.category || 'outros', (totals.get(item.category || 'outros') || 0) + item.amount);
    }
    return [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }

  getDailyExpenses(days = 7) {
    const result = [];
    const today = new Date();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const key = localDateKey(date);
      const amount = sum(this.data.transactions.filter(item => item.type === 'expense' && localDateKey(new Date(item.date)) === key));
      result.push({ label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', ''), amount, key });
    }
    return result;
  }
}

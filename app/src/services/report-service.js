import { PdfService } from './pdf-service.js?v=1.4.0';
import { csvCell, dateTime, localDateKey, money } from '../core/utils.js?v=1.4.0';

/** Centraliza a composição de relatórios; a interface apenas inicia o download. */
export class ReportService {
  constructor(data, finance) {
    this.data = data;
    this.finance = finance;
  }

  getRange(period = 'month', reference = new Date()) {
    const now = new Date(reference);
    let start;
    let label;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        label = 'Hoje';
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        start.setHours(0, 0, 0, 0);
        label = 'Esta semana';
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        label = 'Este ano';
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        label = 'Este mês';
    }

    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end, label };
  }

  createFinanceCsv() {
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Origem']];
    for (const item of this.data.transactions) {
      const category = this.data.categories.find(cat => cat.id === item.category)?.name || 'Outros';
      rows.push([
        dateTime(item.date),
        item.type === 'income' ? 'Entrada' : 'Saída',
        item.description,
        category,
        Number(item.amount).toFixed(2).replace('.', ','),
        item.source === 'purchase' ? 'Compra de supermercado' : 'Manual'
      ]);
    }

    return {
      filename: `movimentacoes-${localDateKey()}.csv`,
      content: '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n'),
      mimeType: 'text/csv;charset=utf-8'
    };
  }

  createFinancePdf(period = 'month') {
    const { start, end, label } = this.getRange(period);
    const totals = this.finance.getTotals(start, end);
    const categories = this.finance.getCategoryExpenses(totals.transactions).map(item => ({
      name: this.data.categories.find(category => category.id === item.category)?.name || 'Outros',
      amount: item.amount
    }));
    const transactions = [...totals.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(item => ({
        date: dateTime(item.date),
        type: item.type === 'income' ? 'Entrada' : 'Saída',
        description: item.description,
        category: this.data.categories.find(category => category.id === item.category)?.name || 'Outros',
        amount: item.amount
      }));
    const purchases = this.data.purchases
      .filter(item => item.status === 'completed' && new Date(item.finalizedAt) >= start && new Date(item.finalizedAt) <= end)
      .map(item => ({
        date: dateTime(item.finalizedAt), name: item.name, itemCount: item.items.length,
        total: item.total, linked: Boolean(item.addedToFinance)
      }));

    return {
      filename: `relatorio-financeiro-${period}-${localDateKey()}.pdf`,
      content: PdfService.createFinancialReport({
        periodLabel: label,
        rangeLabel: `${dateTime(start)} até ${dateTime(end)}`,
        totals, transactions, categories, purchases, money
      }),
      mimeType: 'application/pdf'
    };
  }

  createPurchasePdf(purchase) {
    return {
      filename: `compra-${localDateKey(new Date(purchase.finalizedAt || purchase.createdAt))}-${purchase.id}.pdf`,
      content: PdfService.createPurchaseReport(purchase, money, dateTime),
      mimeType: 'application/pdf'
    };
  }
}

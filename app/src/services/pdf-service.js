const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 48;
const RIGHT = 547;

function winAnsiByte(character) {
  const code = character.codePointAt(0);
  const special = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
    [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
    [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
    [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
    [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
    [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
  ]);
  if (special.has(code)) return special.get(code);
  if (code <= 0xff && !(code >= 0x80 && code <= 0x9f)) return code;
  return 0x3f;
}

function pdfText(value) {
  const bytes = [...String(value ?? '')].map(char => winAnsiByte(char));
  return `<${bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}>`;
}

function wrapText(value, maxChars = 92) {
  const words = String(value ?? '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!word) continue;
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function makeContentPage(title, subtitle, lines, pageNumber, pageCount) {
  const commands = [];
  commands.push('0.07 0.26 0.16 rg');
  commands.push(`BT /F2 18 Tf ${LEFT} ${PAGE_HEIGHT - 58} Td ${pdfText(title)} Tj ET`);
  commands.push('0.36 0.42 0.38 rg');
  commands.push(`BT /F1 9 Tf ${LEFT} ${PAGE_HEIGHT - 78} Td ${pdfText(subtitle)} Tj ET`);
  commands.push('0.80 0.86 0.81 RG 0.8 w');
  commands.push(` ${LEFT} ${PAGE_HEIGHT - 91} m ${RIGHT} ${PAGE_HEIGHT - 91} l S`);

  let y = PAGE_HEIGHT - 116;
  for (const entry of lines) {
    if (entry.type === 'heading') {
      y -= 7;
      commands.push('0.07 0.26 0.16 rg');
      commands.push(`BT /F2 11 Tf ${LEFT} ${y} Td ${pdfText(entry.text)} Tj ET`);
      y -= 18;
    } else if (entry.type === 'spacer') {
      y -= 7;
    } else {
      commands.push('0.13 0.17 0.14 rg');
      commands.push(`BT /F1 ${entry.bold ? 9 : 8.5} Tf ${LEFT + (entry.indent ? 12 : 0)} ${y} Td ${pdfText(entry.text)} Tj ET`);
      y -= entry.bold ? 15 : 13;
    }
  }

  commands.push('0.65 0.70 0.66 RG 0.5 w');
  commands.push(` ${LEFT} 42 m ${RIGHT} 42 l S`);
  commands.push('0.4 0.45 0.42 rg');
  commands.push(`BT /F1 8 Tf ${LEFT} 27 Td ${pdfText('Mercado & Finanças  |  Relatório local')} Tj ET`);
  commands.push(`BT /F1 8 Tf ${RIGHT - 62} 27 Td ${pdfText(`Página ${pageNumber}/${pageCount}`)} Tj ET`);
  return commands.join('\n');
}

function paginate(lines, maxLines = 48) {
  const pages = [];
  let current = [];
  let count = 0;
  for (const entry of lines) {
    const height = entry.type === 'heading' ? 2 : entry.type === 'spacer' ? 1 : 1;
    if (count + height > maxLines && current.length) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(entry);
    count += height;
  }
  if (current.length || !pages.length) pages.push(current);
  return pages;
}

function buildPdf({ title, subtitle, sections }) {
  const flatLines = [];
  for (const section of sections) {
    if (section.heading) flatLines.push({ type: 'heading', text: section.heading });
    for (const line of section.lines || []) {
      for (const wrapped of wrapText(line.text ?? line, 96)) {
        flatLines.push({ type: 'line', text: wrapped, bold: Boolean(line.bold), indent: Boolean(line.indent) });
      }
    }
    flatLines.push({ type: 'spacer' });
  }
  const pages = paginate(flatLines);
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const pageIds = [];
  pages.forEach((pageLines, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(`${pageId} 0 R`);
    const content = makeContentPage(title, subtitle, pageLines, index + 1, pages.length);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.join(' ')}] /Count ${pages.length} >>`;

  let pdf = '%PDF-1.4\n%PDFGEN\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export class PdfService {
  static create({ title, subtitle, sections }) {
    return buildPdf({ title, subtitle, sections });
  }

  static createFinancialReport({ periodLabel, rangeLabel, totals, transactions, categories, purchases, money }) {
    const sections = [
      { heading: 'RESUMO FINANCEIRO', lines: [
        { text: `Período: ${periodLabel}`, bold: true },
        `Intervalo: ${rangeLabel}`,
        `Entradas: ${money(totals.income)}`,
        `Despesas: ${money(totals.expenses)}`,
        { text: `Resultado: ${money(totals.balance)}`, bold: true }
      ] },
      { heading: 'DESPESAS POR CATEGORIA', lines: categories.length
        ? categories.map(item => `${item.name}: ${money(item.amount)}`)
        : ['Nenhuma despesa registrada no período.'] },
      { heading: 'MOVIMENTAÇÕES', lines: transactions.length
        ? transactions.map(item => `${item.date} | ${item.type} | ${item.description} | ${item.category} | ${money(item.amount)}`)
        : ['Nenhuma movimentação registrada no período.'] },
      { heading: 'COMPRAS DE SUPERMERCADO', lines: purchases.length
        ? purchases.map(item => `${item.date} | ${item.name} | ${item.itemCount} produto(s) | ${money(item.total)} | ${item.linked ? 'Lançada no financeiro' : 'Não vinculada'}`)
        : ['Nenhuma compra finalizada no período.'] }
    ];
    return buildPdf({
      title: 'Relatório financeiro',
      subtitle: `Mercado & Finanças  |  ${periodLabel}  |  Gerado em ${new Date().toLocaleString('pt-BR')}`,
      sections
    });
  }

  static createPurchaseReport(purchase, money, dateTime) {
    const when = purchase.finalizedAt || purchase.createdAt;
    const sections = [
      { heading: 'DADOS DA COMPRA', lines: [
        { text: `Compra: ${purchase.name}`, bold: true },
        `Data e horário: ${dateTime(when)}`,
        `Status: ${purchase.status === 'completed' ? 'Compra finalizada' : 'Lista salva'}`,
        `Financeiro: ${purchase.status === 'completed' ? (purchase.addedToFinance ? 'Despesa registrada' : 'Não vinculada ao financeiro') : 'Lista sem lançamento financeiro'}`
      ] },
      { heading: 'PRODUTOS', lines: purchase.items.map(item =>
        `${item.name} | Unitário ${money(item.unitPrice)} | Quantidade ${item.quantity} ${item.unit || 'un'} | Subtotal ${money(item.subtotal ?? item.unitPrice * item.quantity)}`
      ) },
      { heading: 'TOTAL', lines: [{ text: `TOTAL DA COMPRA: ${money(purchase.total)}`, bold: true }] }
    ];
    return buildPdf({
      title: 'Comprovante de compra',
      subtitle: `Mercado & Finanças  |  ${purchase.name}  |  Emitido em ${dateTime(new Date())}`,
      sections
    });
  }
}

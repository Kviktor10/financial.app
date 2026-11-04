const CATEGORY_ALIASES = new Map([
  ['comida', 'comida'], ['alimento', 'comida'], ['alimentos', 'comida'], ['food', 'comida'],
  ['limpeza', 'limpeza'], ['limpeza domestica', 'limpeza'], ['cleaning', 'limpeza'],
  ['medicamento', 'medicamento'], ['medicamentos', 'medicamento'], ['farmacia', 'medicamento'], ['saude', 'medicamento'],
  ['eletronico', 'eletronico'], ['eletronicos', 'eletronico'], ['eletronica', 'eletronico'], ['electronics', 'eletronico'],
  ['higiene', 'higiene'], ['higiene pessoal', 'higiene'],
  ['escolar', 'escolar'], ['papelaria', 'escolar'], ['material escolar', 'escolar'],
  ['utensilio', 'utensilios'], ['utensilios', 'utensilios'], ['casa', 'utensilios'],
  ['vestuario', 'vestuario'], ['roupa', 'vestuario'], ['roupas', 'vestuario'],
  ['bebida', 'bebidas'], ['bebidas', 'bebidas'],
  ['supermercado', 'supermercado'], ['transporte', 'transporte'], ['moradia', 'moradia'],
  ['conta', 'contas'], ['contas', 'contas'], ['lazer', 'lazer'], ['pet', 'pets'], ['pets', 'pets'], ['outros', 'outros']
]);

function normalizeHeader(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!text) return NaN;
  if (text.includes(',') && text.includes('.')) {
    // Convenção brasileira: 1.234,56
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function parseCsvRows(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiters = [';', ',', '\t'];
  let delimiter = ';';
  let bestCount = -1;
  for (const candidate of delimiters) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (!quoted && firstLine[i] === candidate) count += 1;
    }
    if (count > bestCount) { bestCount = count; delimiter = candidate; }
  }

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell); cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(value => String(value).trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => String(value).trim() !== '')) rows.push(row);
  if (quoted) throw new Error('O CSV possui aspas não fechadas. Verifique o arquivo.');
  return rows;
}

function getCategory(value, categories) {
  const normalized = normalizeText(value);
  const direct = categories.find(category => normalizeText(category.id) === normalized || normalizeText(category.name) === normalized);
  if (direct) return direct.id;
  const aliasKey = normalized.replace(/[^a-z0-9 ]/g, '').trim();
  const mapped = CATEGORY_ALIASES.get(aliasKey);
  return categories.some(category => category.id === mapped) ? mapped : 'outros';
}

function validateProduct(row, categories) {
  const name = String(row.name ?? row.nome ?? row.produto ?? row.product ?? '').trim();
  const price = parsePrice(row.price ?? row.preco ?? row.valor ?? row.value);
  if (!name) return { error: 'Nome ausente' };
  if (!Number.isFinite(price) || price < 0) return { error: `Preço inválido: ${name}` };
  return {
    product: {
      name: name.slice(0, 90),
      category: getCategory(row.category ?? row.categoria ?? row.grupo ?? 'outros', categories),
      price: Math.round(price * 100) / 100,
      unit: String(row.unit ?? row.unidade ?? row.medida ?? 'un').trim().slice(0, 20) || 'un'
    }
  };
}

export class ProductImportService {
  static async parseFile(file, categories) {
    if (!file) throw new Error('Selecione um arquivo CSV ou JSON.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    let sourceRows;
    const mimeType = String(file.type || '').toLowerCase();
    if (extension === 'json' || mimeType === 'application/json') {
      let parsed;
      try { parsed = JSON.parse(await file.text()); }
      catch { throw new Error('O arquivo JSON está malformado.'); }
      sourceRows = Array.isArray(parsed) ? parsed : parsed?.products;
      if (!Array.isArray(sourceRows)) throw new Error('O JSON deve conter uma lista de produtos ou uma propriedade "products".');
    } else if (extension === 'csv' || mimeType.includes('csv') || mimeType === 'text/plain') {
      const rows = parseCsvRows(await file.text());
      if (rows.length < 2) throw new Error('O CSV precisa ter um cabeçalho e pelo menos uma linha de produto.');
      const headers = rows.shift().map(normalizeHeader);
      const indexes = {
        name: headers.findIndex(header => ['nome', 'produto', 'name', 'product'].includes(header)),
        price: headers.findIndex(header => ['preco', 'valor', 'price', 'value'].includes(header)),
        category: headers.findIndex(header => ['categoria', 'category', 'grupo'].includes(header)),
        unit: headers.findIndex(header => ['unidade', 'unit', 'medida'].includes(header))
      };
      if (indexes.name < 0 || indexes.price < 0) throw new Error('O CSV precisa ter as colunas obrigatórias: nome e preco.');
      sourceRows = rows.map(row => ({
        name: row[indexes.name], price: row[indexes.price],
        category: indexes.category >= 0 ? row[indexes.category] : 'outros',
        unit: indexes.unit >= 0 ? row[indexes.unit] : 'un'
      }));
    } else {
      throw new Error('Formato não reconhecido. Selecione um arquivo .csv ou .json.');
    }

    if (sourceRows.length > 5000) throw new Error('O limite é de 5.000 produtos por importação.');
    const products = [];
    const errors = [];
    sourceRows.forEach((row, index) => {
      const result = validateProduct(row || {}, categories);
      if (result.product) products.push(result.product);
      else errors.push({ row: index + 2, reason: result.error });
    });
    if (!products.length) throw new Error('Nenhum produto válido foi encontrado no arquivo.');
    return { products, errors, totalRows: sourceRows.length };
  }
}

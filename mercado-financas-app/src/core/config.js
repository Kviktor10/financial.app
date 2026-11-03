export const APP_CONFIG = Object.freeze({
  name: 'Mercado & Finanças',
  storagePrefix: 'mercado_financas_v1',
  cryptoIterations: 600_000,
  autoLockMinutes: 10,
  currency: 'BRL',
  appVersion: '1.0.0'
});

export const CATEGORIES = Object.freeze([
  { id: 'comida', name: 'Comida', icon: '🥬', color: '#dff3c1' },
  { id: 'limpeza', name: 'Limpeza', icon: '🧽', color: '#d9ecff' },
  { id: 'medicamento', name: 'Medicamento', icon: '💊', color: '#f6dfe4' },
  { id: 'eletronico', name: 'Eletrônico', icon: '🔌', color: '#e7e0ff' },
  { id: 'higiene', name: 'Higiene', icon: '🧴', color: '#d9f3ef' },
  { id: 'escolar', name: 'Escolar', icon: '📚', color: '#fff0c9' },
  { id: 'utensilios', name: 'Utensílios', icon: '🍴', color: '#ffe3ce' },
  { id: 'vestuario', name: 'Vestuário', icon: '👕', color: '#f0e1f8' },
  { id: 'bebidas', name: 'Bebidas', icon: '🧃', color: '#d9edff' },
  { id: 'supermercado', name: 'Supermercado', icon: '🛒', color: '#dff3c1' },
  { id: 'transporte', name: 'Transporte', icon: '🚌', color: '#dce9f8' },
  { id: 'moradia', name: 'Moradia', icon: '🏠', color: '#f6e5d8' },
  { id: 'contas', name: 'Contas', icon: '🧾', color: '#e6e6f8' },
  { id: 'lazer', name: 'Lazer', icon: '🎟️', color: '#f4e1f3' },
  { id: 'pets', name: 'Pets', icon: '🐾', color: '#f9e9d4' },
  { id: 'outros', name: 'Outros', icon: '📦', color: '#e7e9e5' }
]);

export const VIEW_META = Object.freeze({
  dashboard: { title: 'Dashboard', eyebrow: 'VISÃO GERAL' },
  shopping: { title: 'Caixa / Compras', eyebrow: 'SUPERMERCADO' },
  products: { title: 'Produtos', eyebrow: 'CATÁLOGO' },
  finance: { title: 'Movimentações', eyebrow: 'CONTROLE FINANCEIRO' },
  calendar: { title: 'Calendário', eyebrow: 'AGENDA DE GASTOS' },
  reports: { title: 'Relatórios', eyebrow: 'ANÁLISE FINANCEIRA' },
  credentials: { title: 'Cofre de credenciais', eyebrow: 'PRIVACIDADE' },
  settings: { title: 'Configurações', eyebrow: 'SISTEMA' }
});

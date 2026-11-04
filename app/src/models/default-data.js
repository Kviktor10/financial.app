import { APP_CONFIG, CATEGORIES } from '../core/config.js?v=1.4.0';

export function createDefaultAppData() {
  return {
    version: 1,
    settings: {
      email: '',
      currency: APP_CONFIG.currency
    },
    categories: CATEGORIES.map(category => ({ ...category })),
    products: [],
    purchases: [],
    transactions: [],
    activeCart: [],
    calendarNotes: []
  };
}

export function createDefaultCredentialData() {
  return { entries: [] };
}

export function normalizeAppData(data) {
  const defaults = createDefaultAppData();
  return {
    ...defaults,
    ...data,
    settings: { ...defaults.settings, ...(data?.settings ?? {}) },
    categories: Array.isArray(data?.categories) ? data.categories : defaults.categories,
    products: Array.isArray(data?.products) ? data.products : [],
    purchases: Array.isArray(data?.purchases) ? data.purchases : [],
    transactions: Array.isArray(data?.transactions) ? data.transactions : [],
    activeCart: Array.isArray(data?.activeCart) ? data.activeCart : [],
    calendarNotes: Array.isArray(data?.calendarNotes) ? data.calendarNotes : []
  };
}

export function normalizeCredentialData(data) {
  return { entries: Array.isArray(data?.entries) ? data.entries : [] };
}

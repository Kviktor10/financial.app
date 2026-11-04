import { APP_CONFIG } from './config.js?v=1.4.0';
import { CryptoService } from '../security/crypto.js?v=1.4.0';
import {
  createDefaultAppData,
  createDefaultCredentialData,
  normalizeAppData,
  normalizeCredentialData
} from '../models/default-data.js?v=1.4.0';

// Os novos dados são armazenados sem criptografia para permitir acesso direto, sem senha.
// Os registros da versão anterior permanecem intocados para uma migração opcional.
const keys = {
  app: `${APP_CONFIG.storagePrefix}:plain:app`,
  credentials: `${APP_CONFIG.storagePrefix}:plain:credentials`,
  migratedLegacy: `${APP_CONFIG.storagePrefix}:legacy-migrated`
};

const legacyKeys = {
  auth: `${APP_CONFIG.storagePrefix}:auth`,
  app: `${APP_CONFIG.storagePrefix}:app`,
  credentials: `${APP_CONFIG.storagePrefix}:credentials`
};

function readJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Não sobrescreve dados que não puderam ser interpretados.
    throw new Error(`O registro local "${key}" está inválido ou incompleto. Os dados foram preservados; importe um backup válido antes de tentar restaurar.`);
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error('O armazenamento do navegador está cheio. Exporte um backup e remova dados que não utiliza antes de tentar novamente.');
    }
    throw new Error(`Não foi possível salvar os dados locais: ${error?.message || 'erro de armazenamento'}`);
  }
}


export class LocalDatabase {
  static async initialize() {
    let appData = readJson(keys.app);
    let credentials = readJson(keys.credentials);

    if (!appData) {
      appData = createDefaultAppData();
      writeJson(keys.app, appData);
    }
    if (!credentials) {
      credentials = createDefaultCredentialData();
      writeJson(keys.credentials, credentials);
    }

    return {
      appData: normalizeAppData(appData),
      credentials: normalizeCredentialData(credentials),
      hasLegacyData: this.hasLegacyData()
    };
  }

  static async saveApp(data) {
    writeJson(keys.app, data);
  }

  static async saveCredentials(data) {
    writeJson(keys.credentials, data);
  }

  static exportBackup() {
    return {
      format: 'mercado-financas-local-backup-v2',
      exportedAt: new Date().toISOString(),
      appData: readJson(keys.app) || createDefaultAppData(),
      credentials: readJson(keys.credentials) || createDefaultCredentialData()
    };
  }

  static importBackup(backup) {
    if (backup?.format !== 'mercado-financas-local-backup-v2' || !backup.appData || !backup.credentials) {
      throw new Error('Arquivo inválido. Importe um backup local da versão 1.2 ou posterior.');
    }

    const appData = normalizeAppData(backup.appData);
    const credentials = normalizeCredentialData(backup.credentials);

    // Valida os dois documentos antes de substituir os dados atuais.
    const appJson = JSON.stringify(appData);
    const credentialsJson = JSON.stringify(credentials);
    const previousApp = localStorage.getItem(keys.app);
    const previousCredentials = localStorage.getItem(keys.credentials);
    try {
      localStorage.setItem(keys.app, appJson);
      localStorage.setItem(keys.credentials, credentialsJson);
    } catch (error) {
      // Tenta restaurar o estado anterior se uma das duas gravações falhar.
      if (previousApp === null) localStorage.removeItem(keys.app);
      else localStorage.setItem(keys.app, previousApp);
      if (previousCredentials === null) localStorage.removeItem(keys.credentials);
      else localStorage.setItem(keys.credentials, previousCredentials);
      if (error?.name === 'QuotaExceededError') {
        throw new Error('Não há espaço suficiente para importar o backup. Os dados anteriores foram restaurados.');
      }
      throw error;
    }
    return { appData, credentials };
  }

  static clearOperationalData() {
    writeJson(keys.app, createDefaultAppData());
  }

  static hasLegacyData() {
    return !localStorage.getItem(keys.migratedLegacy)
      && Boolean(localStorage.getItem(legacyKeys.auth))
      && Boolean(localStorage.getItem(legacyKeys.app));
  }

  static async importLegacy(password) {
    if (!this.hasLegacyData()) throw new Error('Não foram encontrados dados protegidos de uma versão anterior.');
    if (!String(password || '')) throw new Error('Informe a senha usada na versão anterior.');

    const auth = readJson(legacyKeys.auth);
    const appRecord = readJson(legacyKeys.app);
    const credentialsRecord = readJson(legacyKeys.credentials);

    let derivedKeys;
    try {
      derivedKeys = await CryptoService.unlock(password, auth);
    } catch {
      throw new Error('A senha anterior não confere. Nenhum dado foi alterado.');
    }

    let appData = appRecord
      ? await CryptoService.decryptAppData(derivedKeys.appKey, appRecord)
      : createDefaultAppData();
    let credentials = credentialsRecord
      ? await CryptoService.decryptCredentials(derivedKeys.credentialKey, credentialsRecord)
      : createDefaultCredentialData();

    appData = normalizeAppData(appData);
    credentials = normalizeCredentialData(credentials);

    // Só grava depois de conseguir descriptografar os dois conjuntos de dados.
    await this.saveApp(appData);
    await this.saveCredentials(credentials);
    localStorage.setItem(keys.migratedLegacy, new Date().toISOString());

    return { appData, credentials };
  }

  static storageKeys() {
    return { ...keys };
  }

  static legacyStorageKeys() {
    return { ...legacyKeys };
  }
}

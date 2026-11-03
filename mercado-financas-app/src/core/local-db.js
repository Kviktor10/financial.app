import { APP_CONFIG } from './config.js';
import { CryptoService } from '../security/crypto.js';
import { createDefaultAppData, createDefaultCredentialData, normalizeAppData, normalizeCredentialData } from '../models/default-data.js';

const keys = {
  auth: `${APP_CONFIG.storagePrefix}:auth`,
  app: `${APP_CONFIG.storagePrefix}:app`,
  credentials: `${APP_CONFIG.storagePrefix}:credentials`
};

export class LocalDatabase {
  static hasAuth() {
    return Boolean(localStorage.getItem(keys.auth));
  }

  static getAuth() {
    const raw = localStorage.getItem(keys.auth);
    return raw ? JSON.parse(raw) : null;
  }

  static saveAuth(auth) {
    localStorage.setItem(keys.auth, JSON.stringify(auth));
  }

  static async create(password, masterCode) {
    const result = await CryptoService.createAuth(password, masterCode);
    const appData = createDefaultAppData();
    const credentials = createDefaultCredentialData();
    const appRecord = await CryptoService.encryptAppData(result.keys.appKey, appData);
    const credentialsRecord = await CryptoService.encryptCredentials(result.keys.credentialKey, credentials);
    localStorage.setItem(keys.auth, JSON.stringify(result.auth));
    localStorage.setItem(keys.app, JSON.stringify(appRecord));
    localStorage.setItem(keys.credentials, JSON.stringify(credentialsRecord));
    return { auth: result.auth, keys: result.keys, appData, credentials };
  }

  static async load(keysFromSession) {
    const appRaw = localStorage.getItem(keys.app);
    const credentialsRaw = localStorage.getItem(keys.credentials);
    const appRecord = appRaw ? JSON.parse(appRaw) : await CryptoService.encryptAppData(keysFromSession.appKey, createDefaultAppData());
    const credentialsRecord = credentialsRaw ? JSON.parse(credentialsRaw) : await CryptoService.encryptCredentials(keysFromSession.credentialKey, createDefaultCredentialData());
    if (!appRaw) localStorage.setItem(keys.app, JSON.stringify(appRecord));
    if (!credentialsRaw) localStorage.setItem(keys.credentials, JSON.stringify(credentialsRecord));
    const appData = normalizeAppData(await CryptoService.decryptAppData(keysFromSession.appKey, appRecord));
    const credentials = normalizeCredentialData(await CryptoService.decryptCredentials(keysFromSession.credentialKey, credentialsRecord));
    return { appData, credentials };
  }

  static async saveApp(data, key) {
    const record = await CryptoService.encryptAppData(key, data);
    localStorage.setItem(keys.app, JSON.stringify(record));
  }

  static async saveCredentials(data, key) {
    const record = await CryptoService.encryptCredentials(key, data);
    localStorage.setItem(keys.credentials, JSON.stringify(record));
  }

  static async replaceAll({ auth, appRecord, credentialsRecord }) {
    // Os três registros são preparados antes da troca para reduzir o risco de gravação parcial.
    localStorage.setItem(keys.app, JSON.stringify(appRecord));
    localStorage.setItem(keys.credentials, JSON.stringify(credentialsRecord));
    localStorage.setItem(keys.auth, JSON.stringify(auth));
  }

  static exportEncryptedBackup() {
    return {
      format: 'mercado-financas-encrypted-backup-v1',
      exportedAt: new Date().toISOString(),
      auth: localStorage.getItem(keys.auth),
      app: localStorage.getItem(keys.app),
      credentials: localStorage.getItem(keys.credentials)
    };
  }

  static importEncryptedBackup(backup) {
    if (backup?.format !== 'mercado-financas-encrypted-backup-v1' || !backup.auth || !backup.app || !backup.credentials) {
      throw new Error('O arquivo não é um backup válido deste aplicativo.');
    }
    // A validação criptográfica ocorre no próximo desbloqueio.
    JSON.parse(backup.auth);
    JSON.parse(backup.app);
    JSON.parse(backup.credentials);
    localStorage.setItem(keys.auth, backup.auth);
    localStorage.setItem(keys.app, backup.app);
    localStorage.setItem(keys.credentials, backup.credentials);
  }

  static clearOperationalData() {
    localStorage.removeItem(keys.app);
  }

  static storageKeys() {
    return { ...keys };
  }
}

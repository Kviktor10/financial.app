import { APP_CONFIG } from '../core/config.js?v=1.4.0';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const APP_CONTEXT = 'mercado-financas:v1:app-data';
const CREDENTIAL_CONTEXT = 'mercado-financas:v1:credential-vault';
const CHECK_CONTEXT = 'mercado-financas:v1:auth-check';

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function randomBytes(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derivePbkdf2Bits(secret, salt, iterations = APP_CONFIG.cryptoIterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256);
}

async function importHkdfBase(password, salt, iterations = APP_CONFIG.cryptoIterations) {
  const bits = await derivePbkdf2Bits(password, salt, iterations);
  return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
}

async function derivePurposeKey(baseKey, salt, purpose) {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(`mercado-financas:v1:${purpose}`) },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveSessionKeys(password, salt, iterations) {
  const baseKey = await importHkdfBase(password, salt, iterations);
  const checkKey = await derivePurposeKey(baseKey, salt, 'auth-check');
  const appKey = await derivePurposeKey(baseKey, salt, 'app-data');
  const credentialKey = await derivePurposeKey(baseKey, salt, 'credential-vault');
  return { checkKey, appKey, credentialKey };
}

async function encryptText(key, text, context) {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context), tagLength: 128 },
    key,
    encoder.encode(text)
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

async function decryptText(key, record, context) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(record.iv), additionalData: encoder.encode(context), tagLength: 128 },
    key,
    fromBase64(record.ciphertext)
  );
  return decoder.decode(plain);
}

export class CryptoService {
  static isAvailable() {
    return Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
  }

  // Senha simples de lembrar, mas sem aceitar um PIN curto como única proteção.
  static validatePassword(password) {
    if (typeof password !== 'string' || password.length < 8) return 'Use pelo menos 8 caracteres na senha.';
    if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
    return '';
  }

  static async createAuth(password) {
    const salt = randomBytes(16);
    const iterations = APP_CONFIG.cryptoIterations;
    const { checkKey, appKey, credentialKey } = await deriveSessionKeys(password, salt, iterations);
    const check = await encryptText(checkKey, 'mercado-financas-auth-ok-v1', CHECK_CONTEXT);
    return {
      auth: {
        version: 2,
        algorithm: 'PBKDF2-HMAC-SHA-256 + HKDF-SHA-256 + AES-256-GCM',
        iterations,
        salt: toBase64(salt),
        check,
        createdAt: new Date().toISOString()
      },
      keys: { appKey, credentialKey }
    };
  }

  static async unlock(password, auth) {
    if (!auth?.salt || !auth?.check || !auth?.iterations) throw new Error('Registro de autenticação inválido.');
    const salt = fromBase64(auth.salt);
    const { checkKey, appKey, credentialKey } = await deriveSessionKeys(password, salt, auth.iterations);
    const proof = await decryptText(checkKey, auth.check, CHECK_CONTEXT);
    if (proof !== 'mercado-financas-auth-ok-v1') throw new Error('Senha incorreta.');
    return { appKey, credentialKey };
  }

  static async changePassword(newPassword, appData, credentials) {
    const result = await this.createAuth(newPassword);
    return {
      auth: result.auth,
      appRecord: await this.encryptAppData(result.keys.appKey, appData),
      credentialsRecord: await this.encryptCredentials(result.keys.credentialKey, credentials),
      keys: result.keys
    };
  }

  static async encryptAppData(key, value) {
    return encryptText(key, JSON.stringify(value), APP_CONTEXT);
  }

  static async decryptAppData(key, record) {
    return JSON.parse(await decryptText(key, record, APP_CONTEXT));
  }

  static async encryptCredentials(key, value) {
    return encryptText(key, JSON.stringify(value), CREDENTIAL_CONTEXT);
  }

  static async decryptCredentials(key, record) {
    return JSON.parse(await decryptText(key, record, CREDENTIAL_CONTEXT));
  }
}

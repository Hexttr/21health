import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiProviders, platformSettings, providerSecrets } from '../db/schema.js';
import { deleteLegacyPlatformSetting } from './platform-settings.js';

const PROVIDER_API_KEY_PREFIX = 'provider_apikey_';
const PROVIDER_KEY_CACHE_TTL_MS = 30_000;

type ProviderKeyCacheEntry = {
  value: string | null;
  expiresAt: number;
};

const providerKeyCache = new Map<string, ProviderKeyCacheEntry>();

function getProviderCache(providerId: string): string | null | undefined {
  const cached = providerKeyCache.get(providerId);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    providerKeyCache.delete(providerId);
    return undefined;
  }
  return cached.value;
}

function setProviderCache(providerId: string, value: string | null): void {
  providerKeyCache.set(providerId, {
    value,
    expiresAt: Date.now() + PROVIDER_KEY_CACHE_TTL_MS,
  });
}

function getLegacySettingKey(providerId: string): string {
  return PROVIDER_API_KEY_PREFIX + providerId;
}

function getEncryptionSecret(): string | null {
  return process.env.PROVIDER_SECRET_KEY || process.env.JWT_SECRET || null;
}

function getEncryptionKey(): Buffer {
  const secret = getEncryptionSecret();
  if (!secret) {
    throw new Error('Отсутствует PROVIDER_SECRET_KEY или JWT_SECRET для хранения API-ключей');
  }
  return createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, encryptedB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Некорректный формат зашифрованного секрета');
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function maskSecret(value: string): string {
  return '••••' + value.slice(-4);
}

export function invalidateProviderKeyCache(providerId?: string): void {
  if (providerId) {
    providerKeyCache.delete(providerId);
    return;
  }
  providerKeyCache.clear();
}

async function loadProvider(providerId: string) {
  const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, providerId));
  return provider || null;
}

async function readStoredProviderKey(providerId: string): Promise<string | null> {
  const [row] = await db.select().from(providerSecrets).where(eq(providerSecrets.providerId, providerId));
  if (!row?.encryptedValue) return null;
  return decryptSecret(row.encryptedValue);
}

async function readLegacyProviderKey(providerId: string): Promise<string | null> {
  const [legacy] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, getLegacySettingKey(providerId)));
  return legacy?.value || null;
}

async function migrateLegacyProviderKey(providerId: string, legacyValue: string): Promise<void> {
  await db.insert(providerSecrets).values({
    providerId,
    encryptedValue: encryptSecret(legacyValue),
    keyVersion: 1,
  }).onConflictDoUpdate({
    target: providerSecrets.providerId,
    set: {
      encryptedValue: encryptSecret(legacyValue),
      keyVersion: 1,
      updatedAt: new Date(),
    },
  });

  await deleteLegacyPlatformSetting(getLegacySettingKey(providerId));
}

/** Получить API-ключ провайдера: сначала из БД, иначе из env */
export async function getProviderApiKey(providerId: string): Promise<string | null> {
  const cached = getProviderCache(providerId);
  if (cached !== undefined) return cached;

  const storedKey = await readStoredProviderKey(providerId);
  if (storedKey) {
    setProviderCache(providerId, storedKey);
    return storedKey;
  }

  const legacyKey = await readLegacyProviderKey(providerId);
  if (legacyKey) {
    await migrateLegacyProviderKey(providerId, legacyKey);
    setProviderCache(providerId, legacyKey);
    return legacyKey;
  }

  const provider = await loadProvider(providerId);
  if (provider?.apiKeyEnv) {
    const envKey = process.env[provider.apiKeyEnv];
    if (envKey) {
      setProviderCache(providerId, envKey);
      return envKey;
    }
  }
  setProviderCache(providerId, null);
  return null;
}

export async function setProviderApiKey(providerId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('API-ключ не может быть пустым');
  }

  await db.insert(providerSecrets).values({
    providerId,
    encryptedValue: encryptSecret(trimmed),
    keyVersion: 1,
  }).onConflictDoUpdate({
    target: providerSecrets.providerId,
    set: {
      encryptedValue: encryptSecret(trimmed),
      keyVersion: 1,
      updatedAt: new Date(),
    },
  });

  await deleteLegacyPlatformSetting(getLegacySettingKey(providerId));
  invalidateProviderKeyCache(providerId);
}

export async function clearProviderApiKey(providerId: string): Promise<void> {
  await db.delete(providerSecrets).where(eq(providerSecrets.providerId, providerId));
  await deleteLegacyPlatformSetting(getLegacySettingKey(providerId));
  invalidateProviderKeyCache(providerId);
}

export async function getProviderApiKeyStatus(providerId: string): Promise<{
  hasStoredKey: boolean;
  masked: string | null;
  envVar: string | null;
  usesEnvFallback: boolean;
}> {
  let storedKey = await readStoredProviderKey(providerId);
  if (!storedKey) {
    const legacyKey = await readLegacyProviderKey(providerId);
    if (legacyKey) {
      await migrateLegacyProviderKey(providerId, legacyKey);
      storedKey = legacyKey;
    }
  }

  const provider = await loadProvider(providerId);
  const envVar = provider?.apiKeyEnv || null;
  const envKey = envVar ? process.env[envVar] : null;

  return {
    hasStoredKey: !!storedKey,
    masked: storedKey ? maskSecret(storedKey) : null,
    envVar,
    usesEnvFallback: !storedKey && !!envKey,
  };
}

/** Ключ для Gemini (провайдер gemini или GEMINI_API_KEY) */
export async function getGeminiKey(): Promise<string | null> {
  const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.name, 'gemini'));
  if (provider) {
    const k = await getProviderApiKey(provider.id);
    if (k) return k;
  }
  return process.env.GEMINI_API_KEY || null;
}

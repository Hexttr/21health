import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiProviders, platformSettings } from '../db/schema.js';

const PROVIDER_API_KEY_PREFIX = 'provider_apikey_';

/** Получить API-ключ провайдера: сначала из БД, иначе из env */
export async function getProviderApiKey(providerId: string): Promise<string | null> {
  const [ps] = await db.select().from(platformSettings).where(eq(platformSettings.key, PROVIDER_API_KEY_PREFIX + providerId));
  if (ps?.value) return ps.value;

  const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, providerId));
  if (provider?.apiKeyEnv) {
    const envKey = process.env[provider.apiKeyEnv];
    if (envKey) return envKey;
  }
  return null;
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

import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { platformSettings } from '../db/schema.js';

export const ALLOWED_PLATFORM_SETTINGS = [
  'ai_quiz_model_id',
] as const;

export type AllowedPlatformSettingKey = typeof ALLOWED_PLATFORM_SETTINGS[number];

const settingsCache = new Map<string, string>();
const CACHE_TTL_MS = 30_000;
let cacheExpiresAt = 0;

function isAllowedSettingKey(key: string): key is AllowedPlatformSettingKey {
  return (ALLOWED_PLATFORM_SETTINGS as readonly string[]).includes(key);
}

function cacheIsFresh(): boolean {
  return cacheExpiresAt > Date.now();
}

function setCache(entries: Array<{ key: string; value: string }>) {
  settingsCache.clear();
  for (const entry of entries) {
    settingsCache.set(entry.key, entry.value);
  }
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

export function invalidatePlatformSettingsCache(): void {
  settingsCache.clear();
  cacheExpiresAt = 0;
}

export async function getAllowedPlatformSettings(): Promise<Record<AllowedPlatformSettingKey, string>> {
  if (!cacheIsFresh()) {
    const rows = await db
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings)
      .where(inArray(platformSettings.key, [...ALLOWED_PLATFORM_SETTINGS]));
    setCache(rows);
  }

  const result = {} as Record<AllowedPlatformSettingKey, string>;
  for (const key of ALLOWED_PLATFORM_SETTINGS) {
    if (settingsCache.has(key)) {
      result[key] = settingsCache.get(key)!;
    }
  }
  return result;
}

export async function getAllowedPlatformSetting(key: AllowedPlatformSettingKey): Promise<string | null> {
  const settings = await getAllowedPlatformSettings();
  return settings[key] ?? null;
}

export async function updateAllowedPlatformSettings(data: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    if (!isAllowedSettingKey(key)) {
      throw new Error(`Setting "${key}" is not allowed`);
    }

    await db.insert(platformSettings).values({ key, value: String(value) }).onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: String(value), updatedAt: new Date() },
    });
  }

  invalidatePlatformSettingsCache();
}

export async function deleteLegacyPlatformSetting(key: string): Promise<void> {
  await db.delete(platformSettings).where(eq(platformSettings.key, key));
  settingsCache.delete(key);
}

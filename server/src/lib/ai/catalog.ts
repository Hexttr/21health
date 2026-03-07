import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { aiModels, aiProviders } from '../../db/schema.js';

const AI_MODEL_CACHE_TTL_MS = 30_000;

type CachedModels = typeof aiModels.$inferSelect[];
type CachedProviders = typeof aiProviders.$inferSelect[];

let cachedModels: CachedModels | null = null;
let cachedProviders: CachedProviders | null = null;
let cacheExpiresAt = 0;

function cacheIsFresh(): boolean {
  return cacheExpiresAt > Date.now();
}

async function loadActiveModels(): Promise<CachedModels> {
  if (cachedModels && cacheIsFresh()) {
    return cachedModels;
  }

  cachedModels = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.isActive, true))
    .orderBy(asc(aiModels.sortOrder));
  cacheExpiresAt = Date.now() + AI_MODEL_CACHE_TTL_MS;
  return cachedModels;
}

async function loadActiveProviders(): Promise<CachedProviders> {
  if (cachedProviders && cacheIsFresh()) {
    return cachedProviders;
  }

  cachedProviders = await db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.isActive, true))
    .orderBy(asc(aiProviders.name));
  cacheExpiresAt = Date.now() + AI_MODEL_CACHE_TTL_MS;
  return cachedProviders;
}

export function invalidateAiModelCache(): void {
  cachedModels = null;
  cachedProviders = null;
  cacheExpiresAt = 0;
}

export async function getActiveModels(): Promise<CachedModels> {
  return loadActiveModels();
}

export async function getActiveProviderById(providerId: string): Promise<typeof aiProviders.$inferSelect | null> {
  const providers = await loadActiveProviders();
  return providers.find((provider) => provider.id === providerId) || null;
}

export async function getActiveModelById(modelId: string): Promise<typeof aiModels.$inferSelect | null> {
  const models = await loadActiveModels();
  return models.find((model) => model.id === modelId) || null;
}

export async function resolveActiveModel(
  modelId: string | undefined,
  modelType: 'text' | 'image',
): Promise<typeof aiModels.$inferSelect | null> {
  const models = await loadActiveModels();
  if (modelId) {
    const selected = models.find((model) => model.id === modelId && model.modelType === modelType);
    if (selected) return selected;
  }

  return models.find((model) => model.modelType === modelType) || null;
}

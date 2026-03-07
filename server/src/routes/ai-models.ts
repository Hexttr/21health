import { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiProviders, aiModels } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import {
  ALLOWED_PLATFORM_SETTINGS,
  getAllowedPlatformSettings,
  updateAllowedPlatformSettings,
} from '../lib/platform-settings.js';
import {
  clearProviderApiKey,
  getProviderApiKeyStatus,
  setProviderApiKey,
} from '../lib/provider-keys.js';
import { getActiveModels, invalidateAiModelCache } from '../lib/ai/catalog.js';

export async function aiModelsRoutes(app: FastifyInstance) {
  // Public: list active models (for model selector)
  app.get('/ai-models', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) return reply.status(401).send({ error: 'Не авторизован' });

    const models = (await getActiveModels()).map((model) => ({
      id: model.id,
      modelKey: model.modelKey,
      displayName: model.displayName,
      modelType: model.modelType,
      providerId: model.providerId,
      sortOrder: model.sortOrder,
      supportsStreaming: model.supportsStreaming,
      supportsImageInput: model.supportsImageInput,
      supportsImageOutput: model.supportsImageOutput,
      supportsSystemPrompt: model.supportsSystemPrompt,
    }));

    const providers = await db
      .select({ id: aiProviders.id, name: aiProviders.name, displayName: aiProviders.displayName })
      .from(aiProviders)
      .where(eq(aiProviders.isActive, true));

    return reply.send({ models, providers });
  });

  // Admin: list all providers
  app.get('/admin/ai-providers', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const rows = await db.select().from(aiProviders).orderBy(asc(aiProviders.name));
    return reply.send(rows);
  });

  // Admin: create provider
  app.post<{ Body: { name: string; displayName: string; apiKeyEnv?: string } }>(
    '/admin/ai-providers',
    async (req, reply) => {
      const payload = getAuthFromRequest(req);
      if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      const { name, displayName, apiKeyEnv } = req.body || {};
      if (!name?.trim() || !displayName?.trim()) return reply.status(400).send({ error: 'name и displayName обязательны' });
      const [row] = await db.insert(aiProviders).values({ name: name.trim(), displayName: displayName.trim(), apiKeyEnv: apiKeyEnv?.trim() || null }).returning();
      invalidateAiModelCache();
      return reply.send(row);
    }
  );

  // Admin: update provider
  app.put<{ Params: { id: string }; Body: { displayName?: string; apiKeyEnv?: string; isActive?: boolean } }>(
    '/admin/ai-providers/:id',
    async (req, reply) => {
      const payload = getAuthFromRequest(req);
      if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      const data = req.body || {};
      const [row] = await db.update(aiProviders).set({
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.apiKeyEnv !== undefined && { apiKeyEnv: data.apiKeyEnv }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      }).where(eq(aiProviders.id, req.params.id)).returning();
      if (!row) return reply.status(404).send({ error: 'Not found' });
      invalidateAiModelCache();
      return reply.send(row);
    }
  );

  // Admin: delete provider (cascades to models)
  app.delete<{ Params: { id: string } }>('/admin/ai-providers/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const id = req.params.id;
    const [existing] = await db.select().from(aiProviders).where(eq(aiProviders.id, id));
    if (!existing) return reply.status(404).send({ error: 'Провайдер не найден' });
    await clearProviderApiKey(id);
    await db.delete(aiProviders).where(eq(aiProviders.id, id));
    invalidateAiModelCache();
    return reply.send({ success: true });
  });

  // Admin: get provider API key status (masked)
  app.get<{ Params: { id: string } }>('/admin/ai-providers/:id/apikey', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    return reply.send(await getProviderApiKeyStatus(req.params.id));
  });

  // Admin: create/rotate provider API key (write-only)
  app.put<{ Params: { id: string }; Body: { apiKey?: string } }>('/admin/ai-providers/:id/apikey', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const apiKey = req.body?.apiKey?.trim();
    if (!apiKey) return reply.status(400).send({ error: 'API-ключ обязателен' });
    await setProviderApiKey(req.params.id, apiKey);
    return reply.send(await getProviderApiKeyStatus(req.params.id));
  });

  // Admin: clear stored provider API key (env fallback remains)
  app.delete<{ Params: { id: string } }>('/admin/ai-providers/:id/apikey', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    await clearProviderApiKey(req.params.id);
    return reply.send(await getProviderApiKeyStatus(req.params.id));
  });

  // Admin: list all models
  app.get('/admin/ai-models', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const rows = await db.select().from(aiModels).orderBy(asc(aiModels.sortOrder));
    return reply.send(rows);
  });

  // Admin: create model
  app.post<{
    Body: {
      providerId: string; modelKey: string; displayName: string; modelType: 'text' | 'image';
      inputPricePer1k?: string; outputPricePer1k?: string; fixedPrice?: string;
      supportsStreaming?: boolean; supportsImageInput?: boolean; supportsImageOutput?: boolean; supportsSystemPrompt?: boolean;
      isActive?: boolean; sortOrder?: number;
    };
  }>('/admin/ai-models', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const {
      providerId,
      modelKey,
      displayName,
      modelType,
      inputPricePer1k,
      outputPricePer1k,
      fixedPrice,
      supportsStreaming,
      supportsImageInput,
      supportsImageOutput,
      supportsSystemPrompt,
      isActive,
      sortOrder,
    } = req.body || {};
    if (!providerId || !modelKey || !displayName || !modelType) return reply.status(400).send({ error: 'Missing required fields' });
    const [row] = await db.insert(aiModels).values({
      providerId, modelKey: modelKey.trim(), displayName: displayName.trim(), modelType,
      supportsStreaming: supportsStreaming ?? modelType === 'text',
      supportsImageInput: supportsImageInput ?? modelType === 'image',
      supportsImageOutput: supportsImageOutput ?? modelType === 'image',
      supportsSystemPrompt: supportsSystemPrompt ?? modelType === 'text',
      inputPricePer1k: inputPricePer1k || '0', outputPricePer1k: outputPricePer1k || '0',
      fixedPrice: fixedPrice || '0', isActive: isActive ?? true, sortOrder: sortOrder ?? 0,
    }).returning();
    invalidateAiModelCache();
    return reply.send(row);
  });

  // Admin: update model
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/admin/ai-models/:id',
    async (req, reply) => {
      const payload = getAuthFromRequest(req);
      if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      const d = req.body || {};
      const [row] = await db.update(aiModels).set({
        ...(d.modelKey !== undefined && { modelKey: String(d.modelKey) }),
        ...(d.displayName !== undefined && { displayName: String(d.displayName) }),
        ...(d.modelType !== undefined && { modelType: String(d.modelType) as 'text' | 'image' }),
        ...(d.supportsStreaming !== undefined && { supportsStreaming: Boolean(d.supportsStreaming) }),
        ...(d.supportsImageInput !== undefined && { supportsImageInput: Boolean(d.supportsImageInput) }),
        ...(d.supportsImageOutput !== undefined && { supportsImageOutput: Boolean(d.supportsImageOutput) }),
        ...(d.supportsSystemPrompt !== undefined && { supportsSystemPrompt: Boolean(d.supportsSystemPrompt) }),
        ...(d.inputPricePer1k !== undefined && { inputPricePer1k: String(d.inputPricePer1k) }),
        ...(d.outputPricePer1k !== undefined && { outputPricePer1k: String(d.outputPricePer1k) }),
        ...(d.fixedPrice !== undefined && { fixedPrice: String(d.fixedPrice) }),
        ...(d.isActive !== undefined && { isActive: Boolean(d.isActive) }),
        ...(d.sortOrder !== undefined && { sortOrder: Number(d.sortOrder) }),
        updatedAt: new Date(),
      }).where(eq(aiModels.id, req.params.id)).returning();
      if (!row) return reply.status(404).send({ error: 'Not found' });
      invalidateAiModelCache();
      return reply.send(row);
    }
  );

  // Admin: delete model
  app.delete<{ Params: { id: string } }>('/admin/ai-models/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    await db.delete(aiModels).where(eq(aiModels.id, req.params.id));
    invalidateAiModelCache();
    return reply.send({ success: true });
  });

  // Admin: get/update platform settings
  app.get('/admin/settings', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    return reply.send(await getAllowedPlatformSettings());
  });

  app.put<{ Body: Record<string, string> }>('/admin/settings', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const data = req.body || {};

    for (const key of Object.keys(data)) {
      if (!(ALLOWED_PLATFORM_SETTINGS as readonly string[]).includes(key)) {
        return reply.status(400).send({ error: `Недопустимая настройка: ${key}` });
      }
    }

    await updateAllowedPlatformSettings(data);
    return reply.send({ success: true });
  });
}

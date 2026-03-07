import { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiProviders, aiModels, platformSettings } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';

const PROVIDER_API_KEY_PREFIX = 'provider_apikey_';

export async function aiModelsRoutes(app: FastifyInstance) {
  // Public: list active models (for model selector)
  app.get('/ai-models', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) return reply.status(401).send({ error: 'Не авторизован' });

    const models = await db
      .select({
        id: aiModels.id,
        modelKey: aiModels.modelKey,
        displayName: aiModels.displayName,
        modelType: aiModels.modelType,
        providerId: aiModels.providerId,
        sortOrder: aiModels.sortOrder,
      })
      .from(aiModels)
      .where(eq(aiModels.isActive, true))
      .orderBy(asc(aiModels.sortOrder));

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
      return reply.send(row);
    }
  );

  // Admin: update provider
  app.put<{ Params: { id: string }; Body: { displayName?: string; apiKeyEnv?: string; apiKey?: string; isActive?: boolean } }>(
    '/admin/ai-providers/:id',
    async (req, reply) => {
      const payload = getAuthFromRequest(req);
      if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      const data = req.body || {};
      if (data.apiKey !== undefined && data.apiKey !== '') {
        await db.insert(platformSettings).values({
          key: PROVIDER_API_KEY_PREFIX + req.params.id,
          value: String(data.apiKey),
          description: `API key for provider ${req.params.id}`,
        }).onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: String(data.apiKey), updatedAt: new Date() },
        });
      }
      const [row] = await db.update(aiProviders).set({
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.apiKeyEnv !== undefined && { apiKeyEnv: data.apiKeyEnv }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      }).where(eq(aiProviders.id, req.params.id)).returning();
      if (!row) return reply.status(404).send({ error: 'Not found' });
      return reply.send(row);
    }
  );

  // Admin: get provider API key status (masked)
  app.get<{ Params: { id: string } }>('/admin/ai-providers/:id/apikey', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, PROVIDER_API_KEY_PREFIX + req.params.id));
    return reply.send({ hasKey: !!row?.value, masked: row?.value ? '••••' + String(row.value).slice(-4) : null });
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
      isActive?: boolean; sortOrder?: number;
    };
  }>('/admin/ai-models', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const { providerId, modelKey, displayName, modelType, inputPricePer1k, outputPricePer1k, fixedPrice, isActive, sortOrder } = req.body || {};
    if (!providerId || !modelKey || !displayName || !modelType) return reply.status(400).send({ error: 'Missing required fields' });
    const [row] = await db.insert(aiModels).values({
      providerId, modelKey: modelKey.trim(), displayName: displayName.trim(), modelType,
      inputPricePer1k: inputPricePer1k || '0', outputPricePer1k: outputPricePer1k || '0',
      fixedPrice: fixedPrice || '0', isActive: isActive ?? true, sortOrder: sortOrder ?? 0,
    }).returning();
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
        ...(d.inputPricePer1k !== undefined && { inputPricePer1k: String(d.inputPricePer1k) }),
        ...(d.outputPricePer1k !== undefined && { outputPricePer1k: String(d.outputPricePer1k) }),
        ...(d.fixedPrice !== undefined && { fixedPrice: String(d.fixedPrice) }),
        ...(d.isActive !== undefined && { isActive: Boolean(d.isActive) }),
        ...(d.sortOrder !== undefined && { sortOrder: Number(d.sortOrder) }),
        updatedAt: new Date(),
      }).where(eq(aiModels.id, req.params.id)).returning();
      if (!row) return reply.status(404).send({ error: 'Not found' });
      return reply.send(row);
    }
  );

  // Admin: delete model
  app.delete<{ Params: { id: string } }>('/admin/ai-models/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    await db.delete(aiModels).where(eq(aiModels.id, req.params.id));
    return reply.send({ success: true });
  });

  // Admin: get/update platform settings
  app.get('/admin/settings', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const rows = await db.select().from(platformSettings);
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return reply.send(settings);
  });

  app.put<{ Body: Record<string, string> }>('/admin/settings', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
    const data = req.body || {};
    for (const [key, value] of Object.entries(data)) {
      await db.insert(platformSettings).values({ key, value: String(value) })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: String(value), updatedAt: new Date() } });
    }
    return reply.send({ success: true });
  });
}

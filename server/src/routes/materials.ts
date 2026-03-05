import { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { practicalMaterials } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';

export async function materialsRoutes(app: FastifyInstance) {
  // Get published materials (authenticated)
  app.get('/materials', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const rows = await db
      .select()
      .from(practicalMaterials)
      .where(eq(practicalMaterials.isPublished, true))
      .orderBy(asc(practicalMaterials.sortOrder));
    return reply.send(rows);
  });

  // Admin: get all materials
  app.get('/admin/materials', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const rows = await db.select().from(practicalMaterials).orderBy(asc(practicalMaterials.sortOrder));
    return reply.send(rows);
  });

  // Admin: create material
  app.post<{
    Body: { title: string; description?: string; videoUrl: string; sortOrder?: number; isPublished?: boolean };
  }>('/admin/materials', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { title, description, videoUrl, sortOrder = 0, isPublished = false } = req.body || {};
    if (!title?.trim() || !videoUrl?.trim()) {
      return reply.status(400).send({ error: 'title и videoUrl обязательны' });
    }
    const [row] = await db
      .insert(practicalMaterials)
      .values({ title: title.trim(), description: description?.trim() || null, videoUrl: videoUrl.trim(), sortOrder, isPublished })
      .returning();
    return reply.send(row);
  });

  // Admin: update material
  app.put<{
    Params: { id: string };
    Body: { title?: string; description?: string; videoUrl?: string; sortOrder?: number; isPublished?: boolean };
  }>('/admin/materials/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { id } = req.params;
    const data = req.body || {};
    const [row] = await db
      .update(practicalMaterials)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      })
      .where(eq(practicalMaterials.id, id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: 'Материал не найден' });
    }
    return reply.send(row);
  });

  // Admin: delete material
  app.delete<{ Params: { id: string } }>('/admin/materials/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    await db.delete(practicalMaterials).where(eq(practicalMaterials.id, req.params.id));
    return reply.send({ success: true });
  });
}

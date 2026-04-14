import { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { practicalMaterials } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import { getEffectiveCourseAccess } from '../lib/course-access.js';

export async function materialsRoutes(app: FastifyInstance) {
  // Get published materials
  app.get('/materials', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const access = await getEffectiveCourseAccess(payload.userId);
    const rows = await db
      .select()
      .from(practicalMaterials)
      .where(eq(practicalMaterials.isPublished, true))
      .orderBy(asc(practicalMaterials.sortOrder));
    // Deduplicate by videoUrl (import may have created duplicates)
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const key = (r.videoUrl || '').trim() || r.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return reply.send(unique);
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
    const { title, description, videoUrl = '', sortOrder = 0, isPublished = false } = req.body || {};
    if (!title?.trim()) {
      return reply.status(400).send({ error: 'title обязателен' });
    }
    const [row] = await db
      .insert(practicalMaterials)
      .values({ title: title.trim(), description: description?.trim() || null, videoUrl: String(videoUrl || '').trim() || '', sortOrder, isPublished })
      .returning();
    return reply.send(row);
  });

  // Admin: update material
  app.put<{
    Params: { id: string };
    Body: { title?: string; description?: string; videoUrl?: string; previewUrl?: string; sortOrder?: number; isPublished?: boolean };
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
        ...(data.previewUrl !== undefined && { previewUrl: data.previewUrl }),
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

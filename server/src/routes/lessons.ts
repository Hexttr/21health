import { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { lessonContent } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';

export async function lessonRoutes(app: FastifyInstance) {
  // Get published lessons (authenticated)
  app.get('/lessons', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const rows = await db
      .select()
      .from(lessonContent)
      .where(eq(lessonContent.isPublished, true))
      .orderBy(asc(lessonContent.lessonId));
    return reply.send(rows);
  });

  // Get single lesson by lesson_id
  app.get<{ Params: { lessonId: string } }>('/lessons/:lessonId', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const lessonId = parseInt(req.params.lessonId, 10);
    if (isNaN(lessonId)) {
      return reply.status(400).send({ error: 'Некорректный ID урока' });
    }
    const [row] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    if (!row) {
      return reply.status(404).send({ error: 'Урок не найден' });
    }
    if (!row.isPublished && payload.role !== 'admin') {
      return reply.status(404).send({ error: 'Урок не найден' });
    }
    return reply.send(row);
  });

  // Admin: get all lessons
  app.get('/admin/lessons', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const rows = await db.select().from(lessonContent).orderBy(asc(lessonContent.lessonId));
    return reply.send(rows);
  });

  // Admin: upsert lesson
  app.put<{
    Body: {
      lessonId: number;
      customDescription?: string | null;
      videoUrls?: string[];
      videoPreviewUrls?: string[];
      pdfUrls?: string[];
      additionalMaterials?: string | null;
      aiPrompt?: string | null;
      isPublished?: boolean;
    };
  }>('/admin/lessons', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { lessonId, ...data } = req.body || {};
    if (!lessonId || typeof lessonId !== 'number') {
      return reply.status(400).send({ error: 'lessonId обязателен' });
    }
    const [existing] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    let row;
    if (existing) {
      [row] = await db
        .update(lessonContent)
        .set({
          customDescription: data.customDescription ?? existing.customDescription,
          videoUrls: data.videoUrls ?? existing.videoUrls ?? [],
          videoPreviewUrls: data.videoPreviewUrls ?? existing.videoPreviewUrls ?? [],
          pdfUrls: data.pdfUrls ?? existing.pdfUrls ?? [],
          additionalMaterials: data.additionalMaterials ?? existing.additionalMaterials,
          aiPrompt: data.aiPrompt ?? existing.aiPrompt,
          isPublished: data.isPublished ?? existing.isPublished ?? true,
        })
        .where(eq(lessonContent.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(lessonContent)
        .values({
          lessonId,
          customDescription: data.customDescription ?? null,
          videoUrls: data.videoUrls ?? [],
          videoPreviewUrls: data.videoPreviewUrls ?? [],
          pdfUrls: data.pdfUrls ?? [],
          additionalMaterials: data.additionalMaterials ?? null,
          aiPrompt: data.aiPrompt ?? null,
          isPublished: data.isPublished ?? true,
        })
        .returning();
    }
    return reply.send(row);
  });
}

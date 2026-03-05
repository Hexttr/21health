import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { studentProgress } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';

export async function progressRoutes(app: FastifyInstance) {
  // Get my progress (or specific user's if admin impersonating)
  app.get<{ Querystring: { userId?: string } }>('/progress', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const targetUserId = req.query.userId;
    const userId = targetUserId && payload.role === 'admin' ? targetUserId : payload.userId;
    const rows = await db
      .select()
      .from(studentProgress)
      .where(eq(studentProgress.userId, userId));
    return reply.send(rows);
  });

  // Upsert progress for a lesson
  app.put<{
    Body: { lessonId: number; completed?: boolean; quizCompleted?: boolean };
  }>('/progress', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const { lessonId, completed, quizCompleted } = req.body || {};
    if (!lessonId || typeof lessonId !== 'number') {
      return reply.status(400).send({ error: 'lessonId обязателен' });
    }
    const [existing] = await db
      .select()
      .from(studentProgress)
      .where(and(eq(studentProgress.userId, payload.userId), eq(studentProgress.lessonId, lessonId)));
    const completedAt = completed || quizCompleted ? new Date() : null;
    let row;
    if (existing) {
      [row] = await db
        .update(studentProgress)
        .set({
          completed: completed ?? existing.completed ?? false,
          quizCompleted: quizCompleted ?? existing.quizCompleted ?? false,
          completedAt: completedAt ?? existing.completedAt,
        })
        .where(eq(studentProgress.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(studentProgress)
        .values({
          userId: payload.userId,
          lessonId,
          completed: completed ?? false,
          quizCompleted: quizCompleted ?? false,
          completedAt,
        })
        .returning();
    }
    return reply.send(row);
  });

  // Admin: get all progress
  app.get('/admin/progress', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const rows = await db.select().from(studentProgress);
    return reply.send(rows);
  });
}

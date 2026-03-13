import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { studentProgress } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import { getLessonAccessState } from '../lib/lesson-access.js';

export async function progressRoutes(app: FastifyInstance) {
  // Get my progress (or specific user's if admin impersonating)
  app.get<{ Querystring: { userId?: string } }>('/progress', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    if (payload.role === 'ai_user') {
      return reply.send([]);
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
    if (payload.role === 'ai_user') {
      return reply.status(403).send({ error: 'Доступ к урокам недоступен для этого типа аккаунта' });
    }
    const { lessonId, completed, quizCompleted } = req.body || {};
    if (!lessonId || typeof lessonId !== 'number') {
      return reply.status(400).send({ error: 'lessonId обязателен' });
    }
    const [existing] = await db
      .select()
      .from(studentProgress)
      .where(and(eq(studentProgress.userId, payload.userId), eq(studentProgress.lessonId, lessonId)));

    const accessState = await getLessonAccessState(payload.userId, lessonId, payload.role);
    if (!accessState.lessonExists) {
      return reply.status(404).send({ error: 'Урок не найден' });
    }
    if (!accessState.isPublished && payload.role !== 'admin') {
      return reply.status(404).send({ error: 'Урок не найден' });
    }
    if (!accessState.canAccess && payload.role !== 'admin') {
      return reply.status(423).send({
        error: 'Нельзя сохранить прогресс: сначала завершите AI-тест по предыдущему уроку',
        previousLessonId: accessState.previousLessonId,
      });
    }

    if (completed === true && quizCompleted !== true && !existing?.quizCompleted) {
      return reply.status(400).send({ error: 'Урок считается завершенным только после AI-теста' });
    }

    const nextQuizCompleted = quizCompleted ?? existing?.quizCompleted ?? false;
    const nextCompleted = nextQuizCompleted || (completed ?? existing?.completed ?? false);
    const completedAt = nextQuizCompleted || nextCompleted ? new Date() : null;

    let row;
    if (existing) {
      [row] = await db
        .update(studentProgress)
        .set({
          completed: nextCompleted,
          quizCompleted: nextQuizCompleted,
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
          completed: nextCompleted,
          quizCompleted: nextQuizCompleted,
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

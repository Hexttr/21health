import { FastifyInstance } from 'fastify';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { lessonContent, studentProgress } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import { getLessonAccessState } from '../lib/lesson-access.js';
import { getEffectiveCourseAccess } from '../lib/course-access.js';
import { buildQuizInitializationPrompt } from '../lib/ai/prompt-builder.js';

export async function lessonRoutes(app: FastifyInstance) {
  // Get published lessons (authenticated, ai_user — нет доступа)
  app.get<{ Querystring: { viewMode?: string; userId?: string } }>('/lessons', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const targetUserId = payload.role === 'admin' && req.query.userId ? req.query.userId : payload.userId;
    const access = await getEffectiveCourseAccess(targetUserId);

    const viewMode = req.query.viewMode === 'all' ? 'all' : 'student';
    const bypassAllRestrictions = payload.role === 'admin' && !req.query.userId && viewMode === 'all';

    const rows = await db.select().from(lessonContent).orderBy(asc(lessonContent.lessonId));
    if (bypassAllRestrictions) {
      return reply.send(rows);
    }

    const completedRows = await db
      .select({ lessonId: studentProgress.lessonId })
      .from(studentProgress)
      .where(
        and(
          eq(studentProgress.userId, targetUserId),
          eq(studentProgress.quizCompleted, true)
        )
      );

    const completedLessonIds = new Set(completedRows.map((row) => row.lessonId));
    const maxVisibleLessons = access.role === 'ai_user' ? 21 : access.grantedLessons;
    const visibleRows = rows.filter((row) => {
      if (access.role === 'ai_user') {
        return true;
      }
      if (row.lessonId > maxVisibleLessons) {
        return false;
      }
      return row.isPublished || completedLessonIds.has(row.lessonId);
    });

    return reply.send(visibleRows);
  });

  // Get single lesson by lesson_id
  app.get<{ Params: { lessonId: string }; Querystring: { viewMode?: string; userId?: string } }>('/lessons/:lessonId', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const lessonId = parseInt(req.params.lessonId, 10);
    if (isNaN(lessonId)) {
      return reply.status(400).send({ error: 'Некорректный ID урока' });
    }

    const targetUserId = payload.role === 'admin' && req.query.userId ? req.query.userId : payload.userId;
    const access = await getEffectiveCourseAccess(targetUserId);
    if (access.role === 'ai_user') {
      return reply.status(403).send({ error: 'Приобретите доступ к курсу, чтобы открыть урок' });
    }

    if (access.role !== 'admin' && lessonId > access.grantedLessons) {
      return reply.status(403).send({ error: 'Для доступа к этому уроку требуется более полный тариф курса' });
    }

    const viewMode = req.query.viewMode === 'all' ? 'all' : 'student';
    const accessState = await getLessonAccessState(targetUserId, lessonId, {
      bypassAllRestrictions: payload.role === 'admin' && !req.query.userId && viewMode === 'all',
    });
    if (!accessState.lessonExists) {
      return reply.status(404).send({ error: 'Урок не найден' });
    }

    if (!accessState.isPublished && !accessState.canAccess) {
      return reply.status(404).send({ error: 'Урок не найден' });
    }

    if (!accessState.canAccess) {
      return reply.status(423).send({
        error: 'Сначала завершите AI-тест по предыдущему уроку',
        previousLessonId: accessState.previousLessonId,
      });
    }

    const [row] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    if (!row) {
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
      videoTitles?: string[];
      videoPreviewUrls?: string[];
      pdfUrls?: string[];
      additionalMaterials?: string | null;
      aiPrompt?: string | null;
      aiPromptIsOverride?: boolean;
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
          videoTitles: data.videoTitles ?? existing.videoTitles ?? [],
          videoPreviewUrls: data.videoPreviewUrls ?? existing.videoPreviewUrls ?? [],
          pdfUrls: data.pdfUrls ?? existing.pdfUrls ?? [],
          additionalMaterials: data.additionalMaterials ?? existing.additionalMaterials,
          aiPrompt: data.aiPrompt ?? existing.aiPrompt,
          aiPromptIsOverride: data.aiPromptIsOverride ?? existing.aiPromptIsOverride ?? false,
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
          videoTitles: data.videoTitles ?? [],
          videoPreviewUrls: data.videoPreviewUrls ?? [],
          pdfUrls: data.pdfUrls ?? [],
          additionalMaterials: data.additionalMaterials ?? null,
          aiPrompt: data.aiPrompt ?? null,
          aiPromptIsOverride: data.aiPromptIsOverride ?? false,
          isPublished: data.isPublished ?? true,
        })
        .returning();
    }
    return reply.send(row);
  });

  app.post<{
    Body: {
      lessonTitle: string;
      lessonDescription: string;
      videoTopics?: string[];
      customPrompt?: string | null;
    };
  }>('/admin/lessons/quiz-prompt-preview', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }

    const { lessonTitle, lessonDescription, videoTopics = [], customPrompt } = req.body || {};
    if (!lessonTitle || !lessonDescription) {
      return reply.status(400).send({ error: 'lessonTitle и lessonDescription обязательны' });
    }

    return reply.send({
      prompt: buildQuizInitializationPrompt({
        lessonTitle,
        lessonDescription,
        videoTopics,
        customPrompt: customPrompt ?? undefined,
      }),
    });
  });
}

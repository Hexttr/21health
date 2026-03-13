import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { lessonContent, studentProgress } from '../db/schema.js';

export type LessonAccessReason = 'ok' | 'not_found' | 'unpublished' | 'previous_quiz_incomplete';

export interface LessonAccessState {
  canAccess: boolean;
  reason: LessonAccessReason;
  lessonExists: boolean;
  isPublished: boolean;
  previousLessonId: number | null;
}

export async function getLessonAccessState(userId: string, lessonId: number, role?: string): Promise<LessonAccessState> {
  const [lesson] = await db
    .select({
      lessonId: lessonContent.lessonId,
      isPublished: lessonContent.isPublished,
    })
    .from(lessonContent)
    .where(eq(lessonContent.lessonId, lessonId));

  if (!lesson) {
    return {
      canAccess: false,
      reason: 'not_found',
      lessonExists: false,
      isPublished: false,
      previousLessonId: null,
    };
  }

  if (role === 'admin') {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: Boolean(lesson.isPublished),
      previousLessonId: null,
    };
  }

  if (!lesson.isPublished) {
    return {
      canAccess: false,
      reason: 'unpublished',
      lessonExists: true,
      isPublished: false,
      previousLessonId: null,
    };
  }

  const publishedLessons = await db
    .select({ lessonId: lessonContent.lessonId })
    .from(lessonContent)
    .where(eq(lessonContent.isPublished, true))
    .orderBy(asc(lessonContent.lessonId));

  const publishedLessonIds = publishedLessons.map((item) => item.lessonId);
  const lessonIndex = publishedLessonIds.indexOf(lessonId);

  if (lessonIndex === -1) {
    return {
      canAccess: false,
      reason: 'unpublished',
      lessonExists: true,
      isPublished: false,
      previousLessonId: null,
    };
  }

  if (lessonIndex === 0) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: true,
      previousLessonId: null,
    };
  }

  const previousLessonId = publishedLessonIds[lessonIndex - 1] ?? null;
  if (!previousLessonId) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: true,
      previousLessonId: null,
    };
  }

  const progressRows = await db
    .select({
      lessonId: studentProgress.lessonId,
      quizCompleted: studentProgress.quizCompleted,
    })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.userId, userId),
        inArray(studentProgress.lessonId, [previousLessonId, lessonId])
      )
    );

  const currentLessonProgress = progressRows.find((row) => row.lessonId === lessonId);
  if (currentLessonProgress) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: true,
      previousLessonId,
    };
  }

  const previousLessonProgress = progressRows.find((row) => row.lessonId === previousLessonId);
  if (previousLessonProgress?.quizCompleted) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: true,
      previousLessonId,
    };
  }

  return {
    canAccess: false,
    reason: 'previous_quiz_incomplete',
    lessonExists: true,
    isPublished: true,
    previousLessonId,
  };
}

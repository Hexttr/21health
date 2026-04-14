import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { lessonContent, studentProgress } from '../db/schema.js';
import { getEffectiveCourseAccess } from './course-access.js';

export type LessonAccessReason = 'ok' | 'not_found' | 'unpublished' | 'previous_quiz_incomplete';

export interface LessonAccessState {
  canAccess: boolean;
  reason: LessonAccessReason;
  lessonExists: boolean;
  isPublished: boolean;
  previousLessonId: number | null;
}

interface LessonAccessOptions {
  bypassAllRestrictions?: boolean;
}

export async function getLessonAccessState(
  userId: string,
  lessonId: number,
  options: LessonAccessOptions = {}
): Promise<LessonAccessState> {
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

  if (options.bypassAllRestrictions) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: Boolean(lesson.isPublished),
      previousLessonId: null,
    };
  }

  const access = await getEffectiveCourseAccess(userId);
  if (lessonId > access.grantedLessons) {
    return {
      canAccess: false,
      reason: 'previous_quiz_incomplete',
      lessonExists: true,
      isPublished: Boolean(lesson.isPublished),
      previousLessonId: lessonId > 1 ? lessonId - 1 : null,
    };
  }

  const previousLessonId = lessonId > 1 ? lessonId - 1 : null;
  const progressLessonIds = previousLessonId ? [previousLessonId, lessonId] : [lessonId];
  const progressRows = await db
    .select({
      lessonId: studentProgress.lessonId,
      quizCompleted: studentProgress.quizCompleted,
      completed: studentProgress.completed,
    })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.userId, userId),
        inArray(studentProgress.lessonId, progressLessonIds)
      )
    );

  const currentLessonProgress = progressRows.find((row) => row.lessonId === lessonId);

  if (!lesson.isPublished && !currentLessonProgress?.quizCompleted) {
    return {
      canAccess: false,
      reason: 'unpublished',
      lessonExists: true,
      isPublished: false,
      previousLessonId,
    };
  }

  if (lessonId === 1) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: Boolean(lesson.isPublished),
      previousLessonId: null,
    };
  }

  if (lesson.isPublished && currentLessonProgress) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: Boolean(lesson.isPublished),
      previousLessonId,
    };
  }

  const previousLessonProgress = progressRows.find((row) => row.lessonId === previousLessonId);
  if (previousLessonProgress?.quizCompleted) {
    return {
      canAccess: true,
      reason: 'ok',
      lessonExists: true,
      isPublished: Boolean(lesson.isPublished),
      previousLessonId,
    };
  }

  return {
    canAccess: false,
    reason: 'previous_quiz_incomplete',
    lessonExists: true,
    isPublished: Boolean(lesson.isPublished),
    previousLessonId,
  };
}

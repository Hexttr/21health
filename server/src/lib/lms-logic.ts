import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  lmsCourseModule,
  lmsItemProgress,
  lmsModuleItem,
  lmsTestAttempt,
} from '../db/schema.js';

export async function getCourseItemOrder(courseId: string): Promise<string[]> {
  const modules = await db
    .select()
    .from(lmsCourseModule)
    .where(eq(lmsCourseModule.courseId, courseId))
    .orderBy(asc(lmsCourseModule.sortOrder));

  const ids: string[] = [];
  for (const mod of modules) {
    const items = await db
      .select()
      .from(lmsModuleItem)
      .where(eq(lmsModuleItem.moduleId, mod.id))
      .orderBy(asc(lmsModuleItem.sortOrder));
    for (const it of items) {
      ids.push(it.id);
    }
  }
  return ids;
}

export async function initializeItemProgress(
  enrollmentId: string,
  courseId: string,
  enforceSequence: boolean,
): Promise<void> {
  const ordered = await getCourseItemOrder(courseId);
  if (ordered.length === 0) return;

  const rows = ordered.map((moduleItemId, idx) => ({
    enrollmentId,
    moduleItemId,
    status:
      !enforceSequence || idx === 0
        ? ('available' as const)
        : ('locked' as const),
  }));

  await db.insert(lmsItemProgress).values(rows).onConflictDoNothing();
}

/** Ensure first item is available when sequence enforced */
export async function ensureProgressRows(
  enrollmentId: string,
  courseId: string,
  enforceSequence: boolean,
): Promise<void> {
  const existing = await db
    .select()
    .from(lmsItemProgress)
    .where(eq(lmsItemProgress.enrollmentId, enrollmentId))
    .limit(1);
  if (existing.length === 0) {
    await initializeItemProgress(enrollmentId, courseId, enforceSequence);
  }
}

export async function markItemCompleted(
  enrollmentId: string,
  moduleItemId: string,
  courseId: string,
  enforceSequence: boolean,
): Promise<void> {
  await db
    .update(lmsItemProgress)
    .set({ status: 'completed', completedAt: new Date() })
    .where(
      and(eq(lmsItemProgress.enrollmentId, enrollmentId), eq(lmsItemProgress.moduleItemId, moduleItemId)),
    );

  if (!enforceSequence) return;

  const ordered = await getCourseItemOrder(courseId);
  const idx = ordered.indexOf(moduleItemId);
  if (idx < 0 || idx >= ordered.length - 1) return;
  const nextId = ordered[idx + 1];

  await db
    .update(lmsItemProgress)
    .set({ status: 'available' })
    .where(
      and(eq(lmsItemProgress.enrollmentId, enrollmentId), eq(lmsItemProgress.moduleItemId, nextId)),
    );
}

export function scoreTestAnswers(
  questions: Array<{ id: string; questionType: string; body: unknown }>,
  answers: Record<string, unknown>,
  passScorePercent: number,
): { scorePercent: number; passed: boolean } {
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    total += 1;
    const a = answers[q.id];
    const body = q.body as Record<string, unknown>;
    if (q.questionType === 'single') {
      const correct = body.correctIndex as number;
      if (typeof a === 'number' && a === correct) earned += 1;
    } else if (q.questionType === 'multi') {
      const correctSet = new Set(body.correctIndices as number[]);
      const sel = Array.isArray(a) ? (a as number[]) : [];
      const selSet = new Set(sel);
      if (
        correctSet.size === selSet.size &&
        [...correctSet].every((x) => selSet.has(x))
      ) {
        earned += 1;
      }
    } else {
      // open: MVP — за заполнение
      if (typeof a === 'string' && a.trim().length > 0) earned += 1;
    }
  }
  const scorePercent = total === 0 ? 0 : Math.round((earned / total) * 100);
  return { scorePercent, passed: scorePercent >= passScorePercent };
}

export async function countRecentAttempts(
  testId: string,
  enrollmentId: string,
  userId: string,
  since: Date,
): Promise<number> {
  const attempts = await db
    .select()
    .from(lmsTestAttempt)
    .where(
      and(
        eq(lmsTestAttempt.testId, testId),
        eq(lmsTestAttempt.enrollmentId, enrollmentId),
        eq(lmsTestAttempt.userId, userId),
      ),
    );
  return attempts.filter((t) => t.startedAt && new Date(t.startedAt) >= since).length;
}

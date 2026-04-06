import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { courseAccess, courseOrders, courses, userRoles } from '../db/schema.js';
import { setUserRoleWithStudentBonus } from './student-role-bonus.js';

type StoredUserRole = 'admin' | 'student' | 'student_14' | 'student_21' | 'ai_user';
export type AppRole = 'admin' | 'student_14' | 'student_21' | 'ai_user';

export interface EffectiveCourseAccess {
  role: AppRole;
  courseCode: string | null;
  courseTitle: string | null;
  grantedLessons: number;
  hasCourseAccess: boolean;
  canUpgradeTo21: boolean;
}

function normalizeRole(role: StoredUserRole | null | undefined): AppRole {
  if (role === 'student') {
    return 'student_21';
  }
  return role ?? 'ai_user';
}

function resolveStudentRoleByLessons(grantedLessons: number): AppRole {
  if (grantedLessons >= 21) {
    return 'student_21';
  }
  if (grantedLessons > 0) {
    return 'student_14';
  }
  return 'ai_user';
}

export async function getUserRole(userId: string): Promise<AppRole> {
  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return normalizeRole(roleRow?.role as StoredUserRole | undefined);
}

export async function getCourseByCode(code: string) {
  const [course] = await db.select().from(courses).where(eq(courses.code, code));
  return course ?? null;
}

export async function listActiveCourses() {
  return db.select().from(courses).where(eq(courses.isActive, true)).orderBy(courses.sortOrder);
}

export async function getEffectiveCourseAccess(userId: string): Promise<EffectiveCourseAccess> {
  const role = await getUserRole(userId);
  if (role === 'admin') {
    const fullCourse = await getCourseByCode('course_21');
    return {
      role,
      courseCode: fullCourse?.code ?? 'course_21',
      courseTitle: fullCourse?.title ?? 'Полный курс — 21 день',
      grantedLessons: 21,
      hasCourseAccess: true,
      canUpgradeTo21: false,
    };
  }

  const [accessRow] = await db
    .select({
      grantedLessons: courseAccess.grantedLessons,
      courseCode: courses.code,
      courseTitle: courses.title,
    })
    .from(courseAccess)
    .innerJoin(courses, eq(courseAccess.courseId, courses.id))
    .where(and(eq(courseAccess.userId, userId), eq(courseAccess.status, 'active')))
    .orderBy(desc(courseAccess.grantedLessons))
    .limit(1);

  if (accessRow) {
    const derivedRole = resolveStudentRoleByLessons(accessRow.grantedLessons);
    return {
      role: derivedRole,
      courseCode: accessRow.courseCode,
      courseTitle: accessRow.courseTitle,
      grantedLessons: accessRow.grantedLessons,
      hasCourseAccess: accessRow.grantedLessons > 0,
      canUpgradeTo21: accessRow.grantedLessons < 21,
    };
  }

  // Compatibility for legacy students created before course entitlements existed.
  if (role === 'student_21') {
    const fullCourse = await getCourseByCode('course_21');
    return {
      role,
      courseCode: fullCourse?.code ?? 'course_21',
      courseTitle: fullCourse?.title ?? 'Полный курс — 21 день',
      grantedLessons: 21,
      hasCourseAccess: true,
      canUpgradeTo21: false,
    };
  }

  if (role === 'student_14') {
    const introCourse = await getCourseByCode('course_14');
    return {
      role,
      courseCode: introCourse?.code ?? 'course_14',
      courseTitle: introCourse?.title ?? 'Курс — 14 дней',
      grantedLessons: 14,
      hasCourseAccess: true,
      canUpgradeTo21: true,
    };
  }

  return {
    role,
    courseCode: null,
    courseTitle: null,
    grantedLessons: 0,
    hasCourseAccess: false,
    canUpgradeTo21: false,
  };
}

export async function syncUserRoleWithAccess(userId: string): Promise<AppRole> {
  const currentRole = await getUserRole(userId);
  if (currentRole === 'admin') {
    return currentRole;
  }

  const access = await getEffectiveCourseAccess(userId);
  const nextRole = resolveStudentRoleByLessons(access.grantedLessons);
  await setUserRoleWithStudentBonus(userId, nextRole);

  return nextRole;
}

export async function applyAdminRoleAssignment(userId: string, role: AppRole): Promise<{ role: AppRole; bonusAwardedTokens: number }> {
  if (role === 'admin') {
    return setUserRoleWithStudentBonus(userId, role);
  }

  if (role === 'ai_user') {
    const [existingAccess] = await db.select().from(courseAccess).where(eq(courseAccess.userId, userId));
    if (existingAccess) {
      await db
        .update(courseAccess)
        .set({
          status: 'revoked',
          updatedAt: new Date(),
        })
        .where(eq(courseAccess.id, existingAccess.id));
    }
    return setUserRoleWithStudentBonus(userId, 'ai_user');
  }

  const targetCourseCode = role === 'student_21' ? 'course_21' : 'course_14';
  const targetCourse = await getCourseByCode(targetCourseCode);
  if (!targetCourse) {
    throw new Error(`Курс ${targetCourseCode} не найден`);
  }

  const [existingAccess] = await db.select().from(courseAccess).where(eq(courseAccess.userId, userId));
  if (existingAccess) {
    await db
      .update(courseAccess)
      .set({
        courseId: targetCourse.id,
        grantedLessons: role === 'student_21' ? 21 : 14,
        source: 'admin',
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(courseAccess.id, existingAccess.id));
  } else {
    await db.insert(courseAccess).values({
      userId,
      courseId: targetCourse.id,
      grantedLessons: role === 'student_21' ? 21 : 14,
      source: 'admin',
      status: 'active',
      orderId: null,
    });
  }

  return setUserRoleWithStudentBonus(userId, role);
}

interface GrantCourseAccessInput {
  userId: string;
  courseId: string;
  grantedLessons: number;
  source: 'purchase' | 'upgrade' | 'admin' | 'bonus';
  orderId?: string | null;
}

export async function grantCourseAccess(input: GrantCourseAccessInput) {
  const [existing] = await db.select().from(courseAccess).where(eq(courseAccess.userId, input.userId));

  if (existing) {
    await db
      .update(courseAccess)
      .set({
        courseId: input.courseId,
        grantedLessons: Math.max(existing.grantedLessons, input.grantedLessons),
        source: input.source,
        status: 'active',
        orderId: input.orderId ?? existing.orderId,
        updatedAt: new Date(),
      })
      .where(eq(courseAccess.id, existing.id));
  } else {
    await db.insert(courseAccess).values({
      userId: input.userId,
      courseId: input.courseId,
      grantedLessons: input.grantedLessons,
      source: input.source,
      status: 'active',
      orderId: input.orderId ?? null,
    });
  }

  await syncUserRoleWithAccess(input.userId);
}

export async function createCourseOrder(params: {
  userId: string;
  courseId: string;
  sourceCourseId?: string | null;
  orderType: 'purchase' | 'upgrade';
  expectedAmountRub: string;
}) {
  const [order] = await db.insert(courseOrders).values({
    userId: params.userId,
    courseId: params.courseId,
    sourceCourseId: params.sourceCourseId ?? null,
    orderType: params.orderType,
    expectedAmountRub: params.expectedAmountRub,
    status: 'pending',
  }).returning();

  return order;
}

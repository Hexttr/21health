import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userRoles } from '../db/schema.js';

export type AppRole = 'admin' | 'student';

export interface EffectiveCourseAccess {
  role: AppRole;
  courseCode: string | null;
  courseTitle: string | null;
  grantedLessons: number;
  hasCourseAccess: boolean;
  canUpgradeTo21: boolean;
}

export async function getUserRole(userId: string): Promise<AppRole> {
  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return (roleRow?.role as AppRole | undefined) ?? 'student';
}

export async function getEffectiveCourseAccess(userId: string): Promise<EffectiveCourseAccess> {
  const role = await getUserRole(userId);
  return {
    role,
    courseCode: 'free_course',
    courseTitle: 'Бесплатный курс',
    grantedLessons: 21,
    hasCourseAccess: true,
    canUpgradeTo21: false,
  };
}

export async function syncUserRoleWithAccess(userId: string): Promise<AppRole> {
  const currentRole = await getUserRole(userId);
  if (currentRole === 'admin') {
    return currentRole;
  }

  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (roleRow && roleRow.role !== 'student') {
    await db.update(userRoles).set({ role: 'student' }).where(eq(userRoles.id, roleRow.id));
  }

  return 'student';
}

export async function applyAdminRoleAssignment(userId: string, role: AppRole): Promise<{ role: AppRole; bonusAwardedTokens: number }> {
  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (!roleRow) {
    throw new Error('Роль пользователя не найдена');
  }

  await db.update(userRoles).set({ role }).where(eq(userRoles.id, roleRow.id));

  return {
    role,
    bonusAwardedTokens: 0,
  };
}

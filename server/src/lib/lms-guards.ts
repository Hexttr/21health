import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userRoles } from '../db/schema.js';

export async function fetchUserRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

export function isAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

export function isAdminOrTutor(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('tutor');
}

export function isStaffAnalytics(roles: string[]): boolean {
  return (
    roles.includes('admin') ||
    roles.includes('tutor') ||
    roles.includes('department_head') ||
    roles.includes('mentor')
  );
}

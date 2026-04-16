/** LMS + legacy roles stored in user_roles.role */
export const ROLE_PRIORITY = [
  'admin',
  'tutor',
  'department_head',
  'mentor',
  'learner',
  'student',
] as const;

export type AppRole =
  | 'admin'
  | 'tutor'
  | 'learner'
  | 'department_head'
  | 'mentor'
  | 'student';

export function normalizeRole(r: string): string {
  return r === 'student' ? 'learner' : r;
}

export function pickPrimaryRole(roles: string[]): AppRole {
  const set = new Set(roles.map(normalizeRole));
  for (const p of ROLE_PRIORITY) {
    const key = p === 'student' ? 'learner' : p;
    if (set.has(key)) {
      if (p === 'student' || p === 'learner') return 'learner';
      return p as AppRole;
    }
  }
  return 'learner';
}

export function hasRole(roles: string[], allowed: AppRole[]): boolean {
  const n = roles.map(normalizeRole);
  return allowed.some((a) => n.includes(a === 'student' ? 'learner' : a));
}

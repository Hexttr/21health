import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  userRoles,
  users,
} from '../db/schema.js';
import { hashPassword, signToken } from './auth.js';
import { pickPrimaryRole, type AppRole } from './roles.js';

export type { AppRole };

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  roles: AppRole[];
}

export interface AuthSuccessResponse {
  token: string;
  user: AuthUserDto;
}

interface CreateUserFromAuthIdentityInput {
  email: string;
  name: string;
  password?: string;
  passwordHash?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    return trimmed;
  }

  const localPart = email.split('@')[0]?.trim();
  return localPart || 'Пользователь';
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
  return user ?? null;
}

export async function loadAuthUserById(userId: string): Promise<AuthUserDto | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return null;
  }

  const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const rolesRaw = roleRows.map((r) => r.role);
  const role = pickPrimaryRole(rolesRaw);
  const roles = rolesRaw.map((r) => (r === 'student' ? 'learner' : r)) as AppRole[];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    roles: roles.length ? [...new Set(roles)] : ['learner'],
  };
}

export async function buildAuthSuccessForUserId(userId: string): Promise<AuthSuccessResponse> {
  const authUser = await loadAuthUserById(userId);
  if (!authUser) {
    throw new Error('Пользователь не найден');
  }

  const [user] = await db.select({ isBlocked: users.isBlocked }).from(users).where(eq(users.id, userId));
  if (user?.isBlocked) {
    throw new Error('Аккаунт заблокирован');
  }

  return {
    token: signToken({
      userId: authUser.id,
      email: authUser.email,
      role: authUser.role,
    }),
    user: authUser,
  };
}

export async function createUserFromAuthIdentity(input: CreateUserFromAuthIdentityInput) {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name, email);

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('Пользователь с таким email уже существует');
  }

  const passwordHash = input.passwordHash
    || await hashPassword(input.password || '');

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name,
    })
    .returning();

  if (!newUser) {
    throw new Error('Ошибка создания пользователя');
  }

  await db.insert(userRoles).values({ userId: newUser.id, role: 'learner' });

  return {
    user: newUser,
    role: 'learner' as const,
  };
}

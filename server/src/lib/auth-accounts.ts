import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  invitationCodes,
  oauthIdentities,
  referralCodes,
  userRoles,
  users,
} from '../db/schema.js';
import { hashPassword, signToken } from './auth.js';
import { createReferralAttribution, ensureReferralCode } from './referrals.js';
import { normalizePhone } from './phone-verification.js';

export type AppRole = 'admin' | 'student_14' | 'student_21' | 'ai_user';
export type SocialProvider = 'vkid';

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  phone: string | null;
  phoneVerifiedAt: Date | null;
}

export interface AuthSuccessResponse {
  token: string;
  user: AuthUserDto;
}

export interface AccessCodeValidationResult {
  valid: boolean;
  codeId?: string;
  codeType?: 'invitation' | 'referral';
  error?: string;
}

interface ResolvedSignupContext {
  role: 'student_21' | 'ai_user';
  invitationCodeId: string | null;
  referralCode: string | null;
}

interface CreateUserFromAuthIdentityInput {
  email: string;
  name: string;
  password?: string;
  passwordHash?: string;
  phone?: string | null;
  accessCode?: string;
  invitationCode?: string;
  referralCode?: string;
}

interface LinkSocialIdentityInput {
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  providerEmail?: string | null;
  providerEmailVerified?: boolean;
  rawProfileJson?: string | null;
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

function generateInternalPassword(): string {
  return randomBytes(32).toString('base64url');
}

export async function validateAccessCode(code: string): Promise<AccessCodeValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, error: 'Код обязателен' };
  }

  const [invitationRow] = await db
    .select()
    .from(invitationCodes)
    .where(and(eq(invitationCodes.code, normalized), eq(invitationCodes.isActive, true)));
  if (invitationRow) {
    return { valid: true, codeId: invitationRow.id, codeType: 'invitation' };
  }

  const [referralRow] = await db
    .select()
    .from(referralCodes)
    .where(and(eq(referralCodes.code, normalized), eq(referralCodes.isActive, true)));
  if (referralRow) {
    return { valid: true, codeId: referralRow.id, codeType: 'referral' };
  }

  return { valid: false, error: 'Недействительный или неактивный код' };
}

async function resolveSignupContext(params: {
  accessCode?: string;
  invitationCode?: string;
  referralCode?: string;
}): Promise<ResolvedSignupContext> {
  let role: 'student_21' | 'ai_user' = 'ai_user';
  let invitationCodeId: string | null = null;
  let normalizedReferralCode = params.referralCode?.trim().toUpperCase() || null;
  const normalizedInvitationCode = params.invitationCode?.trim().toUpperCase() || null;
  const normalizedAccessCode = params.accessCode?.trim().toUpperCase() || null;

  if (!normalizedReferralCode && normalizedAccessCode) {
    const [referralRow] = await db
      .select()
      .from(referralCodes)
      .where(and(eq(referralCodes.code, normalizedAccessCode), eq(referralCodes.isActive, true)));
    if (referralRow) {
      normalizedReferralCode = normalizedAccessCode;
    }
  }

  const invitationCandidate = normalizedInvitationCode || (
    normalizedAccessCode && normalizedAccessCode !== normalizedReferralCode
      ? normalizedAccessCode
      : null
  );

  if (invitationCandidate) {
    const [codeRow] = await db
      .select()
      .from(invitationCodes)
      .where(and(eq(invitationCodes.code, invitationCandidate), eq(invitationCodes.isActive, true)));

    if (!codeRow) {
      throw new Error('Недействительный код доступа');
    }

    invitationCodeId = codeRow.id;
    role = 'student_21';
  } else if (normalizedAccessCode && !normalizedReferralCode) {
    throw new Error('Недействительный код доступа');
  }

  return {
    role,
    invitationCodeId,
    referralCode: normalizedReferralCode,
  };
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

  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const role = (roleRow?.role as AppRole) || 'ai_user';

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt,
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

  let normalizedPhone: string | null = null;
  if (input.phone?.trim()) {
    normalizedPhone = normalizePhone(input.phone);
    const [phoneOwner] = await db.select().from(users).where(eq(users.phone, normalizedPhone));
    if (phoneOwner) {
      throw new Error('Пользователь с таким телефоном уже существует');
    }
  }

  const signupContext = await resolveSignupContext({
    accessCode: input.accessCode,
    invitationCode: input.invitationCode,
    referralCode: input.referralCode,
  });

  const passwordHash = input.passwordHash
    || await hashPassword(input.password || generateInternalPassword());

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name,
      phone: normalizedPhone,
      invitationCodeId: signupContext.invitationCodeId,
    })
    .returning();

  if (!newUser) {
    throw new Error('Ошибка создания пользователя');
  }

  await db.insert(userRoles).values({ userId: newUser.id, role: signupContext.role });
  await ensureReferralCode(newUser.id);

  if (signupContext.referralCode) {
    await createReferralAttribution({
      referralCode: signupContext.referralCode,
      refereeUserId: newUser.id,
    });
  }

  return {
    user: newUser,
    role: signupContext.role,
  };
}

export async function findOauthIdentity(provider: SocialProvider, providerUserId: string) {
  const [identity] = await db
    .select()
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerUserId, providerUserId)));

  return identity ?? null;
}

export async function linkSocialIdentity(input: LinkSocialIdentityInput) {
  const existingByProviderUser = await findOauthIdentity(input.provider, input.providerUserId);
  if (existingByProviderUser) {
    return existingByProviderUser;
  }

  const [existingForUser] = await db
    .select()
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.userId, input.userId), eq(oauthIdentities.provider, input.provider)));

  if (existingForUser) {
    await db
      .update(oauthIdentities)
      .set({
        providerUserId: input.providerUserId,
        providerEmail: input.providerEmail?.trim().toLowerCase() || null,
        providerEmailVerified: Boolean(input.providerEmailVerified),
        rawProfileJson: input.rawProfileJson || null,
        updatedAt: new Date(),
      })
      .where(eq(oauthIdentities.id, existingForUser.id));

    const refreshed = await findOauthIdentity(input.provider, input.providerUserId);
    if (!refreshed) {
      throw new Error('Не удалось обновить социальную привязку');
    }
    return refreshed;
  }

  try {
    const [created] = await db
      .insert(oauthIdentities)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerUserId: input.providerUserId,
        providerEmail: input.providerEmail?.trim().toLowerCase() || null,
        providerEmailVerified: Boolean(input.providerEmailVerified),
        rawProfileJson: input.rawProfileJson || null,
      })
      .returning();

    if (!created) {
      throw new Error('Не удалось создать социальную привязку');
    }

    return created;
  } catch {
    const fallback = await findOauthIdentity(input.provider, input.providerUserId);
    if (!fallback) {
      throw new Error('Не удалось сохранить социальную привязку');
    }
    return fallback;
  }
}

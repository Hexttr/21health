import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userRoles, invitationCodes, referralCodes } from '../db/schema.js';
import { hashPassword, verifyPassword, signToken, getAuthFromRequest } from '../lib/auth.js';
import { createReferralAttribution, ensureReferralCode } from '../lib/referrals.js';
import { normalizePhone } from '../lib/phone-verification.js';

export async function authRoutes(app: FastifyInstance) {
  // Validate invitation code (public)
  app.post<{
    Body: { code: string };
  }>('/auth/validate-code', async (req, reply) => {
    const { code } = req.body || {};
    if (!code?.trim()) {
      return reply.status(400).send({ valid: false, error: 'Код обязателен' });
    }
    const normalized = code.trim().toUpperCase();
    const [invitationRow] = await db
      .select()
      .from(invitationCodes)
      .where(and(eq(invitationCodes.code, normalized), eq(invitationCodes.isActive, true)));
    if (invitationRow) {
      return reply.send({ valid: true, codeId: invitationRow.id, codeType: 'invitation' as const });
    }

    const [referralRow] = await db
      .select()
      .from(referralCodes)
      .where(and(eq(referralCodes.code, normalized), eq(referralCodes.isActive, true)));
    if (referralRow) {
      return reply.send({ valid: true, codeId: referralRow.id, codeType: 'referral' as const });
    }

    return reply.send({ valid: false, error: 'Недействительный или неактивный код' });
  });

  // Sign up
  app.post<{
    Body: { email: string; password: string; name: string; accessCode?: string; invitationCode?: string; referralCode?: string; phone?: string };
  }>('/auth/signup', async (req, reply) => {
    const { email, password, name, accessCode, invitationCode, referralCode, phone } = req.body || {};
    if (!email?.trim() || !password || !name?.trim()) {
      return reply.status(400).send({ error: 'Заполните все поля' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Пароль минимум 6 символов' });
    }
    const [existing] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    if (existing) {
      return reply.status(400).send({ error: 'Пользователь с таким email уже существует' });
    }

    let normalizedPhone: string | null = null;
    if (phone?.trim()) {
      normalizedPhone = normalizePhone(phone);
      const [phoneOwner] = await db.select().from(users).where(eq(users.phone, normalizedPhone));
      if (phoneOwner) {
        return reply.status(400).send({ error: 'Пользователь с таким телефоном уже существует' });
      }
    }

    let codeRow: typeof invitationCodes.$inferSelect | undefined;
    let role: 'student' | 'ai_user' = 'ai_user';
    let normalizedReferralCode: string | null = referralCode?.trim().toUpperCase() || null;
    const normalizedInvitationCode = invitationCode?.trim().toUpperCase() || null;
    const normalizedAccessCode = accessCode?.trim().toUpperCase() || null;

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
      [codeRow] = await db
        .select()
        .from(invitationCodes)
        .where(and(eq(invitationCodes.code, invitationCandidate), eq(invitationCodes.isActive, true)));

      if (!codeRow) {
        return reply.status(400).send({ error: 'Недействительный код доступа' });
      }

      role = 'student';
    } else if (normalizedAccessCode && !normalizedReferralCode) {
      return reply.status(400).send({ error: 'Недействительный код доступа' });
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash,
        name: name.trim(),
        phone: normalizedPhone,
        invitationCodeId: codeRow?.id ?? null,
      })
      .returning();
    if (!newUser) {
      return reply.status(500).send({ error: 'Ошибка создания пользователя' });
    }
    await db.insert(userRoles).values({ userId: newUser.id, role });
    await ensureReferralCode(newUser.id);
    if (normalizedReferralCode) {
      await createReferralAttribution({ referralCode: normalizedReferralCode, refereeUserId: newUser.id });
    }
    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      role,
    });
    return reply.send({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role,
        phone: newUser.phone,
        phoneVerifiedAt: newUser.phoneVerifiedAt,
      },
    });
  });

  // Sign in
  app.post<{
    Body: { email: string; password: string };
  }>('/auth/signin', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return reply.status(400).send({ error: 'Email и пароль обязательны' });
    }
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    if (!user) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }
    if (user.isBlocked) {
      return reply.status(403).send({ error: 'Аккаунт заблокирован' });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }
    const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
    const role = (roleRow?.role as 'admin' | 'student' | 'ai_user') || 'student';
    const token = signToken({ userId: user.id, email: user.email, role });
    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        phone: user.phone,
        phoneVerifiedAt: user.phoneVerifiedAt,
      },
    });
  });

  // Me (current user)
  app.get('/auth/me', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
    if (!user) {
      return reply.status(401).send({ error: 'Пользователь не найден' });
    }
    if (user.isBlocked) {
      return reply.status(403).send({ error: 'Аккаунт заблокирован' });
    }
    const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
    const role = (roleRow?.role as 'admin' | 'student' | 'ai_user') || 'student';
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        phone: user.phone,
        phoneVerifiedAt: user.phoneVerifiedAt,
      },
    });
  });

  // Check blocked
  app.get<{ Querystring: { userId: string } }>('/auth/check-blocked', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }
    const userId = req.query.userId || payload.userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return reply.send({ is_blocked: !!user?.isBlocked });
  });
}

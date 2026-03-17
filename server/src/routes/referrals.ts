import { FastifyInstance } from 'fastify';
import { eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import {
  getReferralOverview,
  grantSignupReferralBonusIfEligible,
} from '../lib/referrals.js';
import {
  normalizePhone,
  requestPhoneVerificationCode,
  verifyPhoneCode,
} from '../lib/phone-verification.js';
import { SmsRuError } from '../lib/sms-ru.js';

export async function referralsRoutes(app: FastifyInstance) {
  app.get('/referral/me', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }

    const overview = await getReferralOverview(payload.userId);
    const siteUrl = process.env.SITE_URL || 'https://21day.club';
    return reply.send({
      ...overview,
      referralUrl: overview.phoneVerifiedAt ? `${siteUrl}/?ref=${overview.code}` : null,
    });
  });

  app.post<{ Body: { phone: string; purpose?: 'referral_unlock' | 'phone_change' } }>('/phone/request-code', async (req, reply) => {
    try {
      const payload = getAuthFromRequest(req);
      if (!payload) {
        return reply.status(401).send({ error: 'Не авторизован' });
      }

      const purpose = req.body?.purpose ?? 'referral_unlock';
      const normalizedPhone = normalizePhone(req.body?.phone || '');
      const [phoneOwner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, normalizedPhone));

      if (phoneOwner && phoneOwner.id !== payload.userId) {
        return reply.status(400).send({ error: 'Этот номер уже привязан к другому аккаунту' });
      }

      await requestPhoneVerificationCode(payload.userId, normalizedPhone, purpose);
      return reply.send({ success: true });
    } catch (error) {
      if (error instanceof SmsRuError) {
        return reply.status(error.isServiceError ? 503 : 400).send({ error: error.message });
      }

      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(500).send({ error: 'Не удалось отправить код подтверждения' });
    }
  });

  app.post<{ Body: { code: string; purpose?: 'referral_unlock' | 'phone_change' } }>('/phone/verify', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }

    const purpose = req.body?.purpose ?? 'referral_unlock';
    const result = await verifyPhoneCode(payload.userId, req.body?.code || '', purpose);
    await grantSignupReferralBonusIfEligible(payload.userId);

    return reply.send({
      success: true,
      phone: result.phone,
      verifiedAt: result.verifiedAt,
    });
  });

  app.get('/admin/referral-users', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(users)
      .where(ne(users.id, payload.userId));

    return reply.send(rows);
  });
}

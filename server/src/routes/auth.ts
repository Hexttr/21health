import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { verifyPassword, getAuthFromRequest } from '../lib/auth.js';
import {
  buildAuthSuccessForUserId,
  createUserFromAuthIdentity,
  findUserByEmail,
  loadAuthUserById,
  validateAccessCode,
} from '../lib/auth-accounts.js';
import {
  buildSocialCallbackErrorRedirect,
  buildSocialCallbackSuccessRedirect,
  createVkWidgetConfig,
  buildVkStartRedirect,
  handleVkCallbackAndCreateTicket,
  resolveVkExchange,
} from '../lib/social-auth/vkid.js';
import { consumeSocialCompletionTicket } from '../lib/social-auth/store.js';

export async function authRoutes(app: FastifyInstance) {
  // Validate invitation code (public)
  app.post<{
    Body: { code: string };
  }>('/auth/validate-code', async (req, reply) => {
    const { code } = req.body || {};
    const result = await validateAccessCode(code || '');
    return reply.send(result);
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
    try {
      const created = await createUserFromAuthIdentity({
        email,
        password,
        name,
        accessCode,
        invitationCode,
        referralCode,
        phone,
      });

      const auth = await buildAuthSuccessForUserId(created.user.id);
      return reply.send(auth);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Ошибка создания пользователя',
      });
    }
  });

  app.get<{
    Querystring: { mode?: 'login' | 'register'; accessCode?: string };
  }>('/auth/social/vkid/start', async (req, reply) => {
    try {
      const redirectUrl = buildVkStartRedirect({
        mode: req.query.mode === 'register' ? 'register' : 'login',
        accessCode: req.query.accessCode,
      });
      return reply.redirect(redirectUrl);
    } catch (error) {
      return reply.redirect(buildSocialCallbackErrorRedirect(
        error instanceof Error ? error.message : 'Не удалось запустить вход через VK ID'
      ));
    }
  });

  app.get<{
    Querystring: { mode?: 'login' | 'register'; accessCode?: string };
  }>('/auth/social/vkid/config', async (req, reply) => {
    try {
      const config = createVkWidgetConfig({
        mode: req.query.mode === 'register' ? 'register' : 'login',
        accessCode: req.query.accessCode,
      });
      return reply.send(config);
    } catch (error) {
      return reply.status(503).send({
        error: error instanceof Error ? error.message : 'VK ID не настроен на сервере',
      });
    }
  });

  app.get<{
    Querystring: {
      payload?: string;
      code?: string;
      state?: string;
      device_id?: string;
      deviceId?: string;
      error?: string;
      error_description?: string;
    };
  }>('/auth/social/vkid/callback', async (req, reply) => {
    try {
      const ticket = await handleVkCallbackAndCreateTicket(req.query || {});
      return reply.redirect(buildSocialCallbackSuccessRedirect(ticket));
    } catch (error) {
      return reply.redirect(buildSocialCallbackErrorRedirect(
        error instanceof Error ? error.message : 'Не удалось завершить вход через VK ID'
      ));
    }
  });

  app.post<{
    Body: {
      code?: string;
      state?: string;
      deviceId?: string;
      device_id?: string;
      error?: string;
      error_description?: string;
    };
  }>('/auth/social/vkid/exchange', async (req, reply) => {
    try {
      const auth = await resolveVkExchange(req.body || {});
      return reply.send(auth);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Не удалось завершить вход через VK ID',
      });
    }
  });

  app.get<{
    Querystring: { ticket?: string };
  }>('/auth/social/complete', async (req, reply) => {
    const ticket = req.query.ticket?.trim();
    if (!ticket) {
      return reply.status(400).send({ error: 'Требуется ticket авторизации' });
    }

    const auth = consumeSocialCompletionTicket(ticket);
    if (!auth) {
      return reply.status(400).send({ error: 'Сессия входа истекла. Попробуйте еще раз' });
    }

    return reply.send(auth);
  });

  // Sign in
  app.post<{
    Body: { email: string; password: string };
  }>('/auth/signin', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return reply.status(400).send({ error: 'Email и пароль обязательны' });
    }
    const user = await findUserByEmail(email);
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

    const auth = await buildAuthSuccessForUserId(user.id);
    return reply.send(auth);
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

    const authUser = await loadAuthUserById(user.id);
    if (!authUser) {
      return reply.status(401).send({ error: 'Пользователь не найден' });
    }

    return reply.send({ user: authUser });
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

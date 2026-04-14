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
} from '../lib/auth-accounts.js';

export async function authRoutes(app: FastifyInstance) {
  // Sign up
  app.post<{
    Body: { email: string; password: string; name: string };
  }>('/auth/signup', async (req, reply) => {
    const { email, password, name } = req.body || {};
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
      });

      const auth = await buildAuthSuccessForUserId(created.user.id);
      return reply.send(auth);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Ошибка создания пользователя',
      });
    }
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

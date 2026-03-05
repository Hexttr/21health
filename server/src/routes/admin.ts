import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userRoles, studentProgress, lessonContent, practicalMaterials, invitationCodes } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import { hashPassword } from '../lib/auth.js';

export async function adminRoutes(app: FastifyInstance) {
  // Admin: get all users (with progress and invitation code comment)
  app.get('/admin/users', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const allUsers = await db.select().from(users);
    const allRoles = await db.select().from(userRoles);
    const allProgress = await db.select().from(studentProgress);
    const allCodes = await db.select().from(invitationCodes);
    const roleMap = Object.fromEntries(allRoles.map((r) => [r.userId, r.role]));
    const codeMap = Object.fromEntries(allCodes.map((c) => [c.id, c.comment]));
    const progressByUser = new Map<string, { completed: number; quiz: number }>();
    for (const p of allProgress) {
      const cur = progressByUser.get(p.userId) || { completed: 0, quiz: 0 };
      if (p.completed) cur.completed++;
      if (p.quizCompleted) cur.quiz++;
      progressByUser.set(p.userId, cur);
    }
    const result = allUsers.map((u) => {
      const prog = progressByUser.get(u.id) || { completed: 0, quiz: 0 };
      return {
        id: u.id,
        user_id: u.id,
        email: u.email,
        name: u.name,
        is_blocked: u.isBlocked,
        blocked_at: u.blockedAt,
        role: roleMap[u.id] || 'student',
        completed_lessons: prog.completed,
        quiz_completed: prog.quiz,
        invitation_code_comment: u.invitationCodeId ? codeMap[u.invitationCodeId] || null : null,
      };
    });
    return reply.send(result);
  });

  // Admin: block user
  app.post<{ Body: { userId: string } }>('/admin/block-user', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { userId } = req.body || {};
    if (!userId) {
      return reply.status(400).send({ error: 'userId обязателен' });
    }
    await db
      .update(users)
      .set({ isBlocked: true, blockedAt: new Date() })
      .where(eq(users.id, userId));
    return reply.send({ success: true });
  });

  // Admin: unblock user
  app.post<{ Body: { userId: string } }>('/admin/unblock-user', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { userId } = req.body || {};
    if (!userId) {
      return reply.status(400).send({ error: 'userId обязателен' });
    }
    await db
      .update(users)
      .set({ isBlocked: false, blockedAt: null })
      .where(eq(users.id, userId));
    return reply.send({ success: true });
  });

  // Admin: update user name
  app.post<{ Body: { userId: string; name: string } }>('/admin/users/update-name', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { userId, name } = req.body || {};
    if (!userId || !name?.trim()) {
      return reply.status(400).send({ error: 'userId и name обязательны' });
    }
    await db.update(users).set({ name: name.trim() }).where(eq(users.id, userId));
    return reply.send({ success: true });
  });

  // Admin: reset password
  app.post<{ Body: { email: string; newPassword: string } }>('/admin/reset-password', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { email, newPassword } = req.body || {};
    if (!email?.trim() || !newPassword) {
      return reply.status(400).send({ error: 'email и newPassword обязательны' });
    }
    if (newPassword.length < 6) {
      return reply.status(400).send({ error: 'Пароль минимум 6 символов' });
    }
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    if (!user) {
      return reply.status(404).send({ error: 'Пользователь не найден' });
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    return reply.send({ success: true });
  });

  // Admin: export data
  app.get('/admin/export', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const [authUsers, profiles, roles, progress, lessons, materials] = await Promise.all([
      db.select().from(users),
      db.select().from(users).then((u) => u.map((x) => ({ user_id: x.id, email: x.email, name: x.name }))),
      db.select().from(userRoles),
      db.select().from(studentProgress),
      db.select().from(lessonContent),
      db.select().from(practicalMaterials),
    ]);
    const exportData = {
      auth_users: authUsers.map((u) => ({ id: u.id, email: u.email, created_at: u.createdAt })),
      profiles: profiles,
      user_roles: roles,
      student_progress: progress,
      lesson_content: lessons,
      practical_materials: materials,
    };
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="export.json"')
      .send(exportData);
  });
}

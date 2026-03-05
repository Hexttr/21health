import { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invitationCodes } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';

export async function codesRoutes(app: FastifyInstance) {
  // Admin: get all codes
  app.get('/admin/codes', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const rows = await db.select().from(invitationCodes).orderBy(asc(invitationCodes.createdAt));
    return reply.send(rows);
  });

  // Admin: create code
  app.post<{
    Body: { code: string; comment?: string; isActive?: boolean };
  }>('/admin/codes', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { code, comment = '', isActive = true } = req.body || {};
    if (!code?.trim()) {
      return reply.status(400).send({ error: 'Код обязателен' });
    }
    const normalized = code.trim().toUpperCase();
    const [existing] = await db.select().from(invitationCodes).where(eq(invitationCodes.code, normalized));
    if (existing) {
      return reply.status(400).send({ error: 'Код уже существует' });
    }
    const [row] = await db
      .insert(invitationCodes)
      .values({ code: normalized, comment: comment.trim(), isActive })
      .returning();
    return reply.send(row);
  });

  // Admin: update code
  app.put<{
    Params: { id: string };
    Body: { code?: string; comment?: string; isActive?: boolean };
  }>('/admin/codes/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const { id } = req.params;
    const data = req.body || {};
    const updates: Record<string, unknown> = {};
    if (data.code !== undefined) updates.code = (data.code as string).trim().toUpperCase();
    if (data.comment !== undefined) updates.comment = data.comment;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    const [row] = await db
      .update(invitationCodes)
      .set(updates)
      .where(eq(invitationCodes.id, id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: 'Код не найден' });
    }
    return reply.send(row);
  });

  // Admin: delete code
  app.delete<{ Params: { id: string } }>('/admin/codes/:id', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    await db.delete(invitationCodes).where(eq(invitationCodes.id, req.params.id));
    return reply.send({ success: true });
  });
}

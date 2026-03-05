import { FastifyInstance } from 'fastify';
import { asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { waitlist } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';

export async function waitlistRoutes(app: FastifyInstance) {
  // Public: add to waitlist
  app.post<{
    Body: { firstName: string; lastName: string; contact: string; contactType: string };
  }>('/waitlist', async (req, reply) => {
    const { firstName, lastName, contact, contactType } = req.body || {};
    if (!firstName?.trim() || !lastName?.trim() || !contact?.trim() || !contactType?.trim()) {
      return reply.status(400).send({ error: 'Заполните все поля' });
    }
    const [row] = await db
      .insert(waitlist)
      .values({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contact: contact.trim(),
        contactType: contactType.trim(),
      })
      .returning();
    return reply.send(row);
  });

  // Admin: get waitlist
  app.get('/admin/waitlist', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    const rows = await db.select().from(waitlist).orderBy(asc(waitlist.createdAt));
    return reply.send(rows);
  });
}

/**
 * Seed script: creates first invitation code and optionally first admin user.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { db } from './index.js';
import { invitationCodes, users, userRoles } from './schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../lib/auth.js';

async function seed() {
  const existingCodes = await db.select().from(invitationCodes);
  if (existingCodes.length === 0) {
    const [code] = await db
      .insert(invitationCodes)
      .values({ code: 'ADMIN2025', comment: 'Первый админ', isActive: true })
      .returning();
    console.log('Created invitation code:', code?.code);
  } else {
    console.log('Invitation codes already exist');
  }

  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    let [code] = await db.select().from(invitationCodes).where(eq(invitationCodes.code, 'ADMIN2025'));
    if (!code) {
      [code] = await db.insert(invitationCodes).values({ code: 'ADMIN2025', comment: 'Первый админ', isActive: true }).returning();
    }
    if (!code) {
      console.error('Failed to get/create invitation code');
      process.exit(1);
    }
    const passwordHash = await hashPassword('admin123');
    const [user] = await db
      .insert(users)
      .values({
        email: 'admin@example.com',
        passwordHash,
        name: 'Администратор',
        invitationCodeId: code.id,
      })
      .returning();
    if (user) {
      await db.insert(userRoles).values({ userId: user.id, role: 'admin' });
      console.log('Created admin user: admin@example.com / admin123');
    }
  } else {
    console.log('Users already exist');
  }
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

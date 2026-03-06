/**
 * Seed script: creates first invitation code, optionally first admin user,
 * and seeds lesson_content with the 21-day course from courseData.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { db } from './index.js';
import { invitationCodes, users, userRoles, lessonContent } from './schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../lib/auth.js';
import { lessonSeeds } from '../data/courseSeed.js';

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

  // Seed lesson_content with 21-day course (from Lovable/Supabase courseData)
  const existingLessons = await db.select().from(lessonContent);
  if (existingLessons.length === 0) {
    await db.insert(lessonContent).values(
      lessonSeeds.map((l) => ({
        lessonId: l.lessonId,
        customDescription: l.customDescription,
        additionalMaterials: l.additionalMaterials,
        videoUrls: [],
        pdfUrls: [],
        aiPrompt: null,
        isPublished: true,
      }))
    );
    console.log(`Seeded ${lessonSeeds.length} lessons (21-day course)`);
  } else {
    console.log(`Lesson content already exists (${existingLessons.length} lessons)`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

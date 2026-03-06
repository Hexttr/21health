/**
 * Import from data-package format: lesson_content.json + practical_materials.json
 * Usage: cd server && npx tsx scripts/import-from-data-package.ts [migration_export]
 *
 * Paths: migration_export or migration_export/migration_export (nested zip structure)
 */
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

// db/index.js loads .env
const { db } = await import('../src/db/index.js');
const { lessonContent, practicalMaterials } = await import('../src/db/schema.js');
const { eq } = await import('drizzle-orm');

async function main() {
  const baseDir = process.argv[2] || 'migration_export';
  const absBase = resolve(process.cwd(), baseDir);

  // Support nested migration_export/migration_export from zip
  let dir = absBase;
  const nested = join(absBase, 'migration_export');
  if (await fs.stat(nested).catch(() => null)) {
    dir = nested;
  }

  const lessonPath = join(dir, 'lesson_content.json');
  const materialsPath = join(dir, 'practical_materials.json');

  let lessons: Array<Record<string, unknown>> = [];
  let materials: Array<Record<string, unknown>> = [];

  try {
    lessons = JSON.parse(await fs.readFile(lessonPath, 'utf-8'));
  } catch (e) {
    console.warn('lesson_content.json not found or invalid:', e);
  }

  try {
    materials = JSON.parse(await fs.readFile(materialsPath, 'utf-8'));
  } catch (e) {
    console.warn('practical_materials.json not found or invalid:', e);
  }

  let lessonsUpdated = 0;
  let materialsInserted = 0;

  for (const row of lessons) {
    const lessonId = Number(row.lessonId);
    if (!lessonId || isNaN(lessonId)) continue;

    const payload = {
      customDescription: (row.customDescription as string) ?? null,
      videoUrls: (row.videoUrls as string[]) ?? [],
      videoPreviewUrls: (row.videoPreviewUrls as string[]) ?? [],
      pdfUrls: (row.pdfUrls as string[]) ?? [],
      additionalMaterials: (row.additionalMaterials as string) ?? null,
      aiPrompt: (row.aiPrompt as string) ?? null,
      isPublished: row.isPublished !== false,
    };

    const [existing] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    if (existing) {
      await db.update(lessonContent).set(payload).where(eq(lessonContent.lessonId, lessonId));
    } else {
      await db.insert(lessonContent).values({ lessonId, ...payload });
    }
    lessonsUpdated++;
  }

  if (lessons.length) {
    console.log(`Imported ${lessonsUpdated} lessons`);
  }

  // Practical materials
  const existingMaterials = await db.select().from(practicalMaterials);
  const maxOrder = existingMaterials.length ? Math.max(...existingMaterials.map((m) => m.sortOrder)) : -1;
  let sortOrder = maxOrder + 1;

  for (const m of materials) {
    await db.insert(practicalMaterials).values({
      title: (m.title as string) || 'Unknown',
      description: (m.description as string) ?? null,
      videoUrl: (m.videoUrl as string) || '',
      previewUrl: (m.previewUrl as string) ?? null,
      sortOrder: Number(m.sortOrder) ?? sortOrder++,
      isPublished: m.isPublished === true,
    });
    materialsInserted++;
  }

  if (materials.length) {
    console.log(`Imported ${materialsInserted} practical materials`);
  }

  console.log('Import complete.');
  console.log('');
  console.log('Note: pdfUrls and videoPreviewUrls reference /uploads/ — ensure files exist in server/uploads/pdfs/ and server/uploads/previews/');
  console.log('If files are missing, copy them from the source or add to data-package.zip');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

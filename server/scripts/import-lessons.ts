/**
 * Import lesson_content from JSON (Supabase export format or similar).
 * Usage: npm run db:import-lessons -- path/to/export.json
 * Or: npx tsx src/scripts/import-lessons.ts < path/to/export.json
 *
 * JSON format (from Supabase export-data):
 * { "lessonContent": [ { "lesson_id": 1, "custom_description": "...", "video_urls": [], "pdf_urls": [], ... } ] }
 * Or array directly: [ { "lesson_id": 1, ... } ]
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { db } from '../db/index.js';
import { lessonContent } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

async function main() {
  const filePath = process.argv[2];
  const input = filePath
    ? fs.readFileSync(filePath, 'utf-8')
    : fs.readFileSync(0, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    console.error('Invalid JSON input');
    process.exit(1);
  }

  let lessons: Array<Record<string, unknown>>;
  if (Array.isArray(data)) {
    lessons = data;
  } else if (data && typeof data === 'object' && 'lessonContent' in data) {
    lessons = (data as { lessonContent: unknown[] }).lessonContent;
  } else {
    console.error('Expected JSON array or { lessonContent: [...] }');
    process.exit(1);
  }

  if (!Array.isArray(lessons) || lessons.length === 0) {
    console.error('No lessons in input');
    process.exit(1);
  }

  let updated = 0;
  let inserted = 0;

  for (const row of lessons) {
    const lessonId = Number(row.lesson_id);
    if (!lessonId || isNaN(lessonId)) continue;

    const payload = {
      lessonId,
      customDescription: (row.custom_description as string) ?? null,
      videoUrls: (row.video_urls as string[]) ?? [],
      videoTitles: (row.video_titles as string[]) ?? [],
      videoPreviewUrls: (row.video_preview_urls as string[]) ?? [],
      pdfUrls: (row.pdf_urls as string[]) ?? [],
      additionalMaterials: (row.additional_materials as string) ?? null,
      aiPrompt: (row.ai_prompt as string) ?? null,
      aiPromptIsOverride: row.ai_prompt_is_override === true,
      isPublished: row.is_published !== false,
    };

    const [existing] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));

    if (existing) {
      await db.update(lessonContent).set(payload).where(eq(lessonContent.lessonId, lessonId));
      updated++;
    } else {
      await db.insert(lessonContent).values(payload);
      inserted++;
    }
  }

  console.log(`Import complete: ${inserted} inserted, ${updated} updated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

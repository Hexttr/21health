/**
 * Import lesson content and practical materials from migration_export folder.
 * Usage: cd server && npx tsx scripts/import-from-migration.ts migration_export
 *
 * Expects: migration_export/manifest.json + pdfs/, previews/, practical/ folders.
 * See AGENT_INSTRUCTIONS.md for manifest format.
 */
import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

// Run from server/ — paths relative to server/scripts/
const { db } = await import('../src/db/index.js');
const { lessonContent, practicalMaterials } = await import('../src/db/schema.js');
const { eq } = await import('drizzle-orm');

const UPLOADS_DIR = resolve(__dirname, '../uploads');
const PDFS_DIR = join(UPLOADS_DIR, 'pdfs');
const PREVIEWS_DIR = join(UPLOADS_DIR, 'previews');

interface ManifestLesson {
  lessonId: number;
  videoUrls?: string[];
  pdfPaths?: string[];
  previewPaths?: string[];
}

interface ManifestMaterial {
  title: string;
  description?: string;
  videoUrl: string;
  previewPath?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

interface Manifest {
  lessons?: ManifestLesson[];
  practicalMaterials?: ManifestMaterial[];
}

async function copyFile(src: string, dest: string): Promise<void> {
  await fs.mkdir(dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function main() {
  const exportDir = process.argv[2] || 'migration_export';
  const absExportDir = resolve(process.cwd(), exportDir);

  const manifestPath = join(absExportDir, 'manifest.json');
  let manifest: Manifest;
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (e) {
    console.error('Cannot read manifest.json from', absExportDir);
    console.error(e);
    process.exit(1);
  }

  await fs.mkdir(PDFS_DIR, { recursive: true });
  await fs.mkdir(PREVIEWS_DIR, { recursive: true });

  let lessonsImported = 0;
  let materialsImported = 0;

  // Import lessons
  if (manifest.lessons?.length) {
    for (const lesson of manifest.lessons) {
      const videoUrls = lesson.videoUrls ?? [];
      const pdfUrls: string[] = [];
      const previewUrls: string[] = [];

      // Copy PDFs
      for (const p of lesson.pdfPaths ?? []) {
        const src = join(absExportDir, 'pdfs', p);
        const altSrc = join(absExportDir, p);
        const srcPath = (await fs.stat(src).catch(() => null)) ? src : (await fs.stat(altSrc).catch(() => null)) ? altSrc : null;
        if (srcPath) {
          const base = p.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_');
          const filename = `lesson-${lesson.lessonId}-${base}-${Date.now()}.pdf`;
          const dest = join(PDFS_DIR, filename);
          await copyFile(srcPath, dest);
          pdfUrls.push(`/uploads/pdfs/${filename}`);
        }
      }

      // Copy previews
      for (const p of lesson.previewPaths ?? []) {
        const src = join(absExportDir, 'previews', p);
        const altSrc = join(absExportDir, p);
        const srcPath = (await fs.stat(src).catch(() => null)) ? src : (await fs.stat(altSrc).catch(() => null)) ? altSrc : null;
        if (srcPath) {
          const ext = p.match(/\.(jpe?g|png|webp)$/i)?.[1] || 'jpg';
          const filename = `lesson-${lesson.lessonId}-v${previewUrls.length}-${Date.now()}.${ext}`;
          const dest = join(PREVIEWS_DIR, filename);
          await copyFile(srcPath, dest);
          previewUrls.push(`/uploads/previews/${filename}`);
        }
      }

      const [existing] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lesson.lessonId));
      const payload = {
        videoUrls: videoUrls.length ? videoUrls : (existing?.videoUrls ?? []),
        pdfUrls: pdfUrls.length ? pdfUrls : (existing?.pdfUrls ?? []),
        videoPreviewUrls: previewUrls.length ? previewUrls : (existing?.videoPreviewUrls ?? []),
      };
      if (existing) {
        await db.update(lessonContent).set(payload).where(eq(lessonContent.lessonId, lesson.lessonId));
      } else {
        await db.insert(lessonContent).values({
          lessonId: lesson.lessonId,
          ...payload,
          isPublished: true,
        });
      }
      lessonsImported++;
    }
    console.log(`Imported ${lessonsImported} lessons`);
  }

  // Import practical materials
  if (manifest.practicalMaterials?.length) {
    const existing = await db.select().from(practicalMaterials);
    const maxOrder = existing.length ? Math.max(...existing.map((m) => m.sortOrder)) : -1;
    let sortOrder = maxOrder + 1;

    for (const m of manifest.practicalMaterials) {
      let previewUrl: string | null = null;
      if (m.previewPath) {
        const src = join(absExportDir, 'practical', m.previewPath);
        const altSrc = join(absExportDir, 'previews', m.previewPath);
        const srcPath = (await fs.stat(src).catch(() => null)) ? src : (await fs.stat(altSrc).catch(() => null)) ? altSrc : null;
        if (srcPath) {
          const ext = m.previewPath.match(/\.(jpe?g|png|webp)$/i)?.[1] || 'jpg';
          const filename = `material-${Date.now()}-${sortOrder}.${ext}`;
          const dest = join(PREVIEWS_DIR, filename);
          await copyFile(srcPath, dest);
          previewUrl = `/uploads/previews/${filename}`;
        }
      }

      await db.insert(practicalMaterials).values({
        title: m.title,
        description: m.description ?? null,
        videoUrl: m.videoUrl,
        previewUrl,
        sortOrder: m.sortOrder ?? sortOrder++,
        isPublished: m.isPublished ?? false,
      });
      materialsImported++;
    }
    console.log(`Imported ${materialsImported} practical materials`);
  }

  console.log('Import complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

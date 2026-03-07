import { config } from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
import { authRoutes } from './routes/auth.js';
import { lessonRoutes } from './routes/lessons.js';
import { progressRoutes } from './routes/progress.js';
import { materialsRoutes } from './routes/materials.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { codesRoutes } from './routes/codes.js';
import { adminRoutes } from './routes/admin.js';
import { aiRoutes } from './routes/ai.js';
import { aiModelsRoutes } from './routes/ai-models.js';
import { billingRoutes } from './routes/billing.js';
import { db } from './db/index.js';
import { lessonContent, practicalMaterials } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthFromRequest } from './lib/auth.js';

const UPLOADS_DIR = join(__dirname, '..', 'uploads');

const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 }); // 20MB for image generation

async function main() {
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(staticPlugin, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
  });

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(lessonRoutes, { prefix: '/api' });
  await app.register(progressRoutes, { prefix: '/api' });
  await app.register(materialsRoutes, { prefix: '/api' });
  await app.register(waitlistRoutes, { prefix: '/api' });
  await app.register(codesRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });
  await app.register(aiRoutes, { prefix: '/api' });
  await app.register(aiModelsRoutes, { prefix: '/api' });
  await app.register(billingRoutes, { prefix: '/api' });

  // Upload PDF for lesson
  app.post('/api/admin/lessons/upload-pdf', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    let lessonId = 0;
    let buffer: Buffer | null = null;
    let originalFilename = '';
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'lessonId') {
        lessonId = parseInt((part as { value: string }).value, 10);
      } else if (part.type === 'file' && part.fieldname === 'file') {
        originalFilename = part.filename || '';
        buffer = await part.toBuffer();
      }
    }
    if (!lessonId || !buffer) {
      return reply.status(400).send({ error: 'lessonId и file обязательны' });
    }
    const fs = await import('fs/promises');
    const uploadsDir = join(UPLOADS_DIR, 'pdfs');
    await fs.mkdir(uploadsDir, { recursive: true });
    const base = originalFilename
      ? originalFilename.replace(/^.*[\\/]/, '').replace(/[<>:"/\\|?*]/g, '_').replace(/\.pdf$/i, '') || 'file'
      : 'file';
    const filename = `${base}-${Date.now()}.pdf`;
    const filepath = join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);
    const url = `/uploads/pdfs/${filename}`;
    const [existing] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    const pdfUrls = existing?.pdfUrls ?? [];
    const newUrls = [...pdfUrls, url];
    if (existing) {
      await db.update(lessonContent).set({ pdfUrls: newUrls }).where(eq(lessonContent.id, existing.id));
    } else {
      await db.insert(lessonContent).values({ lessonId, pdfUrls: newUrls });
    }
    return reply.send({ url });
  });

  // Upload video preview image for lesson
  app.post('/api/admin/lessons/upload-video-preview', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    let lessonId = 0;
    let videoIndex = -1;
    let buffer: Buffer | null = null;
    let originalFilename = '';
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'lessonId') {
        lessonId = parseInt((part as { value: string }).value, 10);
      } else if (part.type === 'field' && part.fieldname === 'videoIndex') {
        videoIndex = parseInt((part as { value: string }).value, 10);
      } else if (part.type === 'file' && part.fieldname === 'file') {
        originalFilename = part.filename || '';
        buffer = await part.toBuffer();
      }
    }
    if (!lessonId || videoIndex < 0 || !buffer) {
      return reply.status(400).send({ error: 'lessonId, videoIndex и file обязательны' });
    }
    const ext = (originalFilename.match(/\.(jpe?g|png|webp)$/i) || [])[1]?.toLowerCase() || 'jpg';
    const fs = await import('fs/promises');
    const uploadsDir = join(UPLOADS_DIR, 'previews');
    await fs.mkdir(uploadsDir, { recursive: true });
    const base = originalFilename
      ? originalFilename.replace(/^.*[\\/]/, '').replace(/[<>:"/\\|?*]/g, '_').replace(/\.(jpe?g|png|webp)$/gi, '') || 'preview'
      : 'preview';
    const filename = `lesson-${lessonId}-v${videoIndex}-${base}-${Date.now()}.${ext}`;
    const filepath = join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);
    const url = `/uploads/previews/${filename}`;
    const [existing] = await db.select().from(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    const previewUrls = existing?.videoPreviewUrls ?? [];
    const newUrls = [...previewUrls];
    while (newUrls.length <= videoIndex) newUrls.push('');
    newUrls[videoIndex] = url;
    if (existing) {
      await db.update(lessonContent).set({ videoPreviewUrls: newUrls }).where(eq(lessonContent.id, existing.id));
    } else {
      await db.insert(lessonContent).values({ lessonId, videoPreviewUrls: newUrls });
    }
    return reply.send({ url });
  });

  // Upload preview for practical material
  app.post('/api/admin/materials/upload-preview', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Требуются права администратора' });
    }
    let materialId = '';
    let buffer: Buffer | null = null;
    let originalFilename = '';
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'materialId') {
        materialId = (part as { value: string }).value;
      } else if (part.type === 'file' && part.fieldname === 'file') {
        originalFilename = part.filename || '';
        buffer = await part.toBuffer();
      }
    }
    if (!materialId || !buffer) {
      return reply.status(400).send({ error: 'materialId и file обязательны' });
    }
    const ext = (originalFilename.match(/\.(jpe?g|png|webp)$/i) || [])[1]?.toLowerCase() || 'jpg';
    const fs = await import('fs/promises');
    const uploadsDir = join(UPLOADS_DIR, 'previews');
    await fs.mkdir(uploadsDir, { recursive: true });
    const base = originalFilename
      ? originalFilename.replace(/^.*[\\/]/, '').replace(/[<>:"/\\|?*]/g, '_').replace(/\.(jpe?g|png|webp)$/gi, '') || 'preview'
      : 'preview';
    const filename = `material-${materialId}-${base}-${Date.now()}.${ext}`;
    const filepath = join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);
    const url = `/uploads/previews/${filename}`;
    await db.update(practicalMaterials).set({ previewUrl: url }).where(eq(practicalMaterials.id, materialId));
    return reply.send({ url });
  });

  // Production: serve frontend SPA (static files + fallback to index.html)
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = join(__dirname, '..', '..', 'dist');
  const { existsSync } = await import('fs');
  const { resolve: resolvePath } = await import('path');
  if (isProd && existsSync(distPath)) {
    app.get('*', async (req, reply) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return;
      const p = (req.url || '/').split('?')[0];
      const filePath = p === '/' ? 'index.html' : p.slice(1).replace(/\.\./g, '');
      const full = resolvePath(distPath, filePath);
      if (full.startsWith(resolvePath(distPath)) && existsSync(full)) {
        try {
          const stat = await import('fs').then((f) => f.promises.stat(full));
          if (stat.isFile()) return reply.sendFile(filePath, distPath);
        } catch {
          /* ignore */
        }
      }
      return reply.sendFile('index.html', distPath);
    });
  }

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server running at http://localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

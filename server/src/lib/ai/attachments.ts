import fs from 'fs/promises';
import { dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import { db } from '../../db/index.js';
import { aiAttachments } from '../../db/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ATTACHMENTS_DIR = resolve(__dirname, '../../../private-uploads/ai-attachments');
const ATTACHMENT_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENTS_PER_MESSAGE = 5;
const MAX_EXTRACTED_TEXT_CHARS = 120_000;
const MAX_PREVIEW_CHARS = 1_800;
const MAX_SPREADSHEET_ROWS = 50;
const MAX_SPREADSHEET_COLUMNS = 20;

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.pptx',
  '.txt',
  '.md',
  '.json',
]);

const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/json',
]);

export type StoredAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: 'ready' | 'failed';
  extractedPreview: string | null;
  pageCount: number | null;
  sheetCount: number | null;
  slideCount: number | null;
  expiresAt: string;
  createdAt: string;
};

type ExtractedAttachment = {
  extractedText: string;
  extractedPreview: string;
  pageCount?: number;
  sheetCount?: number;
  slideCount?: number;
};

function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/^.*[\\/]/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return cleaned || 'file';
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trimText(raw: string, maxChars: number): string {
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars)}\n\n[Обрезано: документ слишком большой для полной передачи в модель]`;
}

function buildPreview(raw: string): string {
  return trimText(raw, MAX_PREVIEW_CHARS);
}

function getExtension(filename: string): string {
  return extname(filename || '').toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${bytes} B`;
}

function describeAttachmentKind(attachment: typeof aiAttachments.$inferSelect): string {
  const extension = getExtension(attachment.originalName);
  switch (extension) {
    case '.pdf':
      return 'PDF-документ';
    case '.docx':
      return 'DOCX-документ';
    case '.xls':
    case '.xlsx':
    case '.csv':
      return 'Таблица';
    case '.pptx':
      return 'Презентация';
    case '.md':
      return 'Markdown-документ';
    case '.json':
      return 'JSON-файл';
    case '.txt':
      return 'Текстовый файл';
    default:
      return attachment.mimeType || 'Документ';
  }
}

function buildAttachmentSummaryLine(attachment: typeof aiAttachments.$inferSelect, index: number): string {
  const details = [
    describeAttachmentKind(attachment),
    formatFileSize(attachment.fileSize),
    attachment.pageCount ? `${attachment.pageCount} стр.` : null,
    attachment.sheetCount ? `${attachment.sheetCount} лист.` : null,
    attachment.slideCount ? `${attachment.slideCount} слайд.` : null,
  ].filter(Boolean).join(' | ');

  return `${index + 1}. ${attachment.originalName}${details ? ` — ${details}` : ''}`;
}

function sliceAttachmentExcerpt(text: string, maxChars: number): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf('\n', Math.min(maxChars, normalized.length));
  const safeEnd = boundary > maxChars * 0.6 ? boundary : maxChars;
  return `${normalized.slice(0, safeEnd).trim()}\n\n[Фрагмент документа обрезан для экономии контекста]`;
}

function validateDocument(filename: string, mimeType: string, fileSize: number): void {
  const extension = getExtension(filename);
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)) {
    throw new Error(`Формат файла не поддерживается: ${extension || 'без расширения'}`);
  }
  if (mimeType && !SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    throw new Error(`MIME-тип не поддерживается: ${mimeType}`);
  }
  if (fileSize <= 0) {
    throw new Error('Файл пустой');
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error('Файл слишком большой. Максимум 25 MB');
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedAttachment> {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  const text = normalizeText(parsed.text || '');
  if (!text) {
    throw new Error('В PDF не найден текстовый слой. OCR пока не поддерживается');
  }
  const extractedText = trimText(text, MAX_EXTRACTED_TEXT_CHARS);
  return {
    extractedText,
    extractedPreview: buildPreview(extractedText),
    pageCount: parsed.total || undefined,
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractedAttachment> {
  const mammoth = await import('mammoth');
  const parsed = await mammoth.extractRawText({ buffer });
  const text = normalizeText(parsed.value || '');
  if (!text) {
    throw new Error('Не удалось извлечь текст из DOCX');
  }
  const extractedText = trimText(text, MAX_EXTRACTED_TEXT_CHARS);
  return {
    extractedText,
    extractedPreview: buildPreview(extractedText),
  };
}

function formatSpreadsheetRows(rows: unknown[][]): string {
  return rows
    .slice(0, MAX_SPREADSHEET_ROWS)
    .map((row, rowIndex) => {
      const cells = row
        .slice(0, MAX_SPREADSHEET_COLUMNS)
        .map((cell) => String(cell ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return cells.length > 0 ? `Строка ${rowIndex + 1}: ${cells.join(' | ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

async function extractSpreadsheet(buffer: Buffer, filename: string): Promise<ExtractedAttachment> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, 5)) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    }) as unknown[][];
    const nonEmptyRows = rows.filter((row) => Array.isArray(row) && row.some((value) => String(value ?? '').trim() !== ''));
    parts.push(`Лист: ${sheetName}`);
    parts.push(`Всего строк: ${nonEmptyRows.length}`);
    const formattedRows = formatSpreadsheetRows(nonEmptyRows);
    if (formattedRows) {
      parts.push(formattedRows);
    }
    parts.push('');
  }

  const text = normalizeText(parts.join('\n')) || `Табличный файл ${sanitizeFilename(filename)} загружен, но не содержит читаемых данных.`;
  const extractedText = trimText(text, MAX_EXTRACTED_TEXT_CHARS);
  return {
    extractedText,
    extractedPreview: buildPreview(extractedText),
    sheetCount: workbook.SheetNames.length,
  };
}

function extractTextNodes(node: unknown, collector: string[]): void {
  if (typeof node === 'string') {
    const value = node.trim();
    if (value) collector.push(value);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) extractTextNodes(item, collector);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      extractTextNodes(value, collector);
    }
  }
}

async function extractPptx(buffer: Buffer): Promise<ExtractedAttachment> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const slideFiles = zip.file(/^ppt\/slides\/slide\d+\.xml$/).sort((a, b) => a.name.localeCompare(b.name));
  const slides: string[] = [];

  for (const [index, slideFile] of slideFiles.entries()) {
    const xml = await slideFile.async('string');
    const parsed = parser.parse(xml);
    const texts: string[] = [];
    extractTextNodes(parsed, texts);
    const normalized = normalizeText(texts.join(' '));
    if (normalized) {
      slides.push(`Слайд ${index + 1}: ${normalized}`);
    }
  }

  if (slides.length === 0) {
    throw new Error('Не удалось извлечь текст из PPTX');
  }

  const extractedText = trimText(slides.join('\n\n'), MAX_EXTRACTED_TEXT_CHARS);
  return {
    extractedText,
    extractedPreview: buildPreview(extractedText),
    slideCount: slideFiles.length,
  };
}

async function extractPlainText(buffer: Buffer, extension: string): Promise<ExtractedAttachment> {
  let text = buffer.toString('utf8');
  if (extension === '.json') {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // Keep original text if JSON is invalid.
    }
  }
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error('Файл не содержит читаемого текста');
  }
  const extractedText = trimText(normalized, MAX_EXTRACTED_TEXT_CHARS);
  return {
    extractedText,
    extractedPreview: buildPreview(extractedText),
  };
}

async function extractDocument(buffer: Buffer, filename: string): Promise<ExtractedAttachment> {
  const extension = getExtension(filename);
  switch (extension) {
    case '.pdf':
      return extractPdf(buffer);
    case '.docx':
      return extractDocx(buffer);
    case '.xls':
    case '.xlsx':
    case '.csv':
      return extractSpreadsheet(buffer, filename);
    case '.pptx':
      return extractPptx(buffer);
    case '.txt':
    case '.md':
    case '.json':
      return extractPlainText(buffer, extension);
    default:
      throw new Error(`Формат файла не поддерживается: ${extension || 'без расширения'}`);
  }
}

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });
}

export async function cleanupExpiredAiAttachments(): Promise<void> {
  const expired = await db
    .select()
    .from(aiAttachments)
    .where(lt(aiAttachments.expiresAt, new Date()));

  if (expired.length === 0) return;

  await Promise.all(expired.map(async (attachment) => {
    try {
      await fs.unlink(attachment.storagePath);
    } catch {
      // Ignore missing files during cleanup.
    }
  }));

  await db.delete(aiAttachments).where(inArray(aiAttachments.id, expired.map((attachment) => attachment.id)));
}

function mapAttachmentRow(row: typeof aiAttachments.$inferSelect): StoredAttachment {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    status: row.status,
    extractedPreview: row.extractedPreview,
    pageCount: row.pageCount,
    sheetCount: row.sheetCount,
    slideCount: row.slideCount,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createDocumentAttachment(params: {
  userId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}): Promise<StoredAttachment> {
  await cleanupExpiredAiAttachments();
  validateDocument(params.originalName, params.mimeType, params.fileSize);

  const safeName = sanitizeFilename(params.originalName);
  const extracted = await extractDocument(params.buffer, safeName);

  await ensureStorageDir();
  const storageName = `${Date.now()}-${Math.random().toString(36).slice(2)}${getExtension(safeName) || '.bin'}`;
  const storagePath = join(ATTACHMENTS_DIR, storageName);
  await fs.writeFile(storagePath, params.buffer);

  const expiresAt = new Date(Date.now() + ATTACHMENT_TTL_MS);
  const [row] = await db.insert(aiAttachments).values({
    userId: params.userId,
    kind: 'document',
    originalName: safeName,
    mimeType: params.mimeType || 'application/octet-stream',
    fileSize: params.fileSize,
    storagePath,
    status: 'ready',
    extractedText: extracted.extractedText,
    extractedPreview: extracted.extractedPreview,
    pageCount: extracted.pageCount ?? null,
    sheetCount: extracted.sheetCount ?? null,
    slideCount: extracted.slideCount ?? null,
    expiresAt,
  }).returning();

  return mapAttachmentRow(row);
}

export async function listUserAiAttachments(userId: string): Promise<StoredAttachment[]> {
  await cleanupExpiredAiAttachments();
  const rows = await db
    .select()
    .from(aiAttachments)
    .where(eq(aiAttachments.userId, userId))
    .orderBy(desc(aiAttachments.createdAt));
  return rows.map(mapAttachmentRow);
}

export async function resolveAttachmentsForUser(userId: string, attachmentIds: string[]): Promise<Array<typeof aiAttachments.$inferSelect>> {
  await cleanupExpiredAiAttachments();
  if (attachmentIds.length === 0) return [];
  if (attachmentIds.length > MAX_DOCUMENTS_PER_MESSAGE) {
    throw new Error(`Максимум ${MAX_DOCUMENTS_PER_MESSAGE} документов в одном сообщении`);
  }

  const rows = await db
    .select()
    .from(aiAttachments)
    .where(and(
      eq(aiAttachments.userId, userId),
      inArray(aiAttachments.id, attachmentIds),
    ));

  const byId = new Map(rows.map((row) => [row.id, row]));
  return attachmentIds.map((attachmentId) => {
    const attachment = byId.get(attachmentId);
    if (!attachment) {
      throw new Error('Некоторые вложения не найдены или уже истекли');
    }
    if (attachment.status !== 'ready' || !attachment.extractedText) {
      throw new Error(`Вложение "${attachment.originalName}" ещё не готово к анализу`);
    }
    return attachment;
  });
}

export function buildAttachmentContext(
  attachments: Array<typeof aiAttachments.$inferSelect>,
  maxChars = 40_000,
): string {
  if (attachments.length === 0 || maxChars <= 0) {
    return '';
  }

  const blocks: string[] = [];
  const summaryLines = attachments.map((attachment, index) => buildAttachmentSummaryLine(attachment, index));
  const summaryBlock = ['[Набор документов]', `Всего документов: ${attachments.length}`, ...summaryLines].join('\n');
  blocks.push(summaryBlock);

  let remaining = Math.max(0, maxChars - summaryBlock.length - 4);
  const remainingAttachments = attachments.filter((attachment) => Boolean(attachment.extractedText));

  for (const [index, attachment] of remainingAttachments.entries()) {
    if (!attachment.extractedText || remaining <= 0) break;

    const attachmentsLeft = remainingAttachments.length - index;
    const perAttachmentBudget = Math.max(1200, Math.floor(remaining / attachmentsLeft));
    const metaLines = [
      `[Документ ${index + 1}]`,
      `Название: ${attachment.originalName}`,
      `Формат: ${describeAttachmentKind(attachment)}`,
      `MIME: ${attachment.mimeType}`,
      `Размер: ${formatFileSize(attachment.fileSize)}`,
      attachment.pageCount ? `Страницы: ${attachment.pageCount}` : null,
      attachment.sheetCount ? `Листы: ${attachment.sheetCount}` : null,
      attachment.slideCount ? `Слайды: ${attachment.slideCount}` : null,
    ].filter(Boolean);
    const header = metaLines.join('\n');

    const budgetForText = Math.max(0, perAttachmentBudget - header.length - 64);
    if (budgetForText <= 0) break;

    const preview = attachment.extractedPreview
      ? sliceAttachmentExcerpt(attachment.extractedPreview, Math.min(800, Math.max(250, Math.floor(budgetForText * 0.25))))
      : '';
    const bodyBudget = Math.max(0, budgetForText - preview.length - (preview ? 32 : 0));
    const excerpt = sliceAttachmentExcerpt(attachment.extractedText, bodyBudget);
    const parts = [header];
    if (preview) {
      parts.push(`Краткий фрагмент:\n${preview}`);
    }
    parts.push(`Извлечённое содержимое:\n${excerpt}`);
    const block = parts.join('\n\n');
    blocks.push(block);
    remaining -= block.length + 4;
  }

  return blocks.join('\n\n');
}

export const aiAttachmentConfig = {
  maxDocumentsPerMessage: MAX_DOCUMENTS_PER_MESSAGE,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  supportedDocumentExtensions: Array.from(SUPPORTED_DOCUMENT_EXTENSIONS),
};

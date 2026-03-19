import { createHash, randomInt } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { phoneVerifications, users } from '../db/schema.js';
import { sendSmsRuCode } from './sms-ru.js';

const CODE_TTL_MS = 5 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (digits.startsWith('00') && digits.length > 4) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }

  if (digits.length === 11 && digits.startsWith('7')) {
    return digits;
  }

  // Accept international numbers in E.164-like form after stripping separators.
  // This allows signup and verification flows for non-RU users, e.g. +375...
  if ((trimmed.startsWith('+') || /^\d+$/.test(trimmed)) && digits.length >= 7 && digits.length <= 15) {
    return digits;
  }

  throw new Error('Некорректный номер телефона');
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

async function sendSmsCode(phone: string, code: string): Promise<void> {
  await sendSmsRuCode(phone, code);
}

export async function requestPhoneVerificationCode(userId: string, rawPhone: string, purpose: 'referral_unlock' | 'phone_change' = 'referral_unlock') {
  const phone = normalizePhone(rawPhone);
  const now = new Date();
  const code = generateCode();
  const codeHash = hashCode(code);

  const [existing] = await db
    .select()
    .from(phoneVerifications)
    .where(and(eq(phoneVerifications.userId, userId), eq(phoneVerifications.purpose, purpose)));

  if (existing) {
    const sentAt = existing.sentAt ? new Date(existing.sentAt) : null;
    if (sentAt && now.getTime() - sentAt.getTime() < REQUEST_COOLDOWN_MS) {
      throw new Error('Повторная отправка возможна не чаще одного раза в 60 секунд');
    }

    const windowStartedAt = existing.requestWindowStartedAt ? new Date(existing.requestWindowStartedAt) : now;
    const withinWindow = now.getTime() - windowStartedAt.getTime() < REQUEST_WINDOW_MS;
    const requestCount = withinWindow ? existing.requestCount : 0;
    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
      throw new Error('Слишком много запросов. Попробуйте позже');
    }

    await db
      .update(phoneVerifications)
      .set({
        phone,
        codeHash,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        sentAt: now,
        attempts: 0,
        lastAttemptAt: null,
        verifiedAt: null,
        consumedAt: null,
        requestCount: requestCount + 1,
        requestWindowStartedAt: withinWindow ? windowStartedAt : now,
        updatedAt: now,
      })
      .where(eq(phoneVerifications.id, existing.id));
  } else {
    await db.insert(phoneVerifications).values({
      userId,
      phone,
      purpose,
      codeHash,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      sentAt: now,
      requestCount: 1,
      requestWindowStartedAt: now,
      attempts: 0,
    });
  }

  await sendSmsCode(phone, code);
}

export async function verifyPhoneCode(userId: string, submittedCode: string, purpose: 'referral_unlock' | 'phone_change' = 'referral_unlock') {
  const trimmedCode = submittedCode.trim();
  if (!/^\d{4}$/.test(trimmedCode)) {
    throw new Error('Код должен состоять из 4 цифр');
  }

  const [verification] = await db
    .select()
    .from(phoneVerifications)
    .where(and(eq(phoneVerifications.userId, userId), eq(phoneVerifications.purpose, purpose)));

  if (!verification) {
    throw new Error('Сначала запросите код подтверждения');
  }

  const now = new Date();
  if (verification.consumedAt || verification.verifiedAt) {
    throw new Error('Этот код уже использован');
  }

  if (new Date(verification.expiresAt).getTime() < now.getTime()) {
    throw new Error('Срок действия кода истек');
  }

  const attempts = verification.attempts + 1;
  await db.update(phoneVerifications).set({
    attempts,
    lastAttemptAt: now,
    updatedAt: now,
  }).where(eq(phoneVerifications.id, verification.id));

  if (attempts > MAX_ATTEMPTS) {
    throw new Error('Превышено количество попыток подтверждения');
  }

  if (verification.codeHash !== hashCode(trimmedCode)) {
    throw new Error('Неверный код подтверждения');
  }

  await db.update(users).set({
    phone: verification.phone,
    phoneVerifiedAt: now,
    updatedAt: now,
  }).where(eq(users.id, userId));

  await db.update(phoneVerifications).set({
    verifiedAt: now,
    consumedAt: now,
    updatedAt: now,
  }).where(eq(phoneVerifications.id, verification.id));

  return {
    phone: verification.phone,
    verifiedAt: now,
  };
}

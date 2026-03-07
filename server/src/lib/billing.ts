import { db } from '../db/index.js';
import { userBalances, balanceTransactions, aiUsageLog } from '../db/schema.js';
import { eq, and, sql, gte } from 'drizzle-orm';
import { getAllowedPlatformSetting } from './platform-settings.js';

export async function getSetting(key: string): Promise<string | null> {
  if (key === 'markup_percent' || key === 'daily_free_requests' || key === 'min_topup_amount' || key === 'max_topup_amount' || key === 'free_for_admins') {
    return getAllowedPlatformSetting(key);
  }
  return null;
}

export async function getMarkupPercent(): Promise<number> {
  const val = await getSetting('markup_percent');
  return val ? parseFloat(val) : 50;
}

export async function getDailyFreeLimit(): Promise<number> {
  const val = await getSetting('daily_free_requests');
  return val ? parseInt(val, 10) : 10;
}

export async function getFreeForAdmins(): Promise<boolean> {
  const val = await getSetting('free_for_admins');
  return val === '1' || val?.toLowerCase() === 'true';
}

export async function getBalance(userId: string): Promise<number> {
  const [row] = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
  return row ? parseFloat(row.balance) : 0;
}

export async function ensureBalanceRow(userId: string): Promise<void> {
  const [existing] = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
  if (!existing) {
    await db.insert(userBalances).values({ userId, balance: '0' }).onConflictDoNothing();
  }
}

export async function getDailyFreeCount(userId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsageLog)
    .where(
      and(
        eq(aiUsageLog.userId, userId),
        eq(aiUsageLog.isFree, true),
        gte(aiUsageLog.createdAt, todayStart)
      )
    );
  return result?.count ?? 0;
}

export interface BillingCheck {
  isFree: boolean;
  balance: number;
  canProceed: boolean;
}

export async function checkBilling(userId: string, isAdmin = false): Promise<BillingCheck> {
  await ensureBalanceRow(userId);
  const [freeLimit, freeCount, balance, freeForAdmins] = await Promise.all([
    getDailyFreeLimit(),
    getDailyFreeCount(userId),
    getBalance(userId),
    getFreeForAdmins(),
  ]);

  if (isAdmin && freeForAdmins) {
    return { isFree: true, balance, canProceed: true };
  }

  const isFree = freeCount < freeLimit;
  return {
    isFree,
    balance,
    canProceed: isFree || balance > 0,
  };
}

export interface UsageCost {
  inputTokens: number;
  outputTokens: number;
  baseCost: number;
  finalCost: number;
}

export function calculateCost(
  modelType: 'text' | 'image',
  inputPricePer1k: number,
  outputPricePer1k: number,
  fixedPrice: number,
  inputTokens: number,
  outputTokens: number,
  markupPercent: number
): UsageCost {
  let baseCost: number;
  if (modelType === 'image') {
    baseCost = fixedPrice;
  } else {
    baseCost = (inputTokens / 1000) * inputPricePer1k + (outputTokens / 1000) * outputPricePer1k;
  }
  const finalCost = baseCost * (1 + markupPercent / 100);
  return { inputTokens, outputTokens, baseCost, finalCost };
}

/**
 * Atomically deduct from balance. Returns new balance or null if insufficient.
 */
export async function deductBalance(userId: string, amount: number, description: string, referenceId?: string): Promise<number | null> {
  const costStr = amount.toFixed(2);

  const [updated] = await db.execute(sql`
    UPDATE user_balances
    SET balance = balance - ${costStr}::numeric, updated_at = now()
    WHERE user_id = ${userId} AND balance >= ${costStr}::numeric
    RETURNING balance::text as balance
  `) as unknown as Array<{ balance: string }>;

  if (!updated) return null;

  const newBalance = parseFloat(updated.balance);
  await db.insert(balanceTransactions).values({
    userId,
    amount: `-${costStr}`,
    type: 'ai_usage',
    description,
    referenceId,
    balanceAfter: updated.balance,
  });

  return newBalance;
}

export async function creditBalance(userId: string, amount: number, type: 'topup' | 'bonus' | 'refund', description: string, referenceId?: string): Promise<number> {
  await ensureBalanceRow(userId);
  const amtStr = amount.toFixed(2);

  const [updated] = await db.execute(sql`
    UPDATE user_balances
    SET balance = balance + ${amtStr}::numeric, updated_at = now()
    WHERE user_id = ${userId}
    RETURNING balance::text as balance
  `) as unknown as Array<{ balance: string }>;

  const newBalance = parseFloat(updated.balance);
  await db.insert(balanceTransactions).values({
    userId,
    amount: amtStr,
    type,
    description,
    referenceId,
    balanceAfter: updated.balance,
  });

  return newBalance;
}

export async function logUsage(
  userId: string,
  modelId: string | null,
  requestType: 'chat' | 'image' | 'quiz',
  cost: UsageCost,
  isFree: boolean
): Promise<string> {
  const [row] = await db.insert(aiUsageLog).values({
    userId,
    modelId,
    requestType,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    baseCost: cost.baseCost.toFixed(6),
    finalCost: cost.finalCost.toFixed(6),
    isFree,
  }).returning();
  return row.id;
}

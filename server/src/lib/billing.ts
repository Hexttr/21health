import { db } from '../db/index.js';
import { userBalances, balanceTransactions, aiUsageLog } from '../db/schema.js';
import { eq, and, sql, gte } from 'drizzle-orm';
import { getAllowedPlatformSetting } from './platform-settings.js';

export async function getSetting(key: string): Promise<string | null> {
  if (key === 'ai_quiz_model_id') {
    return getAllowedPlatformSetting(key);
  }
  return null;
}

export async function getMarkupPercent(): Promise<number> {
  return 0;
}

export async function getDailyFreeLimit(): Promise<number> {
  return Number.MAX_SAFE_INTEGER;
}

export async function getFreeForAdmins(): Promise<boolean> {
  return true;
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

  const result = await db.execute(sql`
    UPDATE user_balances
    SET balance = balance - ${costStr}::numeric, updated_at = now()
    WHERE user_id = ${userId} AND balance >= ${costStr}::numeric
    RETURNING balance::text as balance
  `);
  const updated = result.rows[0] as { balance: string } | undefined;

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

  const result = await db.execute(sql`
    UPDATE user_balances
    SET balance = balance + ${amtStr}::numeric, updated_at = now()
    WHERE user_id = ${userId}
    RETURNING balance::text as balance
  `);
  const updated = result.rows[0] as { balance: string } | undefined;

  if (!updated) {
    throw new Error('Не удалось обновить баланс пользователя');
  }

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

export async function setBalanceByAdmin(userId: string, nextBalance: number, adminUserId: string): Promise<number> {
  await ensureBalanceRow(userId);

  const normalizedBalance = Math.max(0, Number(nextBalance.toFixed(2)));

  return db.transaction(async (tx) => {
    const [currentRow] = await tx.select().from(userBalances).where(eq(userBalances.userId, userId));
    const currentBalance = currentRow ? parseFloat(currentRow.balance) : 0;
    const delta = Number((normalizedBalance - currentBalance).toFixed(2));

    await tx
      .update(userBalances)
      .set({
        balance: normalizedBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(userBalances.userId, userId));

    if (delta !== 0) {
      await tx.insert(balanceTransactions).values({
        userId,
        amount: delta.toFixed(2),
        type: 'admin_adjustment',
        description: `Корректировка баланса администратором ${adminUserId}`,
        balanceAfter: normalizedBalance.toFixed(2),
      });
    }

    return normalizedBalance;
  });
}

export async function logUsage(
  userId: string,
  modelId: string | null,
  requestType: 'chat' | 'image' | 'quiz' | 'tts',
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

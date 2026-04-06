import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userRoles } from '../db/schema.js';
import { creditBalance } from './billing.js';
import { getAllowedPlatformSetting } from './platform-settings.js';
import { tokensToRub } from './referrals.js';

export type AppRole = 'admin' | 'student_14' | 'student_21' | 'ai_user';

const DEFAULT_STUDENT_BONUS_TOKENS = 10000;

export async function getAiUserToStudentBonusTokens(): Promise<number> {
  const raw = await getAllowedPlatformSetting('ai_user_to_student_bonus_tokens');
  const parsed = Number.parseInt(raw || String(DEFAULT_STUDENT_BONUS_TOKENS), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_STUDENT_BONUS_TOKENS;
}

export async function grantFirstStudentBonusIfEligible(
  userId: string,
  previousRole: AppRole,
  nextRole: AppRole,
): Promise<number> {
  if (
    previousRole !== 'ai_user' ||
    (nextRole !== 'student_14' && nextRole !== 'student_21')
  ) {
    return 0;
  }

  const [user] = await db
    .select({ studentBonusGrantedAt: users.studentBonusGrantedAt })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || user.studentBonusGrantedAt) {
    return 0;
  }

  const bonusTokens = await getAiUserToStudentBonusTokens();
  const now = new Date();

  if (bonusTokens > 0) {
    const amountRub = await tokensToRub(bonusTokens);
    await creditBalance(
      userId,
      amountRub,
      'bonus',
      'Разовый бонус за первый переход из Пользователя ИИ в студента',
      `ai-user-to-student:${userId}`,
    );
  }

  await db
    .update(users)
    .set({
      studentBonusGrantedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return bonusTokens;
}

export async function setUserRoleWithStudentBonus(
  userId: string,
  nextRole: AppRole,
): Promise<{ role: AppRole; bonusAwardedTokens: number }> {
  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (!roleRow) {
    throw new Error('Роль пользователя не найдена');
  }

  const previousRole = roleRow.role as AppRole;
  if (previousRole === nextRole) {
    return { role: nextRole, bonusAwardedTokens: 0 };
  }

  await db.update(userRoles).set({ role: nextRole }).where(eq(userRoles.id, roleRow.id));
  const bonusAwardedTokens = await grantFirstStudentBonusIfEligible(userId, previousRole, nextRole);

  return { role: nextRole, bonusAwardedTokens };
}

ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_verified_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "student_bonus_granted_at";

DROP INDEX IF EXISTS "users_phone_idx";

DROP TABLE IF EXISTS "ai_attachments" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "balance_transactions" CASCADE;
DROP TABLE IF EXISTS "user_balances" CASCADE;
DROP TABLE IF EXISTS "oauth_identities" CASCADE;
DROP TABLE IF EXISTS "phone_verifications" CASCADE;
DROP TABLE IF EXISTS "referral_rewards" CASCADE;
DROP TABLE IF EXISTS "referral_attributions" CASCADE;
DROP TABLE IF EXISTS "referral_codes" CASCADE;
DROP TABLE IF EXISTS "course_access" CASCADE;
DROP TABLE IF EXISTS "course_orders" CASCADE;
DROP TABLE IF EXISTS "courses" CASCADE;
DROP TABLE IF EXISTS "waitlist" CASCADE;
DROP TABLE IF EXISTS "invitation_codes" CASCADE;
DROP TABLE IF EXISTS "ai_usage_log" CASCADE;

DELETE FROM "platform_settings"
WHERE "key" IN (
  'markup_percent',
  'daily_free_requests',
  'min_topup_amount',
  'max_topup_amount',
  'referral_signup_bonus_tokens',
  'referral_course_purchase_bonus_tokens',
  'token_exchange_rate_rub_to_tokens',
  'course_14_price_rub',
  'course_21_price_rub',
  'course_21_upgrade_price_rub',
  'phone_verification_required_for_referrals',
  'ai_user_to_student_bonus_tokens'
);

UPDATE "user_roles"
SET "role" = 'student'
WHERE "role" IN ('student_14', 'student_21', 'ai_user');

ALTER TABLE "user_roles"
  ALTER COLUMN "role" SET DEFAULT 'student';

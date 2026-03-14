ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "student_bonus_granted_at" timestamp with time zone;

INSERT INTO "platform_settings" ("key", "value", "description")
VALUES (
  'ai_user_to_student_bonus_tokens',
  '10000',
  'Разовый бонус в токенах за первый переход пользователя из роли ai_user в student'
)
ON CONFLICT ("key") DO NOTHING;

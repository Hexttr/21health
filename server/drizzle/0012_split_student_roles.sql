ALTER TABLE "user_roles"
  ALTER COLUMN "role" SET DEFAULT 'ai_user';

UPDATE "user_roles"
SET "role" = 'student_21'
WHERE "role" = 'student';

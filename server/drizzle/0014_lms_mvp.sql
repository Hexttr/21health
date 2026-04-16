-- LMS MVP: organization, courses, groups, assignments, tests, practice

-- Extend app roles (was admin | student)
ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_role_check";
ALTER TABLE "user_roles" ALTER COLUMN "role" DROP DEFAULT;
UPDATE "user_roles" SET "role" = 'learner' WHERE "role" = 'student';
ALTER TABLE "user_roles" ALTER COLUMN "role" SET DEFAULT 'learner';

CREATE TABLE IF NOT EXISTS "lms_organization" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_department" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "lms_organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_unit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "department_id" uuid NOT NULL REFERENCES "lms_department"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_position" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_employee" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "department_id" uuid REFERENCES "lms_department"("id") ON DELETE SET NULL,
  "unit_id" uuid REFERENCES "lms_unit"("id") ON DELETE SET NULL,
  "position_id" uuid REFERENCES "lms_position"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_course" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_course_module" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL REFERENCES "lms_course"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "module_kind" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_module_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "lms_course_module"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "item_type" text NOT NULL,
  "content" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_test" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_item_id" uuid NOT NULL UNIQUE REFERENCES "lms_module_item"("id") ON DELETE CASCADE,
  "pass_score_percent" integer DEFAULT 70 NOT NULL,
  "time_limit_sec" integer,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "cooldown_hours" integer DEFAULT 0 NOT NULL,
  "randomize_questions" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_question" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" uuid NOT NULL REFERENCES "lms_test"("id") ON DELETE CASCADE,
  "topic" text,
  "question_type" text NOT NULL,
  "body" jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_learning_group" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "tutor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "mentor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lms_group_member" (
  "group_id" uuid NOT NULL REFERENCES "lms_learning_group"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  PRIMARY KEY ("group_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "lms_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL REFERENCES "lms_course"("id") ON DELETE CASCADE,
  "assignee_type" text NOT NULL,
  "group_id" uuid REFERENCES "lms_learning_group"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "deadline_days" integer,
  "enforce_sequence" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "lms_assignment_group_unique"
  ON "lms_assignment" ("course_id", "group_id") WHERE "group_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "lms_assignment_user_unique"
  ON "lms_assignment" ("course_id", "user_id") WHERE "user_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "lms_enrollment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assignment_id" uuid NOT NULL REFERENCES "lms_assignment"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'active' NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("assignment_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "lms_item_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enrollment_id" uuid NOT NULL REFERENCES "lms_enrollment"("id") ON DELETE CASCADE,
  "module_item_id" uuid NOT NULL REFERENCES "lms_module_item"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'locked' NOT NULL,
  "completed_at" timestamptz,
  UNIQUE ("enrollment_id", "module_item_id")
);

CREATE TABLE IF NOT EXISTS "lms_test_attempt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" uuid NOT NULL REFERENCES "lms_test"("id") ON DELETE CASCADE,
  "enrollment_id" uuid NOT NULL REFERENCES "lms_enrollment"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "submitted_at" timestamptz,
  "score_percent" integer,
  "passed" boolean,
  "answers" jsonb
);

CREATE TABLE IF NOT EXISTS "lms_practice_submission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_item_id" uuid NOT NULL REFERENCES "lms_module_item"("id") ON DELETE CASCADE,
  "enrollment_id" uuid NOT NULL REFERENCES "lms_enrollment"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "file_urls" text[] DEFAULT ARRAY[]::text[],
  "comment" text,
  "submitted_at" timestamptz DEFAULT now() NOT NULL,
  "reviewed_at" timestamptz,
  "reviewer_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "mentor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "feedback" text
);

INSERT INTO "lms_organization" ("name")
SELECT 'ФГАУ «НМИЦ здоровья детей»'
WHERE NOT EXISTS (SELECT 1 FROM "lms_organization" LIMIT 1);

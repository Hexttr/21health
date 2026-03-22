ALTER TABLE "lesson_content"
  ADD COLUMN IF NOT EXISTS "video_titles" text[] DEFAULT '{}'::text[];

UPDATE "lesson_content"
SET "video_titles" = '{}'::text[]
WHERE "video_titles" IS NULL;

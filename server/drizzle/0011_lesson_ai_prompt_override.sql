ALTER TABLE "lesson_content"
  ADD COLUMN IF NOT EXISTS "ai_prompt_is_override" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "provider_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL UNIQUE REFERENCES "ai_providers"("id") ON DELETE CASCADE,
  "encrypted_value" text NOT NULL,
  "key_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "ai_models"
  ADD COLUMN IF NOT EXISTS "supports_streaming" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "supports_image_input" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "supports_image_output" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "supports_system_prompt" boolean NOT NULL DEFAULT true;

UPDATE "ai_models"
SET
  "supports_streaming" = CASE
    WHEN "model_type" = 'text' THEN true
    ELSE "supports_streaming"
  END,
  "supports_image_input" = CASE
    WHEN "model_type" = 'image' THEN true
    ELSE "supports_image_input"
  END,
  "supports_image_output" = CASE
    WHEN "model_type" = 'image' THEN true
    ELSE "supports_image_output"
  END,
  "supports_system_prompt" = CASE
    WHEN "model_type" = 'text' THEN true
    ELSE "supports_system_prompt"
  END;

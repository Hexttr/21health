CREATE TABLE IF NOT EXISTS "oauth_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "provider_user_id" text NOT NULL,
  "provider_email" text,
  "provider_email_verified" boolean NOT NULL DEFAULT false,
  "raw_profile_json" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_identities_provider_user_idx"
  ON "oauth_identities" ("provider", "provider_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_identities_user_provider_idx"
  ON "oauth_identities" ("user_id", "provider");

CREATE INDEX IF NOT EXISTS "oauth_identities_provider_email_idx"
  ON "oauth_identities" ("provider_email");

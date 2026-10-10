ALTER TABLE "ppl_playoffs"
ADD COLUMN IF NOT EXISTS "boardConfig" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "ppl_playoffs"
ADD COLUMN IF NOT EXISTS "categoryScores" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "ppl_playoffs"
ADD COLUMN IF NOT EXISTS "categorySchedule" jsonb NOT NULL DEFAULT '{}'::jsonb;

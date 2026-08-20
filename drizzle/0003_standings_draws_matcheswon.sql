ALTER TABLE "ppl_standings"
  ADD COLUMN IF NOT EXISTS "draws" integer NOT NULL DEFAULT 0;

ALTER TABLE "ppl_standings"
  ADD COLUMN IF NOT EXISTS "matchesWon" integer NOT NULL DEFAULT 0;

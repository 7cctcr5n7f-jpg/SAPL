/**
 * Adds the League Operations Console fields to ppl_fixtures:
 *   - courtAssignments  jsonb  (per-category court number + start time)
 *   - published         boolean
 *   - publishedAt       timestamp
 *   - publishedByUserId text
 *   - updatedByUserId   text
 *
 * Idempotent: safe to run multiple times (uses IF NOT EXISTS).
 * Run: node --env-file-if-exists=/vercel/share/.env.project -r esbuild-register scripts/migrate-fixture-console.ts
 *   or: npx tsx scripts/migrate-fixture-console.ts
 */
import { neon } from "@neondatabase/serverless"

const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED

if (!connectionString) {
  throw new Error("No database connection string found in env")
}

const sql = neon(connectionString)

async function main() {
  console.log("[migrate-fixture-console] Adding console fields to ppl_fixtures...")

  await sql`ALTER TABLE ppl_fixtures ADD COLUMN IF NOT EXISTS "courtAssignments" jsonb NOT NULL DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE ppl_fixtures ADD COLUMN IF NOT EXISTS "published" boolean NOT NULL DEFAULT false`
  await sql`ALTER TABLE ppl_fixtures ADD COLUMN IF NOT EXISTS "publishedAt" timestamp`
  await sql`ALTER TABLE ppl_fixtures ADD COLUMN IF NOT EXISTS "publishedByUserId" text`
  await sql`ALTER TABLE ppl_fixtures ADD COLUMN IF NOT EXISTS "updatedByUserId" text`

  // Backfill: any fixture that already has a result should count as published so
  // existing history stays visible to players after the gate is introduced.
  const backfilled = await sql`
    UPDATE ppl_fixtures
    SET "published" = true, "publishedAt" = COALESCE("publishedAt", "updatedAt")
    WHERE "published" = false AND "status" = 'completed'
    RETURNING id
  `
  console.log(`[migrate-fixture-console] Backfilled ${backfilled.length} completed fixtures as published`)

  console.log("[migrate-fixture-console] Done.")
}

main().catch((err) => {
  console.error("[migrate-fixture-console] Failed:", err)
  process.exit(1)
})

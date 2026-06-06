import { pool } from "@/lib/db"

/**
 * Idempotent migration: add per-court Playtomic booking links to fixtures.
 * Each category rubber in a fixture plays on its own court, so it gets its own
 * booking link. Stored as a JSON map of category -> url.
 */
async function main() {
  await pool.query(
    `ALTER TABLE ppl_fixtures ADD COLUMN IF NOT EXISTS "courtLinks" jsonb NOT NULL DEFAULT '{}'::jsonb;`,
  )
  console.log("[migrate] ppl_fixtures.courtLinks ready")
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

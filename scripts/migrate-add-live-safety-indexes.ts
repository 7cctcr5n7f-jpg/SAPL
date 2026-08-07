import { Pool } from "pg"

/**
 * Production-safety index migration (idempotent).
 *
 * Notes:
 * - Uses CREATE INDEX CONCURRENTLY to avoid long write locks on live tables.
 * - IF NOT EXISTS keeps reruns safe.
 * - This migration only adds indexes; it does not modify data.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("[migrate-live-indexes] Aborting: DATABASE_URL must be explicitly set in process env.")
    process.exit(1)
  }

  const confirm = process.env.LIVE_INDEX_MIGRATION_CONFIRM
  if (confirm !== "yes") {
    console.error("[migrate-live-indexes] Aborting: set LIVE_INDEX_MIGRATION_CONFIRM=yes to run this migration.")
    process.exit(1)
  }

  let hostname = ""
  try {
    hostname = new URL(databaseUrl).hostname
  } catch {
    console.error("[migrate-live-indexes] Aborting: DATABASE_URL is not a valid URL.")
    process.exit(1)
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    console.error(`[migrate-live-indexes] Aborting: unsafe DATABASE_URL host "${hostname}" is blocked.`)
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  console.log("[migrate-live-indexes] Creating safety indexes...")

  await pool.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ppl_payments_reference_idx ON ppl_payments ("reference");`,
  )
  await pool.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ppl_fixtures_season_published_division_matchdate_idx ON ppl_fixtures ("seasonId", "published", "divisionId", "matchDate");`,
  )
  await pool.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ppl_team_pairings_player_team_idx ON ppl_team_pairings ("playerId", "teamId");`,
  )
  await pool.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ppl_team_invites_team_status_idx ON ppl_team_invites ("teamId", "status");`,
  )

  console.log("[migrate-live-indexes] Done.")
  await pool.end()
}

main().catch((e) => {
  console.error("[migrate-live-indexes] Failed:", e)
  process.exit(1)
})

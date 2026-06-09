import { pool } from "@/lib/db"

/**
 * Idempotent migration: add the games-based scoring columns introduced with
 * set-by-set result entry.
 *
 * - ppl_matches.homeGames / awayGames  — total games won per rubber.
 * - ppl_standings.gamesFor / gamesAgainst — aggregated games used for the
 *   "Points Difference" (gamesFor - gamesAgainst) tiebreaker in the table.
 *
 * Drizzle's `select()` lists every column declared in the schema, so a database
 * branch missing these columns (e.g. the demo branch provisioned before they
 * were added) throws "column does not exist" and 500s the Team Admin page.
 * Running this brings any environment's schema in line with the code.
 */
async function main() {
  await pool.query(
    `ALTER TABLE ppl_matches
       ADD COLUMN IF NOT EXISTS "homeGames" integer NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "awayGames" integer NOT NULL DEFAULT 0;`,
  )
  console.log("[migrate] ppl_matches.homeGames / awayGames ready")

  await pool.query(
    `ALTER TABLE ppl_standings
       ADD COLUMN IF NOT EXISTS "gamesFor" integer NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "gamesAgainst" integer NOT NULL DEFAULT 0;`,
  )
  console.log("[migrate] ppl_standings.gamesFor / gamesAgainst ready")

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

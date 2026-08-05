import { pool } from "@/lib/db"

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ppl_fixture_planning_pairings (
      id serial PRIMARY KEY,
      "seasonId" integer NOT NULL,
      "divisionId" integer NOT NULL,
      "pairingOrder" integer NOT NULL DEFAULT 0,
      round integer NOT NULL DEFAULT 1,
      week integer,
      "teamAId" integer NOT NULL,
      "teamBId" integer NOT NULL,
      "homeTeamId" integer,
      "awayTeamId" integer,
      timeslot text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    );
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ppl_fixture_planning_pairings_season_idx
    ON ppl_fixture_planning_pairings ("seasonId");
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ppl_fixture_planning_pairings_division_idx
    ON ppl_fixture_planning_pairings ("divisionId");
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ppl_fixture_planning_pairings_week_idx
    ON ppl_fixture_planning_pairings (week);
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ppl_fixture_planning_pairings_unique_pair_idx
    ON ppl_fixture_planning_pairings ("seasonId", "divisionId", "teamAId", "teamBId");
  `)
  console.log("[migrate] ppl_fixture_planning_pairings ready")
  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

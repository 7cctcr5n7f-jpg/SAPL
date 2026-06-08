import { pool } from "@/lib/db"

/**
 * Idempotent migration for the granular permission + assignment system.
 *
 * 1. ppl_user_meta gains:
 *    - permissions    (jsonb, nullable)  null => use role defaults
 *    - clubOverrides  (jsonb)            { add:[], remove:[] } manual club assignment
 *    - teamOverrides  (jsonb)            { add:[], remove:[] } manual team assignment
 * 2. ppl_teams gains ownerEmail (text), backfilled from the team captain's
 *    email, then the home club contact email, then the organisation owner email.
 */
async function main() {
  await pool.query(
    `ALTER TABLE ppl_user_meta ADD COLUMN IF NOT EXISTS "permissions" jsonb;`,
  )
  await pool.query(
    `ALTER TABLE ppl_user_meta ADD COLUMN IF NOT EXISTS "clubOverrides" jsonb NOT NULL DEFAULT '{"add":[],"remove":[]}'::jsonb;`,
  )
  await pool.query(
    `ALTER TABLE ppl_user_meta ADD COLUMN IF NOT EXISTS "teamOverrides" jsonb NOT NULL DEFAULT '{"add":[],"remove":[]}'::jsonb;`,
  )
  console.log("[migrate] ppl_user_meta permission columns ready")

  await pool.query(`ALTER TABLE ppl_teams ADD COLUMN IF NOT EXISTS "ownerEmail" text;`)
  console.log("[migrate] ppl_teams.ownerEmail ready")

  // Backfill owner email only where it is still null, preserving any value set
  // by newer code paths. Priority: captain email > club contact email > org owner email.
  const res = await pool.query(`
    UPDATE ppl_teams t SET "ownerEmail" = COALESCE(
      (SELECT u.email FROM "user" u WHERE u.id = t."captainUserId"),
      (SELECT NULLIF(c."contactEmail", '') FROM ppl_clubs c WHERE c.id = t."homeClubId"),
      (SELECT ou.email FROM ppl_organisations o
         JOIN "user" ou ON ou.id = o."ownerUserId"
         WHERE o.id = t."organisationId")
    )
    WHERE t."ownerEmail" IS NULL;
  `)
  console.log(`[migrate] backfilled ownerEmail for ${res.rowCount ?? 0} team(s)`)

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

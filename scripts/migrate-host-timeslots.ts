import { pool } from "@/lib/db"

/**
 * Idempotent migration: per-court hosting time slots for venues.
 *
 * Adds `slotTimeslots` and `hostTimeslots` to ppl_clubs.
 *  - slotTimeslots: per-court time choice aligned to courtSlots — hosting
 *    courts hold "17:00" | "18:30" | "both", no-host courts hold "".
 *  - hostTimeslots: denormalised union of league-night slots the venue hosts.
 *
 * Backfill: existing venues default every hosting court to "both" (host at
 * both 17:00 and 18:30) which preserves their prior all-times behaviour.
 */
async function main() {
  await pool.query(`ALTER TABLE ppl_clubs ADD COLUMN IF NOT EXISTS "slotTimeslots" jsonb NOT NULL DEFAULT '[]'::jsonb;`)
  await pool.query(`ALTER TABLE ppl_clubs ADD COLUMN IF NOT EXISTS "hostTimeslots" jsonb NOT NULL DEFAULT '[]'::jsonb;`)
  console.log("[migrate] ppl_clubs.slotTimeslots / hostTimeslots columns ready")

  const { rows } = await pool.query<{
    id: number
    courtSlots: string[] | null
    slotTimeslots: string[] | null
  }>(`SELECT id, "courtSlots", "slotTimeslots" FROM ppl_clubs;`)

  let updated = 0
  for (const c of rows) {
    if (Array.isArray(c.slotTimeslots) && c.slotTimeslots.length) continue

    const courtSlots = Array.isArray(c.courtSlots) ? c.courtSlots : []
    // Default: hosting courts -> "both", no-host courts -> "".
    const slotTimeslots = courtSlots.map((m) => (m === "none" ? "" : "both"))
    const hostTimeslots = slotTimeslots.some((t) => t) ? ["17:00", "18:30"] : []

    await pool.query(
      `UPDATE ppl_clubs SET "slotTimeslots" = $1::jsonb, "hostTimeslots" = $2::jsonb WHERE id = $3;`,
      [JSON.stringify(slotTimeslots), JSON.stringify(hostTimeslots), c.id],
    )
    updated++
  }

  console.log(`[migrate] backfilled host timeslots for ${updated} venue(s)`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

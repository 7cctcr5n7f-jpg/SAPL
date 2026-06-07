import { pool } from "@/lib/db"

/**
 * Idempotent migration: per-court slot configuration for venues.
 *
 * Adds `publicSlots` and `courtSlots` to ppl_clubs. Each court is configured as
 * "team" (venue enters its own team), "public" (open as a home venue for a
 * public team) or "none" (does not host). The counts (`teamsEntering`,
 * `publicSlots`) and `hostingCapacity`/`hostsThursday` are derived from this.
 *
 * Backfill: for existing venues we reconstruct a slot list from their current
 * `teamsEntering` and `hostingCapacity`. The first `teamsEntering` courts become
 * "team", the next `(hostingCapacity - teamsEntering)` become "public", and the
 * remainder up to `courts` become "none".
 */
async function main() {
  await pool.query(`ALTER TABLE ppl_clubs ADD COLUMN IF NOT EXISTS "publicSlots" integer NOT NULL DEFAULT 0;`)
  await pool.query(
    `ALTER TABLE ppl_clubs ADD COLUMN IF NOT EXISTS "courtSlots" jsonb NOT NULL DEFAULT '[]'::jsonb;`,
  )
  console.log("[migrate] ppl_clubs.publicSlots / courtSlots columns ready")

  const { rows } = await pool.query<{
    id: number
    courts: number
    teamsEntering: number
    hostingCapacity: number
    courtSlots: string[] | null
  }>(`SELECT id, courts, "teamsEntering", "hostingCapacity", "courtSlots" FROM ppl_clubs;`)

  let updated = 0
  for (const c of rows) {
    // Skip venues that already have a slot list.
    if (Array.isArray(c.courtSlots) && c.courtSlots.length) continue

    const courts = Math.max(0, c.courts ?? 0)
    const teamSlots = Math.min(courts, Math.max(0, c.teamsEntering ?? 0))
    const publicSlots = Math.min(courts - teamSlots, Math.max(0, (c.hostingCapacity ?? 0) - teamSlots))
    const slots: string[] = []
    for (let i = 0; i < courts; i++) {
      if (i < teamSlots) slots.push("team")
      else if (i < teamSlots + publicSlots) slots.push("public")
      else slots.push("none")
    }

    await pool.query(
      `UPDATE ppl_clubs
         SET "courtSlots" = $1::jsonb,
             "publicSlots" = $2,
             "teamsEntering" = $3,
             "hostingCapacity" = $4,
             "hostsThursday" = $5
       WHERE id = $6;`,
      [JSON.stringify(slots), publicSlots, teamSlots, teamSlots + publicSlots, teamSlots + publicSlots > 0, c.id],
    )
    updated++
  }

  console.log(`[migrate] backfilled court slots for ${updated} venue(s)`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

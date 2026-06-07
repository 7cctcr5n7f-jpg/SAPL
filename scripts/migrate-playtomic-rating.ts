import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// Adds the admin-managed Playtomic rating column to players. Idempotent.
async function main() {
  await db.execute(
    sql`ALTER TABLE "ppl_players" ADD COLUMN IF NOT EXISTS "playtomicRating" double precision`,
  )
  console.log("[v0] playtomicRating column ensured on ppl_players")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

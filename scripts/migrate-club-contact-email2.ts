import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// Adds contactEmail2 to ppl_clubs for a second co-manager email. Idempotent.
async function main() {
  await db.execute(sql`
    ALTER TABLE "ppl_clubs"
    ADD COLUMN IF NOT EXISTS "contactEmail2" text
  `)
  console.log("[migrate] ppl_clubs.contactEmail2 column ensured")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

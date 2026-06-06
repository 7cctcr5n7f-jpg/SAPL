import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

async function main() {
  console.log("[v0] Adding playerFee column to ppl_seasons...")
  await db.execute(sql`ALTER TABLE ppl_seasons ADD COLUMN IF NOT EXISTS "playerFee" integer NOT NULL DEFAULT 500`)
  console.log("[v0] Done.")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

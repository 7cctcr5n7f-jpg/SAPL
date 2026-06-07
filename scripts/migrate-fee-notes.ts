import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// Creates the billing-management fee notes table. Idempotent.
async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ppl_fee_notes" (
      "id" serial PRIMARY KEY,
      "kind" text NOT NULL,
      "teamId" integer NOT NULL,
      "playerId" integer NOT NULL,
      "note" text,
      "lastReminderAt" timestamp,
      "reminderCount" integer NOT NULL DEFAULT 0,
      "updatedByUserId" text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `)
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "ppl_fee_notes_key_idx" ON "ppl_fee_notes" ("kind", "teamId", "playerId")`,
  )
  console.log("[v0] ppl_fee_notes table ensured")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

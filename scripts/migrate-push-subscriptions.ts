import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// Creates the Web Push subscriptions table used by the PWA. Idempotent.
async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ppl_push_subscriptions" (
      "id" serial PRIMARY KEY,
      "userId" text,
      "endpoint" text NOT NULL,
      "p256dh" text NOT NULL,
      "auth" text NOT NULL,
      "userAgent" text,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `)
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "ppl_push_subscriptions_endpoint_idx" ON "ppl_push_subscriptions" ("endpoint")`,
  )
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "ppl_push_subscriptions_user_idx" ON "ppl_push_subscriptions" ("userId")`,
  )
  console.log("[v0] ppl_push_subscriptions table ensured")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

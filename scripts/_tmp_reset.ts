import { auth } from "@/lib/auth"
import { db, pool } from "@/lib/db"
import { user, account } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

const EMAIL = "marijke.roux1708@gmail.com"
const NEW_PASSWORD = "Test@1234"

async function main() {
  const [u] = await db.select().from(user).where(eq(user.email, EMAIL)).limit(1)
  if (!u) throw new Error(`No user found for ${EMAIL}`)
  const ctx = await auth.$context
  const hash = await ctx.password.hash(NEW_PASSWORD)
  const [cred] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, u.id), eq(account.providerId, "credential")))
    .limit(1)
  if (cred) {
    await db.update(account).set({ password: hash, updatedAt: new Date() }).where(eq(account.id, cred.id))
  } else {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
  console.log("[v0] reset done for", EMAIL)
  await pool.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})

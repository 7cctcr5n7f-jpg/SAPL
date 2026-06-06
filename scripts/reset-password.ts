import { auth } from "@/lib/auth"
import { db, pool } from "@/lib/db"
import { user, account } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

const EMAIL = "roux.ruan@icloud.com"
const NEW_PASSWORD = process.env.RESET_PW as string

async function main() {
  if (!NEW_PASSWORD) throw new Error("RESET_PW env var required")

  const [u] = await db.select().from(user).where(eq(user.email, EMAIL)).limit(1)
  if (!u) throw new Error(`No user found for ${EMAIL}`)
  console.log("[v0] Found user:", u.id, u.email)

  // Hash with Better Auth's own password hasher so sign-in validates correctly.
  const ctx = await auth.$context
  const hash = await ctx.password.hash(NEW_PASSWORD)

  const [cred] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, u.id), eq(account.providerId, "credential")))
    .limit(1)

  if (cred) {
    await db
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(account.id, cred.id))
    console.log("[v0] Updated existing credential account:", cred.id)
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
    console.log("[v0] Created new credential account for user")
  }

  console.log("[v0] Password reset complete for", EMAIL)
  await pool.end()
}

main().catch((e) => {
  console.error("[v0] Reset failed:", e)
  process.exit(1)
})

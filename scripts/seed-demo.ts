import { runDemoSeed } from "@/lib/demo-seed"
import { pool } from "@/lib/db"

/**
 * Seeds the Demo Environment database.
 *
 * SAFETY: this wipes ALL data (including users/PII) in whatever database
 * DATABASE_URL points at, then fills it with synthetic demo data. It must only
 * ever be run against the dedicated demo Neon branch — never production.
 * Guarded by DEMO_SEED_CONFIRM=yes to prevent accidental runs.
 */
async function main() {
  if (process.env.DEMO_SEED_CONFIRM !== "yes") {
    console.error(
      "[demo-seed] Refusing to run without DEMO_SEED_CONFIRM=yes. " +
        "This wipes the target database. Only run against the demo branch.",
    )
    process.exit(1)
  }

  const url = process.env.DATABASE_URL ?? ""
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return "unknown"
    }
  })()
  console.log(`[demo-seed] Target database host: ${host}`)

  const summary = await runDemoSeed()
  console.log("[demo-seed] complete:", JSON.stringify(summary, null, 2))

  if (summary.strayUsers > 0) {
    console.error(`[demo-seed] WARNING: ${summary.strayUsers} non-demo users remain!`)
    process.exit(1)
  }

  await pool.end()
  process.exit(0)
}

main().catch((err) => {
  console.error("[demo-seed] failed:", err)
  process.exit(1)
})

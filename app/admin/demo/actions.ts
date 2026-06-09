"use server"

import { db } from "@/lib/db"
import { teams } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { assertDemo } from "@/lib/demo"
import { runDemoSeed } from "@/lib/demo-seed"
import { recomputeTeamStats } from "@/lib/engine/team-stats"

/**
 * Admin-only Demo Environment controls. Every action is double-guarded:
 *   1. assertDemo() — throws unless this deployment is the demo one, so these
 *      can never run against production even if the route is somehow reached.
 *   2. requireAdmin() — league/super admin session required.
 */
async function requireDemoAdmin() {
  assertDemo()
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  if (user.realRole !== "league_admin" && user.realRole !== "super_admin") {
    throw new Error("League admin access required")
  }
  return user
}

function revalidateAll() {
  for (const p of ["/", "/admin", "/admin/demo", "/dashboard", "/league-centre", "/rankings", "/clubs"]) {
    revalidatePath(p, "layout")
  }
}

/**
 * Reset & Regenerate are the same destructive operation here: wipe the demo
 * branch (including any real PII carried over from the production fork) and
 * rebuild a fresh synthetic league + demo logins. We expose two labels in the
 * UI for clarity, but both call the single safe path.
 */
export async function resetDemoData() {
  await requireDemoAdmin()
  try {
    const summary = await runDemoSeed()
    revalidateAll()
    return { ok: true as const, summary }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Demo reset failed" }
  }
}

/** Recompute cached team aggregates (avg LI, player counts, region sync). */
export async function refreshDemoRankings() {
  await requireDemoAdmin()
  try {
    const allTeams = await db.select({ id: teams.id }).from(teams)
    for (const t of allTeams) {
      await recomputeTeamStats(t.id)
    }
    revalidateAll()
    return { ok: true as const, teams: allTeams.length }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Refresh failed" }
  }
}

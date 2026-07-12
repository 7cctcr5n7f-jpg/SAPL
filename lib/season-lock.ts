import { db } from "@/lib/db"
import { seasons } from "@/lib/db/schema"
import { inArray } from "drizzle-orm"

/**
 * Season lock state.
 *
 * When any season is league-locked (started), org/team and club editing is locked
 * across the app: team names, home venues, and club court-slot / own-team /
 * public-slot settings can no longer change. Admins can re-open editing with
 * the "Unlock season" action, which moves the season back to "divisions_finalised".
 *
 * The lock is global (not per-season) because clubs are not tied to a single
 * season — once a season is live, the venue/team configuration that produced
 * its fixtures must stay frozen.
 */
export async function isSeasonLocked(): Promise<boolean> {
  const [active] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(inArray(seasons.status, ["league_locked", "active", "published"]))
    .limit(1)
  return Boolean(active)
}

/** Throw if editing is locked by an active season. Use in server actions. */
export async function assertNotSeasonLocked(): Promise<void> {
  if (await isSeasonLocked()) {
    throw new Error("This season has started and is locked. Unlock it under League Management to edit.")
  }
}

/** Consistent action result for structural mutations blocked after lock. */
export function seasonLockedResult() {
  return {
    ok: false as const,
    error:
      "The league is locked. Structural changes are disabled (teams, divisions, fixtures, and venues).",
  }
}

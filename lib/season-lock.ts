import { db } from "@/lib/db"
import { seasons } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Season lock state.
 *
 * When any season is "active" (started), org/team and club editing is locked
 * across the app: team names, home venues, and club court-slot / own-team /
 * public-slot settings can no longer change. Admins can re-open editing with
 * the "Unlock season" action, which moves the season back to "validated".
 *
 * The lock is global (not per-season) because clubs are not tied to a single
 * season — once a season is live, the venue/team configuration that produced
 * its fixtures must stay frozen.
 */
export async function isSeasonLocked(): Promise<boolean> {
  const [active] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, "active"))
    .limit(1)
  return Boolean(active)
}

/** Throw if editing is locked by an active season. Use in server actions. */
export async function assertNotSeasonLocked(): Promise<void> {
  if (await isSeasonLocked()) {
    throw new Error("This season has started and is locked. Unlock it under League Management to edit.")
  }
}

"use server"

import { db } from "@/lib/db"
import { fixtures, clubs, organisations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { revalidatePath } from "next/cache"

function normalizeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) return `https://${v}`
  return v
}

/** True when the user is a league/super admin. */
function isLeagueAdmin(role: string) {
  return role === "league_admin" || role === "super_admin"
}

/**
 * Does this user have authority over a fixture for link editing?
 * League admins always; otherwise only the org owner whose own club hosts the
 * fixture. A manager cannot edit links for matches their team plays away at
 * another club's venue.
 */
async function canManageFixtureLink(userId: string, role: string, fixtureId: number) {
  if (isLeagueAdmin(role)) return true
  const [org] = await db.select().from(organisations).where(eq(organisations.ownerUserId, userId)).limit(1)
  if (!org) return false
  const [fx] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!fx || fx.venueClubId == null) return false

  const orgClubIds = (await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.organisationId, org.id))).map(
    (c) => c.id,
  )
  return orgClubIds.includes(fx.venueClubId)
}

/** Set (or clear) a fixture's Playtomic booking link. */
export async function setFixturePlaytomicUrl(fixtureId: number, url: string) {
  const user = await requireUser()
  const allowed = await canManageFixtureLink(user.id, user.realRole, fixtureId)
  if (!allowed) return { ok: false, error: "Not authorised to edit this fixture" }

  await db
    .update(fixtures)
    .set({ playtomicUrl: normalizeUrl(url), updatedAt: new Date() })
    .where(eq(fixtures.id, fixtureId))

  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

/** Set (or clear) a single court's Playtomic booking link for a category. */
export async function setFixtureCourtLink(fixtureId: number, category: string, url: string) {
  const user = await requireUser()
  const allowed = await canManageFixtureLink(user.id, user.realRole, fixtureId)
  if (!allowed) return { ok: false, error: "Not authorised to edit this fixture" }

  const [fx] = await db.select({ courtLinks: fixtures.courtLinks }).from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!fx) return { ok: false, error: "Fixture not found" }

  const next: Record<string, string> = { ...(fx.courtLinks ?? {}) }
  const normalized = normalizeUrl(url)
  if (normalized) next[category] = normalized
  else delete next[category]

  await db.update(fixtures).set({ courtLinks: next, updatedAt: new Date() }).where(eq(fixtures.id, fixtureId))
  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

/** Set a fixture's league-night timeslot ("17:00" | "18:30"). */
export async function setFixtureTimeslot(fixtureId: number, timeslot: string | null) {
  const user = await requireUser()
  if (!isLeagueAdmin(user.realRole)) return { ok: false, error: "League admin access required" }
  const value = timeslot && /^\d{1,2}:\d{2}$/.test(timeslot) ? timeslot : null
  await db.update(fixtures).set({ timeslot: value, updatedAt: new Date() }).where(eq(fixtures.id, fixtureId))
  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

/** Change a fixture's host venue (league admins only). */
export async function setFixtureVenue(fixtureId: number, venueClubId: number | null) {
  const user = await requireUser()
  if (!isLeagueAdmin(user.realRole)) return { ok: false, error: "League admin access required" }

  let venue: string | null = null
  if (venueClubId != null) {
    const [club] = await db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, venueClubId)).limit(1)
    venue = club?.name ?? null
  }

  await db
    .update(fixtures)
    .set({ venueClubId, venue, updatedAt: new Date() })
    .where(eq(fixtures.id, fixtureId))

  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

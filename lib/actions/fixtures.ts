"use server"

import { db } from "@/lib/db"
import { fixtures, clubs } from "@/lib/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { revalidatePath } from "next/cache"
import { notifyTeam } from "@/lib/notify"
import { CATEGORY_RULES } from "@/lib/constants"

// Courts a single fixture (tie) consumes — one per category.
const COURTS_PER_FIXTURE = CATEGORY_RULES.length

/**
 * Free courts at `venueClubId` for `week`+`timeslot`, excluding `fixtureId`
 * itself. Returns null when capacity can't be determined (no venue/timeslot).
 */
async function freeCourtsAt(
  fixtureId: number,
  venueClubId: number,
  week: number,
  timeslot: string,
): Promise<number | null> {
  const [club] = await db.select({ courts: clubs.courts }).from(clubs).where(eq(clubs.id, venueClubId)).limit(1)
  const courts = club?.courts ?? 0
  const others = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.venueClubId, venueClubId),
        eq(fixtures.week, week),
        eq(fixtures.timeslot, timeslot),
        ne(fixtures.id, fixtureId),
      ),
    )
  return courts - others.length * COURTS_PER_FIXTURE
}

/**
 * Notify both teams in a fixture about a scheduling change. No-ops for template
 * fixtures that don't yet have both teams assigned.
 */
async function notifyFixtureTeams(fixtureId: number, type: string, title: string, body: string) {
  const [fx] = await db
    .select({ homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fx) return
  const targets = [fx.homeTeamId, fx.awayTeamId].filter((id): id is number => id != null)
  const href = `/league-centre/match/${fixtureId}`
  await Promise.all(targets.map((teamId) => notifyTeam(teamId, { type, title, body, fixtureId, href })))
}

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
 * League admins always; otherwise any club manager (assigned via the club's
 * contact email or a manual Members & Roles assignment) whose own club hosts
 * the fixture. A manager cannot edit links for matches their team plays away at
 * another club's venue.
 */
async function canManageFixtureLink(fixtureId: number) {
  const user = await requireUser()
  const access = await getAccessContext(user)
  if (access.isLeagueAdmin) return true
  if (!access.can("fixture_management")) return false

  const [fx] = await db
    .select({ venueClubId: fixtures.venueClubId })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fx || fx.venueClubId == null) return false
  return access.canManageClub(fx.venueClubId)
}

/** Set (or clear) a fixture's Playtomic booking link. */
export async function setFixturePlaytomicUrl(fixtureId: number, url: string) {
  const allowed = await canManageFixtureLink(fixtureId)
  if (!allowed) return { ok: false, error: "Not authorised to edit this fixture" }

  const normalized = normalizeUrl(url)
  await db
    .update(fixtures)
    .set({ playtomicUrl: normalized, updatedAt: new Date() })
    .where(eq(fixtures.id, fixtureId))

  if (normalized) {
    await notifyFixtureTeams(
      fixtureId,
      "fixture_ready",
      "Your fixture is ready to book",
      "A Playtomic booking link was added for your match night. Tap to view and join.",
    )
  }

  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
  return { ok: true }
}

/** Set (or clear) a single court's Playtomic booking link for a category. */
export async function setFixtureCourtLink(fixtureId: number, category: string, url: string) {
  const allowed = await canManageFixtureLink(fixtureId)
  if (!allowed) return { ok: false, error: "Not authorised to edit this fixture" }

  const [fx] = await db.select({ courtLinks: fixtures.courtLinks }).from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!fx) return { ok: false, error: "Fixture not found" }

  const next: Record<string, string> = { ...(fx.courtLinks ?? {}) }
  const normalized = normalizeUrl(url)
  if (normalized) next[category] = normalized
  else delete next[category]

  await db.update(fixtures).set({ courtLinks: next, updatedAt: new Date() }).where(eq(fixtures.id, fixtureId))

  // Adding (not clearing) a court link makes the fixture bookable — let both
  // teams know their match night is ready to join on Playtomic.
  if (normalized) {
    await notifyFixtureTeams(
      fixtureId,
      "fixture_ready",
      "Your fixture is ready to book",
      `A Playtomic court link was added for ${category}. Tap to view and join.`,
    )
  }

  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
  return { ok: true }
}

/** Set a fixture's league-night timeslot ("17:00" | "18:30"). */
export async function setFixtureTimeslot(fixtureId: number, timeslot: string | null) {
  const user = await requireUser()
  if (!isLeagueAdmin(user.realRole)) return { ok: false, error: "League admin access required" }
  const value = timeslot && /^\d{1,2}:\d{2}$/.test(timeslot) ? timeslot : null

  // Block moving a fixture into a timeslot that has no free courts at its venue.
  if (value) {
    const [fx] = await db
      .select({ venueClubId: fixtures.venueClubId, week: fixtures.week })
      .from(fixtures)
      .where(eq(fixtures.id, fixtureId))
      .limit(1)
    if (fx?.venueClubId != null) {
      const free = await freeCourtsAt(fixtureId, fx.venueClubId, fx.week, value)
      if (free != null && free < COURTS_PER_FIXTURE) {
        return { ok: false, error: `No free courts at this venue for ${value}. Choose another time or venue.` }
      }
    }
  }

  await db.update(fixtures).set({ timeslot: value, updatedAt: new Date() }).where(eq(fixtures.id, fixtureId))
  await notifyFixtureTeams(
    fixtureId,
    "fixture_updated",
    "Fixture time updated",
    value ? `Your match night is now scheduled for ${value}. Tap to view.` : "Your match night time was cleared.",
  )
  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
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

    // Block moving a fixture to a venue that has no free courts in its timeslot.
    const [fx] = await db
      .select({ week: fixtures.week, timeslot: fixtures.timeslot })
      .from(fixtures)
      .where(eq(fixtures.id, fixtureId))
      .limit(1)
    if (fx?.timeslot) {
      const free = await freeCourtsAt(fixtureId, venueClubId, fx.week, fx.timeslot)
      if (free != null && free < COURTS_PER_FIXTURE) {
        return { ok: false, error: `${venue ?? "That venue"} has no free courts at ${fx.timeslot}. Pick another venue or change the time.` }
      }
    }
  }

  await db
    .update(fixtures)
    .set({ venueClubId, venue, updatedAt: new Date() })
    .where(eq(fixtures.id, fixtureId))

  await notifyFixtureTeams(
    fixtureId,
    "fixture_updated",
    "Fixture venue updated",
    venue ? `Your match night is now hosted at ${venue}. Tap to view.` : "Your match night venue was cleared.",
  )

  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
  return { ok: true }
}

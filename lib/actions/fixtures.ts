"use server"

import { db } from "@/lib/db"
import { fixtures, clubs, teams, teamEntries } from "@/lib/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { revalidatePath, revalidateTag } from "next/cache"
import { notifyTeam } from "@/lib/notify"
import { CATEGORY_RULES } from "@/lib/constants"
import { canPublish, type CourtAssignments, type CourtLinks } from "@/lib/fixtures-ops"
import { buildCourtAssignments } from "@/lib/engine/season"
import { validateSeason, type SeasonValidation } from "@/lib/engine/validation"

// Courts a single fixture (tie) consumes — one per category.
const COURTS_PER_FIXTURE = CATEGORY_RULES.length

function revalidateFixtureSurfaces() {
  revalidateFixtureSurfaces()
  revalidateTag("league-centre-shared")
}

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

/** True when the user is a super admin. */
function isLeagueAdmin(role: string) {
  return role === "super_admin"
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

  const [fx] = await db
    .select({ venueClubId: fixtures.venueClubId, homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fx) return false

  // Club owners can edit fixtures hosted at their own club.
  if (!fx.venueClubId || !fx.homeTeamId || !fx.awayTeamId) return false
  const [meta] = await db.select({ published: fixtures.published }).from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!meta?.published) return false
  if (fx.venueClubId != null && access.canManageClub(fx.venueClubId)) return true

  // Team owners/captains can edit fixtures involving their own teams.
  return (
    (fx.homeTeamId != null && access.ownedTeamIds.includes(fx.homeTeamId)) ||
    (fx.awayTeamId != null && access.ownedTeamIds.includes(fx.awayTeamId))
  )
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

  revalidateFixtureSurfaces()
  return { ok: true }
}

/** Save draft scheduling fields for a fixture and re-run season validation. */
export async function saveFixtureSchedule(input: {
  fixtureId: number
  week: number
  matchDate: string | null
  venueClubId: number | null
  timeslot: string | null
  homeTeamId: number
  awayTeamId: number
}): Promise<{ ok: boolean; error?: string; report?: SeasonValidation }> {
  const user = await requireUser()
  if (!isLeagueAdmin(user.realRole)) return { ok: false, error: "League admin access required" }
  if (input.homeTeamId === input.awayTeamId) return { ok: false, error: "Home and away teams must be different." }
  if (!Number.isFinite(input.week) || input.week < 1) return { ok: false, error: "Week must be 1 or greater." }

  const [fixture] = await db
    .select({
      id: fixtures.id,
      seasonId: fixtures.seasonId,
      divisionId: fixtures.divisionId,
      courtAssignments: fixtures.courtAssignments,
    })
    .from(fixtures)
    .where(eq(fixtures.id, input.fixtureId))
    .limit(1)
  if (!fixture) return { ok: false, error: "Fixture not found." }

  const divisionTeams = await db
    .select({ teamId: teamEntries.teamId, homeClubId: teams.homeClubId, slot: teamEntries.slot })
    .from(teamEntries)
    .innerJoin(teams, eq(teams.id, teamEntries.teamId))
    .where(and(eq(teamEntries.seasonId, fixture.seasonId), eq(teamEntries.divisionId, fixture.divisionId), eq(teamEntries.status, "assigned")))

  const divisionTeamIds = new Set(divisionTeams.map((team) => team.teamId))
  if (!divisionTeamIds.has(input.homeTeamId) || !divisionTeamIds.has(input.awayTeamId)) {
    return { ok: false, error: "Both teams must belong to this division." }
  }

  let venueName: string | null = null
  let venueCourts = 0
  const homeEntry = divisionTeams.find((team) => team.teamId === input.homeTeamId)
  const awayEntry = divisionTeams.find((team) => team.teamId === input.awayTeamId)
  if (input.venueClubId != null) {
    const [club] = await db.select({ name: clubs.name, courts: clubs.courts }).from(clubs).where(eq(clubs.id, input.venueClubId)).limit(1)
    if (!club) return { ok: false, error: "Venue not found." }
    venueName = club.name
    venueCourts = club.courts ?? 0
  } else {
    if (homeEntry?.homeClubId != null) {
      const [club] = await db.select({ id: clubs.id, name: clubs.name, courts: clubs.courts }).from(clubs).where(eq(clubs.id, homeEntry.homeClubId)).limit(1)
      if (club) {
        input.venueClubId = club.id
        venueName = club.name
        venueCourts = club.courts ?? 0
      }
    }
  }

  const currentAssignments = (fixture.courtAssignments ?? {}) as CourtAssignments
  const nextAssignments =
    Object.keys(currentAssignments).length > 0
      ? currentAssignments
      : buildCourtAssignments(venueCourts, input.timeslot === "17:00" || input.timeslot === "18:30" ? input.timeslot : null)

  await db
    .update(fixtures)
    .set({
      week: input.week,
      matchDate: input.matchDate ? new Date(`${input.matchDate}T19:00:00`) : null,
      venueClubId: input.venueClubId,
      venue: venueName,
      timeslot: input.timeslot,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeSlot: homeEntry?.slot ?? null,
      awaySlot: awayEntry?.slot ?? null,
      courtAssignments: nextAssignments,
      updatedByUserId: user.id,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, input.fixtureId))

  const report = await validateSeason(fixture.seasonId)
  revalidatePath("/admin")
  revalidateFixtureSurfaces()
  return { ok: true, report }
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

  revalidateFixtureSurfaces()
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
  revalidateFixtureSurfaces()
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

  revalidateFixtureSurfaces()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// League Operations Console: per-category scheduling + publish workflow
// ---------------------------------------------------------------------------

/** Resolve the acting user and confirm they may edit this fixture's booking. */
async function authorizeFixtureEdit(fixtureId: number) {
  const user = await requireUser()
  const access = await getAccessContext(user)
  if (access.isLeagueAdmin) return { user, ok: true as const }

  const [fx] = await db
    .select({ venueClubId: fixtures.venueClubId, homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId, published: fixtures.published })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fx) return { user, ok: false as const }
  if (!fx.published) return { user, ok: false as const }

  if (fx.venueClubId != null && access.canManageClub(fx.venueClubId)) return { user, ok: true as const }
  if ((fx.homeTeamId != null && access.ownedTeamIds.includes(fx.homeTeamId)) || (fx.awayTeamId != null && access.ownedTeamIds.includes(fx.awayTeamId))) {
    return { user, ok: true as const }
  }
  return { user, ok: false as const }
}

/**
 * Save the court number, start time and booking link for a single category of a
 * fixture. Court + time live in `courtAssignments`, the link in `courtLinks`.
 */
export async function saveCategoryAssignment(
  fixtureId: number,
  category: string,
  input: { court?: string | null; time?: string | null; link?: string | null },
) {
  const auth = await authorizeFixtureEdit(fixtureId)
  if (!auth.ok) return { ok: false, error: "Not authorised to edit this fixture" }

  const [fx] = await db
    .select({ courtAssignments: fixtures.courtAssignments, courtLinks: fixtures.courtLinks })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fx) return { ok: false, error: "Fixture not found" }

  const nextAssignments: CourtAssignments = { ...(fx.courtAssignments ?? {}) }
  const court = input.court != null ? String(input.court).trim() || null : nextAssignments[category]?.court ?? null
  const timeRaw = input.time != null ? input.time.trim() : nextAssignments[category]?.time ?? null
  const time = timeRaw && /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw : timeRaw || null
  nextAssignments[category] = { court, time }

  const nextLinks: CourtLinks = { ...(fx.courtLinks ?? {}) }
  let linkAdded = false
  if (input.link !== undefined) {
    const normalized = normalizeUrl(input.link ?? "")
    if (normalized) {
      nextLinks[category] = normalized
      linkAdded = true
    } else {
      delete nextLinks[category]
    }
  }

  await db
    .update(fixtures)
    .set({
      courtAssignments: nextAssignments,
      courtLinks: nextLinks,
      updatedByUserId: auth.user.id,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, fixtureId))

  if (linkAdded) {
    await notifyFixtureTeams(
      fixtureId,
      "fixture_ready",
      "Your fixture is ready to book",
      `A Playtomic court link was added for ${category}. Tap to view and join.`,
    )
  }

  revalidateFixtureSurfaces()
  return { ok: true }
}

/** Publish a fixture so players can see it and join in League Centre. */
export async function publishFixture(fixtureId: number, options?: { ignoreWarnings?: boolean }) {
  const auth = await authorizeFixtureEdit(fixtureId)
  if (!auth.ok) return { ok: false, error: "Not authorised to publish this fixture" }

  const [fx] = await db
    .select({
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      venueClubId: fixtures.venueClubId,
      matchDate: fixtures.matchDate,
      status: fixtures.status,
      published: fixtures.published,
      courtAssignments: fixtures.courtAssignments,
      courtLinks: fixtures.courtLinks,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fx) return { ok: false, error: "Fixture not found" }

  const gate = canPublish(fx)
  if (!gate.ok) return { ok: false, error: gate.reason ?? "Fixture is not ready to publish." }

   const [fixtureSeason] = await db
    .select({ seasonId: fixtures.seasonId })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fixtureSeason) return { ok: false, error: "Fixture not found" }

  const report = await validateSeason(fixtureSeason.seasonId)
  if (report.errors > 0) {
    const blockingIssues = report.issues.filter((issue) => issue.level === "error")
    const onlyWarningsRequested = options?.ignoreWarnings === true
    const hasOnlyPublishWarnings = blockingIssues.every((issue) =>
      issue.code === "home_away_balance" || issue.code === "venue_unavailable_slot",
    )
    if (!onlyWarningsRequested || !hasOnlyPublishWarnings) {
      return {
        ok: false,
        error: `${report.errors} validation error${report.errors === 1 ? "" : "s"} still need attention before publishing.`,
        report,
      }
    }
  }

  await db
    .update(fixtures)
    .set({
      published: true,
      publishedAt: new Date(),
      publishedByUserId: auth.user.id,
      updatedByUserId: auth.user.id,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, fixtureId))

  await notifyFixtureTeams(
    fixtureId,
    "fixture_ready",
    "Your fixture is live",
    "Your match night has been published. Tap to view your categories and join.",
  )

  revalidateFixtureSurfaces()
  return { ok: true, report }
}

/** Unpublish a fixture, hiding it from players again. */
export async function unpublishFixture(fixtureId: number) {
  const auth = await authorizeFixtureEdit(fixtureId)
  if (!auth.ok) return { ok: false, error: "Not authorised to unpublish this fixture" }

  await db
    .update(fixtures)
    .set({
      published: false,
      publishedAt: null,
      publishedByUserId: null,
      updatedByUserId: auth.user.id,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, fixtureId))

  revalidateFixtureSurfaces()
  return { ok: true }
}

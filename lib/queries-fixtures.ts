import { db } from "@/lib/db"
import { fixtures, teams, divisions, clubs, regions, user, results, matches, seasons } from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { asc, eq, inArray } from "drizzle-orm"
import { getCurrentSeason } from "@/lib/queries"
import type { CurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { parseScoreDetail } from "@/lib/engine/scoring"
import { deriveOpsStatus, type CourtAssignments, type CourtLinks } from "@/lib/fixtures-ops"

export type FixtureCategoryMatch = {
  category: string
  homeSetsWon: number
  awaySetsWon: number
  scoreDetail: string | null
  winnerTeamId: number | null
  /** Parsed set scores for prefilling the inline result editor. */
  sets: { home: number; away: number }[]
}

export type DashboardFixture = {
  id: number
  week: number
  matchDate: Date | string | null
  status: string
  divisionId: number
  divisionName: string | null
  divisionLevel: number | null
  regionId: number | null
  regionName: string | null
  homeTeamId: number | null
  awayTeamId: number | null
  homeName: string | null
  awayName: string | null
  homeSlot: number | null
  awaySlot: number | null
  timeslot: string | null
  venue: string | null
  venueClubId: number | null
  venueClubName: string | null
  venueCourts: number | null
  playtomicUrl: string | null
  courtLinks: CourtLinks
  courtAssignments: CourtAssignments
  published: boolean
  publishedAt: Date | string | null
  publishedByName: string | null
  updatedAt: Date | string | null
  updatedByName: string | null
  resultEnteredByName: string | null
  resultEnteredAt: Date | string | null
  homePoints: number | null
  awayPoints: number | null
  winnerTeamId: number | null
  mine: boolean
  canEditLink: boolean
  /** The four category rubbers with any entered scores, in display order. */
  matches: FixtureCategoryMatch[]
}

export type FixtureScope = "all" | "club" | "team" | "none"

export type HostClub = { id: number; name: string; courts: number | null }

export type FixtureHealth = {
  total: number
  completed: number
  awaitingResults: number
  missingLinks: number
  readyToPublish: number
  published: number
}

export type DashboardFixturesResult = {
  seasonName: string | null
  scope: FixtureScope
  canManageVenue: boolean
  fixtures: DashboardFixture[]
  clubs: HostClub[]
  health: FixtureHealth
}

async function baseFixtures(seasonId: number) {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const publisher = alias(user, "publisher")
  const updater = alias(user, "updater")
  const submitter = alias(user, "submitter")
  return db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      status: fixtures.status,
      divisionId: fixtures.divisionId,
      divisionName: divisions.name,
      divisionLevel: divisions.level,
      regionId: divisions.regionId,
      regionName: regions.name,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: home.name,
      awayName: away.name,
      homeSlot: fixtures.homeSlot,
      awaySlot: fixtures.awaySlot,
      timeslot: fixtures.timeslot,
      venue: fixtures.venue,
      venueClubId: fixtures.venueClubId,
      venueClubName: clubs.name,
      venueCourts: clubs.courts,
      playtomicUrl: fixtures.playtomicUrl,
      courtLinks: fixtures.courtLinks,
      courtAssignments: fixtures.courtAssignments,
      published: fixtures.published,
      publishedAt: fixtures.publishedAt,
      publishedByName: publisher.name,
      updatedAt: fixtures.updatedAt,
      updatedByName: updater.name,
      resultEnteredByName: submitter.name,
      resultEnteredAt: results.approvedAt,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
      winnerTeamId: fixtures.winnerTeamId,
    })
    .from(fixtures)
    .leftJoin(home, eq(fixtures.homeTeamId, home.id))
    .leftJoin(away, eq(fixtures.awayTeamId, away.id))
    .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .leftJoin(clubs, eq(fixtures.venueClubId, clubs.id))
    .leftJoin(publisher, eq(fixtures.publishedByUserId, publisher.id))
    .leftJoin(updater, eq(fixtures.updatedByUserId, updater.id))
    .leftJoin(results, eq(results.fixtureId, fixtures.id))
    .leftJoin(submitter, eq(results.submittedByUserId, submitter.id))
    .where(eq(fixtures.seasonId, seasonId))
    .orderBy(asc(fixtures.week), asc(divisions.level), asc(fixtures.matchDate))
}

/** Loads every category match for a set of fixtures, grouped by fixture id. */
async function matchesByFixture(fixtureIds: number[]): Promise<Map<number, FixtureCategoryMatch[]>> {
  const map = new Map<number, FixtureCategoryMatch[]>()
  if (fixtureIds.length === 0) return map
  const rows = await db
    .select({
      fixtureId: matches.fixtureId,
      category: matches.category,
      homeSetsWon: matches.homeSetsWon,
      awaySetsWon: matches.awaySetsWon,
      scoreDetail: matches.scoreDetail,
      winnerTeamId: matches.winnerTeamId,
    })
    .from(matches)
    .where(inArray(matches.fixtureId, fixtureIds))
  for (const r of rows) {
    const list = map.get(r.fixtureId) ?? []
    list.push({
      category: r.category,
      homeSetsWon: r.homeSetsWon,
      awaySetsWon: r.awaySetsWon,
      scoreDetail: r.scoreDetail,
      winnerTeamId: r.winnerTeamId,
      sets: parseScoreDetail(r.scoreDetail),
    })
    map.set(r.fixtureId, list)
  }
  return map
}

export function computeFixtureHealth(list: DashboardFixture[]): FixtureHealth {
  const health: FixtureHealth = {
    total: list.length,
    completed: 0,
    awaitingResults: 0,
    missingLinks: 0,
    readyToPublish: 0,
    published: 0,
  }
  for (const f of list) {
    const info = deriveOpsStatus(f)
    if (f.published) health.published++
    switch (info.status) {
      case "completed":
        health.completed++
        break
      case "awaiting_result":
        health.awaitingResults++
        break
      case "ready_to_publish":
        health.readyToPublish++
        break
      case "missing_links":
      case "planned":
        health.missingLinks++
        break
    }
  }
  return health
}

/**
 * Admin-only fixtures for the League Operations Console:
 *  - league/super admin: every fixture, full edit rights
 *  - club owner: fixtures hosted at their club(s), plus involved team fixtures
 *  - team owner/captain: fixtures involving their own teams
 *    (editing links only for those teams)
 * Captains/players do NOT use this route — they use League Centre.
 */
export async function getDashboardFixtures(user: CurrentUser): Promise<DashboardFixturesResult> {
  const empty: DashboardFixturesResult = {
    seasonName: null,
    scope: "none",
    canManageVenue: false,
    fixtures: [],
    clubs: [],
    health: computeFixtureHealth([]),
  }
  const season = await getCurrentSeason()
  if (!season) return empty
  const [seasonRow] = await db.select({ name: seasons.name }).from(seasons).where(eq(seasons.id, season.id)).limit(1)
  const seasonName = seasonRow?.name ?? null

  const access = await getAccessContext(user)
  const hasScopedManagerAccess = access.clubIds.length > 0 || access.manageableTeamIds.length > 0
  if (!access.isLeagueAdmin && !hasScopedManagerAccess) return empty

  const rows = await baseFixtures(season.id)
  const mMap = await matchesByFixture(rows.map((r) => r.id))
  const withMatches = (
    f: (typeof rows)[number],
    extra: { mine: boolean; canEditLink: boolean },
  ): DashboardFixture => ({
    ...f,
    courtLinks: (f.courtLinks ?? {}) as CourtLinks,
    courtAssignments: (f.courtAssignments ?? {}) as CourtAssignments,
    matches: mMap.get(f.id) ?? [],
    ...extra,
  })

  if (access.isLeagueAdmin) {
    const hostClubs = await db
      .select({ id: clubs.id, name: clubs.name, courts: clubs.courts })
      .from(clubs)
      .orderBy(asc(clubs.name))
    const list = rows.map((f) => withMatches(f, { mine: true, canEditLink: true }))
    return {
      seasonName,
      scope: "all",
      canManageVenue: true,
      clubs: hostClubs,
      fixtures: list,
      health: computeFixtureHealth(list),
    }
  }

  // Club owners and team owners/captains: scoped fixture visibility.
  const clubIds = new Set(access.clubIds)
  const teamIds = new Set<number>(access.manageableTeamIds)
  const visible = rows.filter(
    (f) =>
      (f.venueClubId != null && clubIds.has(f.venueClubId)) ||
      (f.homeTeamId != null && teamIds.has(f.homeTeamId)) ||
      (f.awayTeamId != null && teamIds.has(f.awayTeamId)),
  )
  const list = visible.map((f) =>
    withMatches(f, {
      mine:
        (f.homeTeamId != null && teamIds.has(f.homeTeamId)) ||
        (f.awayTeamId != null && teamIds.has(f.awayTeamId)),
      canEditLink:
        (f.venueClubId != null && clubIds.has(f.venueClubId)) ||
        (f.homeTeamId != null && access.ownedTeamIds.includes(f.homeTeamId)) ||
        (f.awayTeamId != null && access.ownedTeamIds.includes(f.awayTeamId)),
    }),
  )
  return {
    seasonName,
    scope: clubIds.size > 0 ? "club" : "team",
    canManageVenue: false,
    clubs: [],
    fixtures: list,
    health: computeFixtureHealth(list),
  }
}

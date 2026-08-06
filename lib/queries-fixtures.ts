import { db } from "@/lib/db"
import { fixtures, teams, divisions, clubs, regions, user, results, matches, seasons, teamPairings, teamInvites } from "@/lib/db/schema"
import { organisations } from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { asc, eq, inArray, and, isNotNull } from "drizzle-orm"
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
  homeLogo: string | null
  awayLogo: string | null
  homeSlot: number | null
  awaySlot: number | null
  timeslot: string | null
  venue: string | null
  venueClubId: number | null
  venueClubName: string | null
  venueClubLogo: string | null
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
  homePlayers: Record<string, { name: string; email: string | null; playtomicUrl: string | null }[]>
  awayPlayers: Record<string, { name: string; email: string | null; playtomicUrl: string | null }[]>
}

export type FixtureScope = "all" | "club" | "team" | "none"

export type HostClub = { id: number; name: string; courts: number | null }

export type FixtureHealth = {
  total: number
  draft: number
  completed: number
  awaitingResults: number
  missingLinks: number
  published: number
}

export type DashboardFixturesResult = {
  seasonName: string | null
  scope: FixtureScope
  canManageVenue: boolean
  fixtures: DashboardFixture[]
  clubs: HostClub[]
  divisionTeams: Record<number, { id: number; name: string }[]>
  health: FixtureHealth
}

async function baseFixtures(seasonId: number) {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const homeOrg = alias(organisations, "homeOrg")
  const awayOrg = alias(organisations, "awayOrg")
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
      homeLogo: home.logoUrl,
      awayLogo: away.logoUrl,
      homeSlot: fixtures.homeSlot,
      awaySlot: fixtures.awaySlot,
      timeslot: fixtures.timeslot,
      venue: fixtures.venue,
      venueClubId: fixtures.venueClubId,
      venueClubName: clubs.name,
      venueClubLogo: clubs.logoUrl,
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
    .leftJoin(homeOrg, eq(home.organisationId, homeOrg.id))
    .leftJoin(awayOrg, eq(away.organisationId, awayOrg.id))
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

async function pairingsByTeam(teamIds: number[]): Promise<Map<number, Record<string, { name: string; email: string | null; playtomicUrl: string | null }[]>>> {
  const map = new Map<number, Record<string, { name: string; email: string | null; playtomicUrl: string | null }[]>>()
  if (teamIds.length === 0) return map

  const playerUser = alias(user, "playerUser")

  // 1. Confirmed players (invite accepted / directly assigned)
  const pairingRows = await db
    .select({
      teamId: teamPairings.teamId,
      category: teamPairings.category,
      pairIndex: teamPairings.pairIndex,
      slotIndex: teamPairings.slotIndex,
      playerName: playerUser.name,
      email: playerUser.email,
      playtomicUrl: playerUser.playtomicUrl,
    })
    .from(teamPairings)
    .leftJoin(playerUser, eq(teamPairings.playerId, playerUser.id))
    .where(inArray(teamPairings.teamId, teamIds))
    .orderBy(asc(teamPairings.teamId), asc(teamPairings.category), asc(teamPairings.pairIndex), asc(teamPairings.slotIndex))

  // 2. Pending invites that have a captured name and target a specific slot
  const inviteRows = await db
    .select({
      teamId: teamInvites.teamId,
      category: teamInvites.category,
      pairIndex: teamInvites.pairIndex,
      slotIndex: teamInvites.slotIndex,
      invitedName: teamInvites.invitedName,
      email: teamInvites.email,
    })
    .from(teamInvites)
    .where(
      and(
        inArray(teamInvites.teamId, teamIds),
        eq(teamInvites.status, "pending"),
        isNotNull(teamInvites.invitedName),
        isNotNull(teamInvites.category),
      ),
    )

  // Build a slot map: "teamId:category:pairIndex:slotIndex" → name
  // Confirmed players take precedence over pending invites for the same slot.
  const slotMap = new Map<string, { name: string; email: string | null; playtomicUrl: string | null }>()

  for (const row of inviteRows) {
    if (!row.invitedName || !row.category || row.pairIndex == null || row.slotIndex == null) continue
    const key = `${row.teamId}:${row.category}:${row.pairIndex}:${row.slotIndex}`
    if (!slotMap.has(key)) slotMap.set(key, { name: row.invitedName, email: row.email ?? null, playtomicUrl: null })
  }

  for (const row of pairingRows) {
    if (!row.playerName) continue
    const key = `${row.teamId}:${row.category}:${row.pairIndex}:${row.slotIndex}`
    slotMap.set(key, { name: row.playerName, email: row.email ?? null, playtomicUrl: row.playtomicUrl ?? null }) // overwrites invite name when player has joined
  }

  // Collect names per (teamId, category) in slot order: (1,1), (1,2), (2,1), (2,2)
  const seen = new Set<string>()
  for (const row of [...pairingRows, ...inviteRows]) {
    const category = row.category
    if (!category) continue
    const tcKey = `${row.teamId}:${category}`
    seen.add(tcKey)
  }

  for (const tcKey of seen) {
    const colonIdx = tcKey.indexOf(":")
    const teamId = Number(tcKey.slice(0, colonIdx))
    const category = tcKey.slice(colonIdx + 1)

    const names: { name: string; email: string | null; playtomicUrl: string | null }[] = []
    for (const pairIndex of [1, 2]) {
      for (const slotIndex of [1, 2]) {
        const name = slotMap.get(`${teamId}:${category}:${pairIndex}:${slotIndex}`)
        if (name) names.push(name)
      }
    }

    if (names.length > 0) {
      const teamMap = map.get(teamId) ?? {}
      teamMap[category] = names
      map.set(teamId, teamMap)
    }
  }

  return map
}

export function computeFixtureHealth(list: DashboardFixture[]): FixtureHealth {
  const health: FixtureHealth = {
    total: list.length,
    draft: 0,
    completed: 0,
    awaitingResults: 0,
    missingLinks: 0,
    published: 0,
  }
  for (const f of list) {
    const info = deriveOpsStatus(f)
    if (f.published) health.published++
    switch (info.status) {
      case "draft":
        health.draft++
        break
      case "completed":
        health.completed++
        break
      case "awaiting_result":
        health.awaitingResults++
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
    divisionTeams: {},
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
  const teamPairingMap = await pairingsByTeam(
    [...new Set(rows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter((id): id is number => id != null))],
  )
  const withMatches = (
    f: (typeof rows)[number],
    extra: { mine: boolean; canEditLink: boolean },
  ): DashboardFixture => ({
    ...f,
    courtLinks: (f.courtLinks ?? {}) as CourtLinks,
    courtAssignments: (f.courtAssignments ?? {}) as CourtAssignments,
    matches: mMap.get(f.id) ?? [],
    homePlayers: (f.homeTeamId != null ? teamPairingMap.get(f.homeTeamId) : null) ?? {},
    awayPlayers: (f.awayTeamId != null ? teamPairingMap.get(f.awayTeamId) : null) ?? {},
    ...extra,
  })

  if (access.isLeagueAdmin) {
    const hostClubs = await db
      .select({ id: clubs.id, name: clubs.name, courts: clubs.courts })
      .from(clubs)
      .orderBy(asc(clubs.name))
    const divisionIds = [...new Set(rows.map((row) => row.divisionId))].filter((id): id is number => id != null)
    const teamRows = divisionIds.length
      ? await db
          .select({ id: teams.id, name: teams.name, divisionId: teams.divisionId })
          .from(teams)
          .where(inArray(teams.divisionId, divisionIds))
      : []
    const divisionTeams = teamRows.reduce<Record<number, { id: number; name: string }[]>>((acc, team) => {
      if (team.divisionId == null) return acc
      acc[team.divisionId] ??= []
      acc[team.divisionId].push({ id: team.id, name: team.name })
      acc[team.divisionId].sort((a, b) => a.name.localeCompare(b.name))
      return acc
    }, {})
    const list = rows.map((f) => withMatches(f, { mine: true, canEditLink: true }))
    return {
      seasonName,
      scope: "all",
      canManageVenue: true,
      clubs: hostClubs,
      divisionTeams,
      fixtures: list,
      health: computeFixtureHealth(list),
    }
  }

  // Club owners and team owners/captains: scoped fixture visibility.
  const clubIds = new Set(access.clubIds)
  const teamIds = new Set<number>(access.manageableTeamIds)
  const visible = rows.filter(
    (f) =>
      f.published &&
      (
        (f.venueClubId != null && clubIds.has(f.venueClubId)) ||
        (f.homeTeamId != null && teamIds.has(f.homeTeamId)) ||
        (f.awayTeamId != null && teamIds.has(f.awayTeamId))
      ),
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
    divisionTeams: {},
    fixtures: list,
    health: computeFixtureHealth(list),
  }
}

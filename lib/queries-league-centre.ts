import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { getAccessContext } from "@/lib/access"
import {
  fixtures,
  teams,
  divisions,
  regions,
  organisations,
  clubs,
  standings,
  teamEntries,
  teamMembers,
  matches,
  teamPairings,
  teamInvites,
  playoffs,
  user as userTable,
} from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { getCurrentSeason } from "@/lib/queries"
import type { CurrentUser } from "@/lib/session"
import { parseScoreDetail, tallySets } from "@/lib/engine/scoring"

// ---------------------------------------------------------------------------
// League Centre — a single premium data payload powering the flagship public
// experience (region selector, division tabs, standings, fixtures timeline,
// team rankings) plus the logged-in player's "My Matches" rail.
// ---------------------------------------------------------------------------

export type LCStatus = "planned" | "scheduled" | "live" | "completed"

export type LCRegion = {
  id: number
  name: string
  slug: string
  teamCount: number
  clubCount: number
}

export type LCDivision = {
  id: number
  name: string
  level: number
  regionId: number | null
  teamCount: number
}

export type LCStanding = {
  divisionId: number
  teamId: number
  teamName: string | null
  venueName: string | null
  venueLogo: string | null
  orgName: string | null
  orgSlug: string | null
  teamLogo: string | null
  orgLogo: string | null
  played: number
  wins: number
  draws: number
  losses: number
  matchesWon: number
  setsWon: number
  setsLost: number
  gamesFor: number
  gamesAgainst: number
  points: number
  pointsDiff: number
  rank: number | null
  tpr: number | null
}

/** One result entry for the form tooltip — newest last */
export type FormItem = {
  result: "W" | "L" | "D"
  opponentName: string
  homeScore: number
  awayScore: number
  isHome: boolean
}

export type CategoryFormItem = {
  result: "W" | "L" | "D"
  opponentName: string
  opponentPlayers: string | null
  scoreDetail: string | null
}

export type LCFixture = {
  id: number
  week: number
  matchDate: string | null
  timeslot: string | null
  status: LCStatus
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
  venue: string | null
  homePoints: number | null
  awayPoints: number | null
  homeSetsWon: number | null
  awaySetsWon: number | null
  winnerTeamId: number | null
  playoffBracketPosition?: number | null
  /** Average LI for all active players in each team */
  homeAvgLi: number | null
  awayAvgLi: number | null
  /** Average LI per category pair — keyed by category name */
  homePairLi: Record<string, number | null>
  awayPairLi: Record<string, number | null>
  /** Recent form items — up to last 6, oldest first */
  homeFormItems: FormItem[]
  awayFormItems: FormItem[]
  /** Recent per-category form — up to last 6, oldest first */
  homeCategoryFormItems: Record<string, CategoryFormItem[]>
  awayCategoryFormItems: Record<string, CategoryFormItem[]>
  joinUrl: string | null
  /** Per-category booking link, keyed by category. Only present once published. */
  joinUrlByCategory: Record<string, string>
  /** Per-category court + start time, keyed by category. */
  courtInfoByCategory: Record<string, { court: string | null; time: string | null }>
  /** Whether an admin has published this fixture to players. */
  published: boolean
  mine: boolean
  assignedToFixture: boolean
  canSeeBookingLinks: boolean
  canSeeAdminPlaytomicLinks: boolean
  canSubmitResult: boolean
  canSubmitAllCategories: boolean
  myCategories: string[]
  homePlayers: Record<string, { name: string; rating: number | null }[]>
  awayPlayers: Record<string, { name: string; rating: number | null }[]>
  rubbers: LCRubber[]
}

export type LCRubber = {
  id: number
  category: string
  session: number
  isFeatureCourt: boolean
  homeSetsWon: number
  awaySetsWon: number
  scoreDetail: string | null
  winnerTeamId: number | null
  homePlayerIds: string[]
  awayPlayerIds: string[]
}

export type LCRanking = {
  teamId: number
  teamName: string
  orgName: string | null
  orgSlug: string | null
  teamLogo: string | null
  tpr: number
  highestTpr: number
  regionId: number | null
  regionName: string | null
  divisionName: string | null
  divisionLevel: number | null
}

export type LeagueCentreData = {
  season: { id: number; name: string; weeks: number; status: string } | null
  stats: {
    seasonName: string | null
    teamCount: number
    clubCount: number
    matchesPlayed: number
    matchesRemaining: number
  }
  regions: LCRegion[]
  divisions: LCDivision[]
  standings: LCStanding[]
  fixtures: LCFixture[]
  rankings: LCRanking[]
  myMatches: LCFixture[]
  authed: boolean
  currentPlayerId: number | null
}

function normaliseStatus(status: string | null): LCStatus {
  if (status === "completed") return "completed"
  if (status === "live") return "live"
  if (status === "planned") return "planned"
  return "scheduled"
}

const LIVE_STATUSES = new Set(["league_locked", "active", "published"])

function normalizeCategoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bmen\b/g, "mens")
    .replace(/\bbegineer\b/g, "beginner")
    .replace(/\s+/g, " ")
}

function computeRubberPoints(scoreDetail: string | null | undefined, fallbackHomeSetsWon: number, fallbackAwaySetsWon: number) {
  const parsedSets = parseScoreDetail(scoreDetail)
  const tally = parsedSets.length > 0 ? tallySets(parsedSets) : null
  const homeSetsWon = tally?.homeSetsWon ?? fallbackHomeSetsWon
  const awaySetsWon = tally?.awaySetsWon ?? fallbackAwaySetsWon
  const splitSets = tally?.splitSets ?? 0
  const homeBonus = homeSetsWon > awaySetsWon ? 1 : 0
  const awayBonus = awaySetsWon > homeSetsWon ? 1 : 0
  const tiedSplitBonus = homeSetsWon > 0 && homeSetsWon === awaySetsWon ? 0.5 : 0
  const tiedUnplayedDeciderSplit = tiedSplitBonus > 0 && splitSets === 0 ? 0.5 : 0
  return {
    home: homeSetsWon + homeBonus + splitSets * 0.5 + tiedSplitBonus + tiedUnplayedDeciderSplit,
    away: awaySetsWon + awayBonus + splitSets * 0.5 + tiedSplitBonus + tiedUnplayedDeciderSplit,
  }
}

function extractPlayerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
    .filter((item): item is string => item.length > 0)
}

function resolveTeamCategoryPlayers(
  teamPlayerMap: Map<number, Record<string, { name: string; rating: number | null }[]>>,
  teamId: number | null,
  category: string,
): string[] {
  if (teamId == null) return []
  const categoryMap = teamPlayerMap.get(teamId)
  if (!categoryMap) return []
  const exact = categoryMap[category]
  if (exact?.length) return exact.map((player) => player.name).filter(Boolean)
  const normalized = normalizeCategoryKey(category)
  const matchedKey = Object.keys(categoryMap).find((key) => normalizeCategoryKey(key) === normalized)
  if (!matchedKey) return []
  return (categoryMap[matchedKey] ?? []).map((player) => player.name).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Internal types for the shared cache layer
// ---------------------------------------------------------------------------

/**
 * Fixture data that is identical for every visitor.
 * Excludes user-specific fields (mine, assignedToFixture, joinUrl,
 * joinUrlByCategory) which are applied as a thin per-request overlay.
 * Also carries _categoryLinks — raw court booking URLs used during the
 * overlay to derive joinUrl / joinUrlByCategory for assigned players.
 * Not exported or surfaced on the public LCFixture type.
 */
type SharedFixture = Omit<LCFixture, "mine" | "assignedToFixture" | "joinUrl" | "joinUrlByCategory" | "canSeeBookingLinks" | "canSubmitResult" | "canSubmitAllCategories" | "myCategories"> & {
  _categoryLinks: Record<string, string>
}

type SharedLeagueCentreData = {
  season: LeagueCentreData["season"]
  stats: LeagueCentreData["stats"]
  regions: LCRegion[]
  divisions: LCDivision[]
  standings: LCStanding[]
  sharedFixtures: SharedFixture[]
  rankings: LCRanking[]
}

/** Team ids the user is eligible to play for (captain or active roster member). */
async function getMyTeamIds(user: CurrentUser): Promise<Set<number>> {
  const access = await getAccessContext(user)
  const ids = new Set<number>()
  const captainTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.captainUserId, user.id))
  captainTeams.forEach((t) => ids.add(t.id))
  access.ownedTeamIds.forEach((teamId) => ids.add(teamId))
  // teamMembers.playerId stores auth user IDs, so use user.id directly.
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.playerId, user.id), eq(teamMembers.status, "active")))
  memberships.forEach((m) => ids.add(m.teamId))
  return ids
}

// ---------------------------------------------------------------------------
// Shared data builder — all data identical for every visitor.
// Wrapped with unstable_cache so it runs at most once every 60 seconds
// across all concurrent requests, regardless of how many users visit.
// ---------------------------------------------------------------------------

async function _buildSharedLeagueCentreData(): Promise<SharedLeagueCentreData> {
  const season = await getCurrentSeason()
  if (!season) {
    return {
      season: null,
      stats: { seasonName: null, teamCount: 0, clubCount: 0, matchesPlayed: 0, matchesRemaining: 0 },
      regions: [],
      divisions: [],
      standings: [],
      sharedFixtures: [],
      rankings: [],
    }
  }

  // Divisions in this season with their region.
  const seasonDivisions = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      level: divisions.level,
      regionId: divisions.regionId,
      regionName: regions.name,
      regionSlug: regions.slug,
    })
    .from(divisions)
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(eq(divisions.seasonId, season.id))
    .orderBy(asc(regions.name), asc(divisions.level))

  const divisionIds = seasonDivisions.map((d) => d.id)

  // Assigned team counts per division to determine which divisions are active.
  const entryCounts = divisionIds.length
    ? await db
        .select({
          divisionId: teamEntries.divisionId,
          count: sql<number>`count(*)::int`,
        })
        .from(teamEntries)
        .where(and(eq(teamEntries.seasonId, season.id), eq(teamEntries.status, "assigned")))
        .groupBy(teamEntries.divisionId)
    : []
  const entryByDivision = new Map<number, number>()
  entryCounts.forEach((r) => {
    if (r.divisionId != null) entryByDivision.set(r.divisionId, r.count)
  })

  // Only surface divisions that have at least one assigned team.
  const usedDivisions = seasonDivisions.filter((d) => (entryByDivision.get(d.id) ?? 0) > 0)
  const usedDivisionIds = usedDivisions.map((d) => d.id)

  const divisionsOut: LCDivision[] = usedDivisions.map((d) => ({
    id: d.id,
    name: d.name,
    level: d.level,
    regionId: d.regionId,
    teamCount: entryByDivision.get(d.id) ?? 0,
  }))

  // Clubs per region for region cards.
  const clubCounts = await db
    .select({ regionId: clubs.regionId, count: sql<number>`count(*)::int` })
    .from(clubs)
    .groupBy(clubs.regionId)
  const clubByRegion = new Map<number, number>()
  clubCounts.forEach((r) => {
    if (r.regionId != null) clubByRegion.set(r.regionId, r.count)
  })

  const regionMap = new Map<number, LCRegion>()
  for (const d of usedDivisions) {
    if (d.regionId == null) continue
    const existing = regionMap.get(d.regionId)
    const teamsInDiv = entryByDivision.get(d.id) ?? 0
    if (existing) {
      existing.teamCount += teamsInDiv
    } else {
      regionMap.set(d.regionId, {
        id: d.regionId,
        name: d.regionName ?? "Region",
        slug: d.regionSlug ?? String(d.regionId),
        teamCount: teamsInDiv,
        clubCount: clubByRegion.get(d.regionId) ?? 0,
      })
    }
  }
  const regionsOut = Array.from(regionMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Standings — base on teamEntries so ALL teams in the division appear even
  // when no games have been played yet. stats come from a LEFT JOIN to standings.
  let standingsOut: LCStanding[] = usedDivisionIds.length
    ? await db
        .select({
          divisionId: teamEntries.divisionId,
          teamId: teamEntries.teamId,
          teamName: teams.name,
          teamLogo: teams.logoUrl,
          venueName: clubs.name,
          venueLogo: clubs.logoUrl,
          orgName: organisations.name,
          orgSlug: organisations.slug,
          orgLogo: organisations.logoUrl,
          played: sql<number>`COALESCE(${standings.played}, 0)`,
          wins: sql<number>`COALESCE(${standings.wins}, 0)`,
          draws: sql<number>`0`,
          losses: sql<number>`COALESCE(${standings.losses}, 0)`,
          matchesWon: sql<number>`0`,
          setsWon: sql<number>`COALESCE(${standings.setsWon}, 0)`,
          setsLost: sql<number>`COALESCE(${standings.setsLost}, 0)`,
          gamesFor: sql<number>`COALESCE(${standings.gamesFor}, 0)`,
          gamesAgainst: sql<number>`COALESCE(${standings.gamesAgainst}, 0)`,
          points: sql<number>`COALESCE(${standings.points}, 0)`,
          pointsDiff: sql<number>`COALESCE(${standings.pointsDiff}, 0)`,
          rank: sql<number | null>`${standings.rank}`,
          tpr: teams.tpr,
        })
        .from(teamEntries)
        .innerJoin(teams, eq(teamEntries.teamId, teams.id))
        .leftJoin(clubs, eq(teams.homeClubId, clubs.id))
        .leftJoin(organisations, eq(teams.organisationId, organisations.id))
        .leftJoin(
          standings,
          and(
            eq(standings.teamId, teamEntries.teamId),
            eq(standings.seasonId, teamEntries.seasonId),
            eq(standings.divisionId, teamEntries.divisionId),
          ),
        )
        .where(
          and(
            eq(teamEntries.seasonId, season.id),
            inArray(teamEntries.divisionId, usedDivisionIds),
            eq(teamEntries.status, "assigned"),
          ),
        )
        .orderBy(
          asc(teamEntries.divisionId),
          sql`${standings.rank} NULLS LAST`,
          asc(teams.name),
        )
    : []

  // Fixtures — filtered to used divisions in SQL (no JS post-filter needed).
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const homeOrg = alias(organisations, "homeOrg")
  const awayOrg = alias(organisations, "awayOrg")
  const homeClub = alias(clubs, "homeClub")
  const awayClub = alias(clubs, "awayClub")

  const fixtureRowsBase = usedDivisionIds.length
    ? await db
        .select({
          id: fixtures.id,
          week: fixtures.week,
          matchDate: fixtures.matchDate,
          timeslot: fixtures.timeslot,
          status: fixtures.status,
          divisionId: fixtures.divisionId,
          divisionName: divisions.name,
          divisionLevel: divisions.level,
          regionId: divisions.regionId,
          regionName: regions.name,
          venueClubId: fixtures.venueClubId,
          homeTeamId: fixtures.homeTeamId,
          awayTeamId: fixtures.awayTeamId,
          homeName: home.name,
          awayName: away.name,
          homeLogo: sql<string | null>`coalesce(${home.logoUrl}, ${homeClub.logoUrl}, ${homeOrg.logoUrl})`,
          awayLogo: sql<string | null>`coalesce(${away.logoUrl}, ${awayClub.logoUrl}, ${awayOrg.logoUrl})`,
          venue: sql<string | null>`coalesce(${clubs.name}, ${fixtures.venue})`,
          playtomicUrl: sql<string | null>`nullif(${fixtures.playtomicUrl}, '')`,
          published: fixtures.published,
          courtLinks: fixtures.courtLinks,
          courtAssignments: fixtures.courtAssignments,
          homePoints: fixtures.homePoints,
          awayPoints: fixtures.awayPoints,
          homeSetsWon: fixtures.homeSetsWon,
          awaySetsWon: fixtures.awaySetsWon,
          winnerTeamId: fixtures.winnerTeamId,
          bracketPosition: sql<number | null>`null`,
          homeAvgLi: home.avgLi,
          awayAvgLi: away.avgLi,
        })
        .from(fixtures)
        .leftJoin(home, eq(fixtures.homeTeamId, home.id))
        .leftJoin(away, eq(fixtures.awayTeamId, away.id))
        .leftJoin(homeClub, eq(home.homeClubId, homeClub.id))
        .leftJoin(awayClub, eq(away.homeClubId, awayClub.id))
        .leftJoin(homeOrg, eq(home.organisationId, homeOrg.id))
        .leftJoin(awayOrg, eq(away.organisationId, awayOrg.id))
        .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
        .leftJoin(regions, eq(divisions.regionId, regions.id))
        .leftJoin(clubs, eq(fixtures.venueClubId, clubs.id))
        .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.published, true), inArray(fixtures.divisionId, usedDivisionIds)))
        .orderBy(asc(fixtures.matchDate), asc(fixtures.week))
    : []

  const playoffRows = await db
    .select({
      id: playoffs.id,
      homeTeamId: playoffs.homeTeamId,
      awayTeamId: playoffs.awayTeamId,
      homeLabel: playoffs.homeLabel,
      awayLabel: playoffs.awayLabel,
      homeScore: playoffs.homeScore,
      awayScore: playoffs.awayScore,
      winnerTeamId: playoffs.winnerTeamId,
      status: playoffs.status,
      matchDate: playoffs.matchDate,
      timeslot: playoffs.timeslot,
      venue: playoffs.venue,
      bracketPosition: playoffs.bracketPosition,
    })
    .from(playoffs)
    .where(and(eq(playoffs.seasonId, season.id), eq(playoffs.type, "tshwane_masters")))
    .orderBy(asc(playoffs.matchDate), asc(playoffs.bracketPosition))

  const playoffDivisionTargets = usedDivisions.filter(
    (division): division is typeof division & { regionId: number } => division.regionId != null,
  )

  const playoffFixtureRows = playoffRows.flatMap((playoffRow) =>
    playoffDivisionTargets.map((divisionTarget, index) => ({
      id: 9_000_000 + playoffRow.id * 10 + index,
      week: season.weeks,
      matchDate: playoffRow.matchDate,
      timeslot: playoffRow.timeslot,
      status: playoffRow.status,
      divisionId: divisionTarget.id,
      divisionName: "Playoff",
      divisionLevel: divisionTarget.level,
      regionId: divisionTarget.regionId,
      regionName: divisionTarget.regionName,
      venueClubId: null,
      homeTeamId: playoffRow.homeTeamId,
      awayTeamId: playoffRow.awayTeamId,
      homeName: playoffRow.homeLabel,
      awayName: playoffRow.awayLabel,
      homeLogo: null,
      awayLogo: null,
      venue: playoffRow.venue ?? "To be Confirmed",
      playtomicUrl: null,
      published: true,
      courtLinks: {},
      courtAssignments: {},
      homePoints: playoffRow.homeScore,
      awayPoints: playoffRow.awayScore,
      homeSetsWon: playoffRow.homeScore,
      awaySetsWon: playoffRow.awayScore,
      winnerTeamId: playoffRow.winnerTeamId,
      bracketPosition: playoffRow.bracketPosition,
      homeAvgLi: null,
      awayAvgLi: null,
    })),
  )

  const fixtureRows = [...fixtureRowsBase, ...playoffFixtureRows]

  const fixtureVenueRows = usedDivisionIds.length
    ? await db
        .select({ venueClubId: fixtures.venueClubId })
        .from(fixtures)
        .where(and(eq(fixtures.seasonId, season.id), inArray(fixtures.divisionId, usedDivisionIds)))
    : []

  // Pairings — player names + LI for all teams in these fixtures.
  const allTeamIds = Array.from(
    new Set(
      fixtureRows.flatMap((f) => [f.homeTeamId, f.awayTeamId].filter((id): id is number => id != null)),
    ),
  )
  type PairingRow = {
    teamId: number
    category: string
    pairIndex: number
    slotIndex: number
    playerId: string | null
    firstName: string
    lastName: string
    currentLi: number
    playtomicRating: number | null
  }
  const pairingRows: PairingRow[] = allTeamIds.length
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          pairIndex: teamPairings.pairIndex,
          slotIndex: teamPairings.slotIndex,
          playerId: teamPairings.playerId,
          firstName: userTable.firstName,
          lastName: userTable.lastName,
          currentLi: userTable.currentLi,
          playtomicRating: userTable.playtomicRating,
        })
        .from(teamPairings)
        .innerJoin(userTable, eq(teamPairings.playerId, userTable.id))
        .where(inArray(teamPairings.teamId, allTeamIds))
    : []

  const inviteRows = allTeamIds.length
    ? await db
        .select({
          teamId: teamInvites.teamId,
          category: teamInvites.category,
          pairIndex: teamInvites.pairIndex,
          slotIndex: teamInvites.slotIndex,
          invitedName: teamInvites.invitedName,
          invitedRating: teamInvites.invitedRating,
        })
        .from(teamInvites)
        .where(
          and(
            inArray(teamInvites.teamId, allTeamIds),
            eq(teamInvites.status, "pending"),
          ),
        )
    : []

  const teamPlayerMap = new Map<number, Record<string, { name: string; rating: number | null }[]>>()
  const playerNameById = new Map<string, string>()
  const pairLiMap = new Map<string, { sum: number; count: number }>()
  const occupiedSlots = new Set<string>()
  for (const row of pairingRows) {
    occupiedSlots.add(`${row.teamId}:${row.category}:${row.pairIndex}:${row.slotIndex}`)
    let catMap = teamPlayerMap.get(row.teamId)
    if (!catMap) { catMap = {}; teamPlayerMap.set(row.teamId, catMap) }
    const arr = catMap[row.category] ?? []
    const name = `${row.firstName} ${row.lastName}`.trim()
    if (row.playerId) playerNameById.set(row.playerId, name)
    if (!arr.some((player) => player.name === name)) arr.push({ name, rating: row.playtomicRating })
    catMap[row.category] = arr

    const key = `${row.teamId}:${row.category}`
    const entry = pairLiMap.get(key) ?? { sum: 0, count: 0 }
    entry.sum += row.currentLi ?? 0
    entry.count += 1
    pairLiMap.set(key, entry)
  }

  for (const row of inviteRows) {
    if (!row.invitedName || !row.category || row.pairIndex == null || row.slotIndex == null) continue
    const slotKey = `${row.teamId}:${row.category}:${row.pairIndex}:${row.slotIndex}`
    if (occupiedSlots.has(slotKey)) continue
    let catMap = teamPlayerMap.get(row.teamId)
    if (!catMap) { catMap = {}; teamPlayerMap.set(row.teamId, catMap) }
    const arr = catMap[row.category] ?? []
    if (!arr.some((player) => player.name === row.invitedName)) {
      arr.push({ name: row.invitedName, rating: row.invitedRating ?? null })
    }
    catMap[row.category] = arr

    const key = `${row.teamId}:${row.category}`
    const entry = pairLiMap.get(key) ?? { sum: 0, count: 0 }
    if (row.invitedRating != null) {
      entry.sum += row.invitedRating
      entry.count += 1
      pairLiMap.set(key, entry)
    }
  }

  // Rubbers for all fixtures in scope.
  const allFixtureIds = fixtureRows.map((f) => f.id)
  type RubberRow = {
    id: number
    fixtureId: number
    category: string
    session: number
    isFeatureCourt: boolean
    homeSetsWon: number
    awaySetsWon: number
    scoreDetail: string | null
    winnerTeamId: number | null
    homePlayerIds: unknown
    awayPlayerIds: unknown
  }
  const rubberRows: RubberRow[] = allFixtureIds.length
    ? await db
        .select({
          id: matches.id,
          fixtureId: matches.fixtureId,
          category: matches.category,
          session: matches.session,
          isFeatureCourt: matches.isFeatureCourt,
          homeSetsWon: matches.homeSetsWon,
          awaySetsWon: matches.awaySetsWon,
          scoreDetail: matches.scoreDetail,
          winnerTeamId: matches.winnerTeamId,
          homePlayerIds: sql<unknown>`${matches.homePlayerIds}`,
          awayPlayerIds: sql<unknown>`${matches.awayPlayerIds}`,
        })
        .from(matches)
        .where(inArray(matches.fixtureId, allFixtureIds))
        .orderBy(asc(matches.session), asc(matches.category))
    : []

  const rubbersByFixture = new Map<number, LCRubber[]>()
  const rubberPlayerIds = new Set<string>()
  for (const r of rubberRows) {
    const homePlayerIds = extractPlayerIds(r.homePlayerIds)
    const awayPlayerIds = extractPlayerIds(r.awayPlayerIds)
    homePlayerIds.forEach((id) => rubberPlayerIds.add(id))
    awayPlayerIds.forEach((id) => rubberPlayerIds.add(id))
    const arr = rubbersByFixture.get(r.fixtureId) ?? []
    arr.push({
      id: r.id,
      category: r.category,
      session: r.session ?? 1,
      isFeatureCourt: r.isFeatureCourt ?? false,
      homeSetsWon: r.homeSetsWon ?? 0,
      awaySetsWon: r.awaySetsWon ?? 0,
      scoreDetail: r.scoreDetail,
      winnerTeamId: r.winnerTeamId,
      homePlayerIds,
      awayPlayerIds,
    })
    rubbersByFixture.set(r.fixtureId, arr)
  }

  if (rubberPlayerIds.size > 0) {
    const rubberPlayerRows = await db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
      })
      .from(userTable)
      .where(inArray(userTable.id, Array.from(rubberPlayerIds)))
    for (const row of rubberPlayerRows) {
      const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
      if (name) playerNameById.set(row.id, name)
    }
  }

  // Form items per team from completed fixtures (oldest to newest, keep last 6).
  const teamFormItemsMap = new Map<number, FormItem[]>()
  const completedByWeek = [...fixtureRows]
    .filter((f) => normaliseStatus(f.status) === "completed")
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0))

  const teamCategoryFormItemsMap = new Map<number, Map<string, CategoryFormItem[]>>()
  for (const f of completedByWeek) {
    const homePoints = f.homePoints ?? 0
    const awayPoints = f.awayPoints ?? 0
    const homeResult: "W" | "L" | "D" = homePoints > awayPoints ? "W" : homePoints < awayPoints ? "L" : "D"
    const awayResult: "W" | "L" | "D" = awayPoints > homePoints ? "W" : awayPoints < homePoints ? "L" : "D"
    if (f.homeTeamId != null) {
      const item: FormItem = {
        result: homeResult,
        opponentName: f.awayName ?? "Unknown",
        homeScore: homePoints,
        awayScore: awayPoints,
        isHome: true,
      }
      teamFormItemsMap.set(f.homeTeamId, [...(teamFormItemsMap.get(f.homeTeamId) ?? []), item].slice(-6))
    }
    if (f.awayTeamId != null) {
      const item: FormItem = {
        result: awayResult,
        opponentName: f.homeName ?? "Unknown",
        homeScore: homePoints,
        awayScore: awayPoints,
        isHome: false,
      }
      teamFormItemsMap.set(f.awayTeamId, [...(teamFormItemsMap.get(f.awayTeamId) ?? []), item].slice(-6))
    }

    const rubbers = rubbersByFixture.get(f.id) ?? []
    for (const rubber of rubbers) {
      const normalizedCategory = normalizeCategoryKey(rubber.category)
      const points = computeRubberPoints(rubber.scoreDetail, rubber.homeSetsWon ?? 0, rubber.awaySetsWon ?? 0)
      const homeCategoryResult: "W" | "L" | "D" =
        points.home > points.away ? "W" : points.home < points.away ? "L" : "D"
      const awayCategoryResult: "W" | "L" | "D" =
        points.away > points.home ? "W" : points.away < points.home ? "L" : "D"
      const homeOppositionPlayers = rubber.awayPlayerIds
        .map((playerId) => playerNameById.get(String(playerId)))
        .filter((name): name is string => Boolean(name))
      const awayOppositionPlayers = rubber.homePlayerIds
        .map((playerId) => playerNameById.get(String(playerId)))
        .filter((name): name is string => Boolean(name))
      const homeFallbackOppositionPlayers = resolveTeamCategoryPlayers(teamPlayerMap, f.awayTeamId, rubber.category)
      const awayFallbackOppositionPlayers = resolveTeamCategoryPlayers(teamPlayerMap, f.homeTeamId, rubber.category)
      const homeOppositionLabel = (homeOppositionPlayers.length ? homeOppositionPlayers : homeFallbackOppositionPlayers).join(" / ") || null
      const awayOppositionLabel = (awayOppositionPlayers.length ? awayOppositionPlayers : awayFallbackOppositionPlayers).join(" / ") || null

      if (f.homeTeamId != null) {
        const byCategory = teamCategoryFormItemsMap.get(f.homeTeamId) ?? new Map<string, CategoryFormItem[]>()
        const existing = byCategory.get(normalizedCategory) ?? []
        byCategory.set(
          normalizedCategory,
          [
            ...existing,
            {
              result: homeCategoryResult,
              opponentName: f.awayName ?? "Unknown",
              opponentPlayers: homeOppositionLabel,
              scoreDetail: rubber.scoreDetail,
            },
          ].slice(-6),
        )
        teamCategoryFormItemsMap.set(f.homeTeamId, byCategory)
      }
      if (f.awayTeamId != null) {
        const byCategory = teamCategoryFormItemsMap.get(f.awayTeamId) ?? new Map<string, CategoryFormItem[]>()
        const existing = byCategory.get(normalizedCategory) ?? []
        byCategory.set(
          normalizedCategory,
          [
            ...existing,
            {
              result: awayCategoryResult,
              opponentName: f.homeName ?? "Unknown",
              opponentPlayers: awayOppositionLabel,
              scoreDetail: rubber.scoreDetail,
            },
          ].slice(-6),
        )
        teamCategoryFormItemsMap.set(f.awayTeamId, byCategory)
      }
    }
  }

  // Build shared fixtures — identical structure for every visitor.
  // _categoryLinks stores raw per-category booking links for published,
  // non-completed fixtures so the personal overlay can derive joinUrl
  // and joinUrlByCategory without an extra DB query.
  const sharedFixtures: SharedFixture[] = fixtureRows.map((f) => {
    const status = normaliseStatus(f.status)
    const rubbers = rubbersByFixture.get(f.id) ?? []
    const homePlayers = f.homeTeamId != null ? (teamPlayerMap.get(f.homeTeamId) ?? {}) : {}
    const awayPlayers = f.awayTeamId != null ? (teamPlayerMap.get(f.awayTeamId) ?? {}) : {}
    const rawCourtLinks = (f.courtLinks ?? {}) as Record<string, string>
    const rawCourtAssignments =
      (f.courtAssignments ?? {}) as Record<string, { court: string | null; time: string | null }>

    const categoryLinks: Record<string, string> = {}
    if (f.published) {
      for (const [cat, url] of Object.entries(rawCourtLinks)) {
        if (url) categoryLinks[cat] = url
      }
    }

    return {
      id: f.id,
      week: f.week,
      matchDate: f.matchDate ? new Date(f.matchDate as unknown as string).toISOString() : null,
      timeslot: f.timeslot,
      status,
      divisionId: f.divisionId,
      divisionName: f.divisionName,
      divisionLevel: f.divisionLevel,
      regionId: f.regionId,
      regionName: f.regionName,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeName: f.homeName,
      awayName: f.awayName,
      homeLogo: f.homeLogo,
      awayLogo: f.awayLogo,
      venue: f.venue,
      homePoints: f.homePoints,
      awayPoints: f.awayPoints,
      homeSetsWon: f.homeSetsWon,
      awaySetsWon: f.awaySetsWon,
      winnerTeamId: f.winnerTeamId,
      playoffBracketPosition: (f as { bracketPosition?: number | null }).bracketPosition ?? null,
      homeAvgLi: typeof f.homeAvgLi === "number" ? f.homeAvgLi : null,
      awayAvgLi: typeof f.awayAvgLi === "number" ? f.awayAvgLi : null,
      homePairLi: (() => {
        const out: Record<string, number | null> = {}
        if (f.homeTeamId != null) {
          for (const [key, entry] of pairLiMap.entries()) {
            if (key.startsWith(`${f.homeTeamId}:`)) {
              const cat = key.slice(String(f.homeTeamId).length + 1)
              out[cat] = entry.count > 0 ? entry.sum / entry.count : null
            }
          }
        }
        return out
      })(),
      awayPairLi: (() => {
        const out: Record<string, number | null> = {}
        if (f.awayTeamId != null) {
          for (const [key, entry] of pairLiMap.entries()) {
            if (key.startsWith(`${f.awayTeamId}:`)) {
              const cat = key.slice(String(f.awayTeamId).length + 1)
              out[cat] = entry.count > 0 ? entry.sum / entry.count : null
            }
          }
        }
        return out
      })(),
      homeFormItems: f.homeTeamId != null ? (teamFormItemsMap.get(f.homeTeamId) ?? []) : [],
      awayFormItems: f.awayTeamId != null ? (teamFormItemsMap.get(f.awayTeamId) ?? []) : [],
      homeCategoryFormItems: (() => {
        const out: Record<string, CategoryFormItem[]> = {}
        if (f.homeTeamId == null) return out
        const byCategory = teamCategoryFormItemsMap.get(f.homeTeamId)
        if (!byCategory) return out
        for (const [category, items] of byCategory.entries()) out[category] = items
        return out
      })(),
      awayCategoryFormItems: (() => {
        const out: Record<string, CategoryFormItem[]> = {}
        if (f.awayTeamId == null) return out
        const byCategory = teamCategoryFormItemsMap.get(f.awayTeamId)
        if (!byCategory) return out
        for (const [category, items] of byCategory.entries()) out[category] = items
        return out
      })(),
      _categoryLinks: categoryLinks,
      courtInfoByCategory: f.published ? rawCourtAssignments : {},
      published: !!f.published,
      myCategories: [],
      homePlayers,
      awayPlayers,
      rubbers,
    }
  })

  // Recompute standings presentation from completed fixture data so League Centre
  // stays stable even before all DB migrations are applied.
  const standingByTeam = new Map<number, LCStanding>()
  for (const row of standingsOut) {
    standingByTeam.set(row.teamId, {
      ...row,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      matchesWon: 0,
      setsWon: 0,
      setsLost: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      points: 0,
      pointsDiff: 0,
    })
  }

  for (const fixtureRow of fixtureRows) {
    if (normaliseStatus(fixtureRow.status) !== "completed") continue
    if (fixtureRow.homeTeamId == null || fixtureRow.awayTeamId == null) continue
    const home = standingByTeam.get(fixtureRow.homeTeamId)
    const away = standingByTeam.get(fixtureRow.awayTeamId)
    if (!home || !away) continue

    const rubbers = rubbersByFixture.get(fixtureRow.id) ?? []
    const homeMatchesWon = rubbers.filter((rubber) => rubber.winnerTeamId === fixtureRow.homeTeamId).length
    const awayMatchesWon = rubbers.filter((rubber) => rubber.winnerTeamId === fixtureRow.awayTeamId).length
    let homeGames = 0
    let awayGames = 0
    for (const rubber of rubbers) {
      const parsed = parseScoreDetail(rubber.scoreDetail)
      const tally = tallySets(parsed)
      homeGames += tally.homeGames
      awayGames += tally.awayGames
    }

    home.played += 1
    away.played += 1
    if (fixtureRow.winnerTeamId === fixtureRow.homeTeamId) {
      home.wins += 1
      away.losses += 1
    } else if (fixtureRow.winnerTeamId === fixtureRow.awayTeamId) {
      away.wins += 1
      home.losses += 1
    } else {
      home.draws += 1
      away.draws += 1
    }
    home.matchesWon += homeMatchesWon
    away.matchesWon += awayMatchesWon
    home.setsWon += fixtureRow.homeSetsWon ?? 0
    away.setsWon += fixtureRow.awaySetsWon ?? 0
    home.setsLost += fixtureRow.awaySetsWon ?? 0
    away.setsLost += fixtureRow.homeSetsWon ?? 0
    home.gamesFor += homeGames
    home.gamesAgainst += awayGames
    away.gamesFor += awayGames
    away.gamesAgainst += homeGames
    home.points += fixtureRow.homePoints ?? 0
    away.points += fixtureRow.awayPoints ?? 0
  }

  standingsOut = standingsOut.map((row) => {
    const computed = standingByTeam.get(row.teamId) ?? row
    return {
      ...computed,
      pointsDiff: computed.gamesFor - computed.gamesAgainst,
    }
  })

  const standingsByDivision = new Map<number, LCStanding[]>()
  for (const row of standingsOut) {
    const arr = standingsByDivision.get(row.divisionId) ?? []
    arr.push(row)
    standingsByDivision.set(row.divisionId, arr)
  }
  for (const rows of standingsByDivision.values()) {
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
      return a.teamId - b.teamId
    })
    rows.forEach((row, index) => {
      row.rank = index + 1
    })
  }

  // Rankings (TPR leaderboard) scoped to teams in used divisions.
  const rankingRows = usedDivisionIds.length
    ? await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          teamLogo: teams.logoUrl,
          tpr: teams.tpr,
          highestTpr: teams.highestTpr,
          orgName: organisations.name,
          orgSlug: organisations.slug,
          regionId: divisions.regionId,
          regionName: regions.name,
          divisionName: divisions.name,
          divisionLevel: divisions.level,
        })
        .from(teams)
        .leftJoin(organisations, eq(teams.organisationId, organisations.id))
        .leftJoin(divisions, eq(teams.divisionId, divisions.id))
        .leftJoin(regions, eq(divisions.regionId, regions.id))
        .where(inArray(teams.divisionId, usedDivisionIds))
        .orderBy(desc(teams.tpr))
    : []
  const rankingsOut: LCRanking[] = rankingRows.map((r) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    teamLogo: r.teamLogo,
    tpr: r.tpr,
    highestTpr: r.highestTpr,
    orgName: r.orgName,
    orgSlug: r.orgSlug,
    regionId: r.regionId,
    regionName: r.regionName,
    divisionName: r.divisionName,
    divisionLevel: r.divisionLevel,
  }))

  const teamCount = regionsOut.reduce((sum, r) => sum + r.teamCount, 0)
  const clubCount = new Set(fixtureVenueRows.map((f) => f.venueClubId).filter((id): id is number => id != null)).size
  const matchesPlayed = sharedFixtures.filter((f) => f.status === "completed").length
  const matchesRemaining = sharedFixtures.length - matchesPlayed

  return {
    season: { id: season.id, name: season.name, weeks: season.weeks, status: season.status },
    stats: { seasonName: season.name, teamCount, clubCount, matchesPlayed, matchesRemaining },
    regions: regionsOut,
    divisions: divisionsOut,
    standings: standingsOut,
    sharedFixtures,
    rankings: rankingsOut,
  }
}

/**
 * Shared League Centre payload cached for 60 seconds.
 * Runs at most once per minute across all requests — user-specific fields
 * (mine, joinUrl, assignedToFixture) are computed separately per request.
 */
const getSharedLeagueCentreData = unstable_cache(
  _buildSharedLeagueCentreData,
  ["league-centre-shared-finals-v2"],
  { revalidate: 60, tags: ["league-centre-shared"] },
)

// ---------------------------------------------------------------------------
// Public entry point — merges cached shared data with the user's personal
// overlay using two small targeted queries.
// ---------------------------------------------------------------------------

export async function getLeagueCentreData(user: CurrentUser | null): Promise<LeagueCentreData> {
  const shared = await getSharedLeagueCentreData()

  if (!shared.season) {
    return {
      season: null,
      stats: { seasonName: null, teamCount: 0, clubCount: 0, matchesPlayed: 0, matchesRemaining: 0 },
      regions: [],
      divisions: [],
      standings: [],
      fixtures: [],
      rankings: [],
      myMatches: [],
      authed: !!user,
      currentPlayerId: null,
    }
  }

  // Anonymous visitors: strip the internal _categoryLinks field and return
  // shared data with empty personal fields — no additional DB work needed.
  if (!user) {
    const fixtures: LCFixture[] = shared.sharedFixtures.map((fixture) => {
      const { _categoryLinks, ...f } = fixture
      void _categoryLinks
      return {
        ...f,
        mine: false,
        assignedToFixture: false,
        canSeeBookingLinks: false,
        canSeeAdminPlaytomicLinks: false,
        canSubmitResult: false,
        canSubmitAllCategories: false,
        joinUrl: null,
        joinUrlByCategory: {},
        myCategories: [],
      }
    })
    return {
      season: shared.season,
      stats: shared.stats,
      regions: shared.regions,
      divisions: shared.divisions,
      standings: shared.standings,
      fixtures,
      rankings: shared.rankings,
      myMatches: [],
      authed: false,
      currentPlayerId: null,
    }
  }

  // Authenticated users: two small targeted queries for personal fixture flags.
  const access = await getAccessContext(user)
  // In "View As", permission checks must follow the effective user context.
  // access.isLeagueAdmin is false while impersonating, even for a real super admin.
  const canSeeAllBookingLinks = access.can("league_management") || access.isLeagueAdmin
  const myTeamIds = await getMyTeamIds(user)
  const myTeamIdsArr = [...myTeamIds]
  const captainTeamIds = new Set<number>(
    (
      await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.captainUserId, user.id))
    ).map((row) => row.id),
  )

  // Only the current user's assigned pairing categories for their own teams — typically < 10 rows.
  const myPairings = myTeamIdsArr.length
    ? await db
        .select({ teamId: teamPairings.teamId, category: teamPairings.category })
        .from(teamPairings)
        .where(and(eq(teamPairings.playerId, user.id), inArray(teamPairings.teamId, myTeamIdsArr)))
    : []

  const currentPlayerCategoriesByTeam = new Map<number, Set<string>>()
  for (const p of myPairings) {
    const cats = currentPlayerCategoriesByTeam.get(p.teamId) ?? new Set<string>()
    cats.add(p.category)
    currentPlayerCategoriesByTeam.set(p.teamId, cats)
  }

  const fixtures: LCFixture[] = shared.sharedFixtures.map(({ _categoryLinks, ...f }) => {
    const mine =
      (f.homeTeamId != null && myTeamIds.has(f.homeTeamId)) ||
      (f.awayTeamId != null && myTeamIds.has(f.awayTeamId))
    const isCaptainFixture =
      (f.homeTeamId != null && captainTeamIds.has(f.homeTeamId)) ||
      (f.awayTeamId != null && captainTeamIds.has(f.awayTeamId))

    const allowedCategories = new Set<string>()
    if (f.homeTeamId != null) {
      for (const cat of currentPlayerCategoriesByTeam.get(f.homeTeamId) ?? []) allowedCategories.add(cat)
    }
    if (f.awayTeamId != null) {
      for (const cat of currentPlayerCategoriesByTeam.get(f.awayTeamId) ?? []) allowedCategories.add(cat)
    }
    const assignedToFixture = canSeeAllBookingLinks || mine || allowedCategories.size > 0
    const canSeeBookingLinks = canSeeAllBookingLinks || mine || allowedCategories.size > 0
    const canSubmitAllCategories = canSeeAllBookingLinks || isCaptainFixture
    const canSubmitResult = canSubmitAllCategories || allowedCategories.size > 0

    const joinUrlByCategory: Record<string, string> = {}
    if (canSeeBookingLinks) {
      const normalizedCategoryLinks = new Map<string, string>()
      for (const [category, url] of Object.entries(_categoryLinks)) {
        if (url) normalizedCategoryLinks.set(normalizeCategoryKey(category), url)
      }
      const fixtureCategoryNames = new Set<string>([
        ...Object.keys(_categoryLinks),
        ...Object.keys(f.courtInfoByCategory ?? {}),
        ...Object.keys(f.homePlayers ?? {}),
        ...Object.keys(f.awayPlayers ?? {}),
        ...f.rubbers.map((rubber) => rubber.category).filter(Boolean),
        ...(f.divisionName ? [f.divisionName] : []),
      ])
      const sourceLinks = canSeeAllBookingLinks || isCaptainFixture
        ? [...fixtureCategoryNames]
        : allowedCategories.size > 0
          ? [...allowedCategories]
          : Object.keys(_categoryLinks)
      for (const cat of sourceLinks) {
        const url = _categoryLinks[cat] ?? normalizedCategoryLinks.get(normalizeCategoryKey(cat)) ?? null
        if (url) joinUrlByCategory[cat] = url
      }
    }
    const myCategories = canSeeAllBookingLinks || isCaptainFixture
      ? Object.keys(joinUrlByCategory)
      : allowedCategories.size > 0
        ? [...allowedCategories]
        : []

    return {
      ...f,
      mine,
      assignedToFixture,
      canSeeBookingLinks,
      canSeeAdminPlaytomicLinks: canSeeAllBookingLinks,
      canSubmitResult,
      canSubmitAllCategories,
      joinUrl: myCategories.map((category) => joinUrlByCategory[category]).find(Boolean) ?? null,
      joinUrlByCategory,
      myCategories,
    }
  })

  const myMatches = fixtures
    .filter((f) => f.mine && f.status !== "completed")
    .sort((a, b) => {
      const da = a.matchDate ? Date.parse(a.matchDate) : Number.MAX_SAFE_INTEGER
      const db_ = b.matchDate ? Date.parse(b.matchDate) : Number.MAX_SAFE_INTEGER
      return da - db_
    })

  return {
    season: shared.season,
    stats: shared.stats,
    regions: shared.regions,
    divisions: shared.divisions,
    standings: shared.standings,
    fixtures,
    rankings: shared.rankings,
    myMatches,
    authed: true,
    currentPlayerId: user?.playerId ?? null,
  }
}

export function isLeagueLive(status: string | null | undefined): boolean {
  return !!status && LIVE_STATUSES.has(status)
}

export type LCMatchDetail = {
  fixture: {
    id: number
    week: number
    matchDate: string | null
    timeslot: string | null
    status: LCStatus
    venue: string | null
    divisionName: string | null
    regionName: string | null
    homeTeamId: number | null
    awayTeamId: number | null
    homeName: string | null
    awayName: string | null
    homeLogo: string | null
    awayLogo: string | null
    homePoints: number | null
    awayPoints: number | null
    winnerTeamId: number | null
  }
  rubbers: {
    id: number
    category: string
    isFeatureCourt: boolean
    homeSetsWon: number
    awaySetsWon: number
    scoreDetail: string | null
    winnerTeamId: number | null
  }[]
}

export async function getMatchDetail(fixtureId: number): Promise<LCMatchDetail | null> {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const homeOrg = alias(organisations, "homeOrg")
  const awayOrg = alias(organisations, "awayOrg")
  const [f] = await db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      timeslot: fixtures.timeslot,
      status: fixtures.status,
      venue: sql<string | null>`coalesce(${clubs.name}, ${fixtures.venue})`,
      divisionName: divisions.name,
      regionName: regions.name,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: home.name,
      awayName: away.name,
      homeLogo: sql<string | null>`coalesce(${home.logoUrl}, ${homeOrg.logoUrl})`,
      awayLogo: sql<string | null>`coalesce(${away.logoUrl}, ${awayOrg.logoUrl})`,
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
    .where(and(eq(fixtures.id, fixtureId), eq(fixtures.published, true)))
    .limit(1)
  if (!f) return null

  const rubbers = await db
    .select({
      id: matches.id,
      category: matches.category,
      isFeatureCourt: matches.isFeatureCourt,
      homeSetsWon: matches.homeSetsWon,
      awaySetsWon: matches.awaySetsWon,
      scoreDetail: matches.scoreDetail,
      winnerTeamId: matches.winnerTeamId,
    })
    .from(matches)
    .where(eq(matches.fixtureId, fixtureId))
    .orderBy(asc(matches.session), asc(matches.category))

  return {
    fixture: {
      ...f,
      matchDate: f.matchDate ? new Date(f.matchDate as unknown as string).toISOString() : null,
      status: normaliseStatus(f.status),
    },
    rubbers,
  }
}

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
  user as userTable,
} from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { getCurrentSeason } from "@/lib/queries"
import type { CurrentUser } from "@/lib/session"

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
  losses: number
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
  result: "W" | "L"
  opponentName: string
  homeScore: number
  awayScore: number
  isHome: boolean
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
  /** Average LI for all active players in each team */
  homeAvgLi: number | null
  awayAvgLi: number | null
  /** Average LI per category pair — keyed by category name */
  homePairLi: Record<string, number | null>
  awayPairLi: Record<string, number | null>
  /** Recent form items — up to last 6, oldest first */
  homeFormItems: FormItem[]
  awayFormItems: FormItem[]
  joinUrl: string | null
  /** Per-category booking link, keyed by category. Only present once published. */
  joinUrlByCategory: Record<string, string>
  /** Per-category court + start time, keyed by category. */
  courtInfoByCategory: Record<string, { court: string | null; time: string | null }>
  /** Whether an admin has published this fixture to players. */
  published: boolean
  mine: boolean
  assignedToFixture: boolean
  homePlayers: Record<string, string[]>
  awayPlayers: Record<string, string[]>
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
  homePlayerIds: number[]
  awayPlayerIds: number[]
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
type SharedFixture = Omit<LCFixture, "mine" | "assignedToFixture" | "joinUrl" | "joinUrlByCategory"> & {
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
  if (user.playerId) {
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.playerId, user.playerId), eq(teamMembers.status, "active")))
    memberships.forEach((m) => ids.add(m.teamId))
  }
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
  const standingsOut: LCStanding[] = usedDivisionIds.length
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
          losses: sql<number>`COALESCE(${standings.losses}, 0)`,
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

  const fixtureRows = usedDivisionIds.length
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
          homeLogo: sql<string | null>`coalesce(${home.logoUrl}, ${homeOrg.logoUrl})`,
          awayLogo: sql<string | null>`coalesce(${away.logoUrl}, ${awayOrg.logoUrl})`,
          venue: sql<string | null>`coalesce(${clubs.name}, ${fixtures.venue})`,
          playtomicUrl: sql<string | null>`coalesce(nullif(${fixtures.playtomicUrl}, ''), nullif(${clubs.playtomicUrl}, ''))`,
          published: fixtures.published,
          courtLinks: fixtures.courtLinks,
          courtAssignments: fixtures.courtAssignments,
          homePoints: fixtures.homePoints,
          awayPoints: fixtures.awayPoints,
          homeSetsWon: fixtures.homeSetsWon,
          awaySetsWon: fixtures.awaySetsWon,
          winnerTeamId: fixtures.winnerTeamId,
          homeAvgLi: home.avgLi,
          awayAvgLi: away.avgLi,
        })
        .from(fixtures)
        .leftJoin(home, eq(fixtures.homeTeamId, home.id))
        .leftJoin(away, eq(fixtures.awayTeamId, away.id))
        .leftJoin(homeOrg, eq(home.organisationId, homeOrg.id))
        .leftJoin(awayOrg, eq(away.organisationId, awayOrg.id))
        .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
        .leftJoin(regions, eq(divisions.regionId, regions.id))
        .leftJoin(clubs, eq(fixtures.venueClubId, clubs.id))
        .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.published, true), inArray(fixtures.divisionId, usedDivisionIds)))
        .orderBy(asc(fixtures.matchDate), asc(fixtures.week))
    : []

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
    playerId: string | null
    firstName: string
    lastName: string
    currentLi: number
  }
  const pairingRows: PairingRow[] = allTeamIds.length
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          playerId: teamPairings.playerId,
          firstName: userTable.firstName,
          lastName: userTable.lastName,
          currentLi: userTable.currentLi,
        })
        .from(teamPairings)
        .innerJoin(userTable, eq(teamPairings.playerId, userTable.id))
        .where(inArray(teamPairings.teamId, allTeamIds))
    : []

  const teamPlayerMap = new Map<number, Record<string, string[]>>()
  const pairLiMap = new Map<string, { sum: number; count: number }>()
  for (const row of pairingRows) {
    let catMap = teamPlayerMap.get(row.teamId)
    if (!catMap) { catMap = {}; teamPlayerMap.set(row.teamId, catMap) }
    const arr = catMap[row.category] ?? []
    const name = `${row.firstName} ${row.lastName}`.trim()
    if (!arr.includes(name)) arr.push(name)
    catMap[row.category] = arr

    const key = `${row.teamId}:${row.category}`
    const entry = pairLiMap.get(key) ?? { sum: 0, count: 0 }
    entry.sum += row.currentLi ?? 0
    entry.count += 1
    pairLiMap.set(key, entry)
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
    homePlayerIds: number[]
    awayPlayerIds: number[]
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
          homePlayerIds: sql<number[]>`${matches.homePlayerIds}`,
          awayPlayerIds: sql<number[]>`${matches.awayPlayerIds}`,
        })
        .from(matches)
        .where(inArray(matches.fixtureId, allFixtureIds))
        .orderBy(asc(matches.session), asc(matches.category))
    : []

  const rubbersByFixture = new Map<number, LCRubber[]>()
  for (const r of rubberRows) {
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
      homePlayerIds: Array.isArray(r.homePlayerIds) ? r.homePlayerIds : [],
      awayPlayerIds: Array.isArray(r.awayPlayerIds) ? r.awayPlayerIds : [],
    })
    rubbersByFixture.set(r.fixtureId, arr)
  }

  // Form items per team from completed fixtures (oldest to newest, keep last 6).
  const teamFormItemsMap = new Map<number, FormItem[]>()
  const completedByWeek = [...fixtureRows]
    .filter((f) => normaliseStatus(f.status) === "completed" && f.winnerTeamId != null)
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0))
  for (const f of completedByWeek) {
    if (f.homeTeamId != null) {
      const item: FormItem = {
        result: f.winnerTeamId === f.homeTeamId ? "W" : "L",
        opponentName: f.awayName ?? "Unknown",
        homeScore: f.homePoints ?? 0,
        awayScore: f.awayPoints ?? 0,
        isHome: true,
      }
      teamFormItemsMap.set(f.homeTeamId, [...(teamFormItemsMap.get(f.homeTeamId) ?? []), item].slice(-6))
    }
    if (f.awayTeamId != null) {
      const item: FormItem = {
        result: f.winnerTeamId === f.awayTeamId ? "W" : "L",
        opponentName: f.homeName ?? "Unknown",
        homeScore: f.homePoints ?? 0,
        awayScore: f.awayPoints ?? 0,
        isHome: false,
      }
      teamFormItemsMap.set(f.awayTeamId, [...(teamFormItemsMap.get(f.awayTeamId) ?? []), item].slice(-6))
    }
  }

  // Build shared fixtures — identical structure for every visitor.
  // _categoryLinks stores raw per-category booking links for published,
  // non-completed fixtures so the personal overlay can derive joinUrl
  // and joinUrlByCategory without an extra DB query.
  const sharedFixtures: SharedFixture[] = fixtureRows.map((f) => ({
    id: f.id,
    week: f.week,
    matchDate: f.matchDate ? new Date(f.matchDate as unknown as string).toISOString() : null,
    timeslot: f.timeslot,
    status: normaliseStatus(f.status),
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
    _categoryLinks: f.published && normaliseStatus(f.status) !== "completed"
      ? (f.courtLinks ?? {}) as Record<string, string>
      : {},
    courtInfoByCategory: f.published
      ? ((f.courtAssignments ?? {}) as Record<string, { court: string | null; time: string | null }>)
      : {},
    published: !!f.published,
    homePlayers: f.homeTeamId != null ? (teamPlayerMap.get(f.homeTeamId) ?? {}) : {},
    awayPlayers: f.awayTeamId != null ? (teamPlayerMap.get(f.awayTeamId) ?? {}) : {},
    rubbers: rubbersByFixture.get(f.id) ?? [],
  }))

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
  ["league-centre-shared"],
  { revalidate: 60 },
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
        joinUrl: null,
        joinUrlByCategory: {},
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
  const myTeamIds = await getMyTeamIds(user)
  const myTeamIdsArr = [...myTeamIds]

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

    const allowedCategories = new Set<string>()
    if (f.homeTeamId != null) {
      for (const cat of currentPlayerCategoriesByTeam.get(f.homeTeamId) ?? []) allowedCategories.add(cat)
    }
    if (f.awayTeamId != null) {
      for (const cat of currentPlayerCategoriesByTeam.get(f.awayTeamId) ?? []) allowedCategories.add(cat)
    }
    const assignedToFixture = mine || allowedCategories.size > 0

    const joinUrlByCategory: Record<string, string> = {}
    if (mine) {
      const sourceLinks = allowedCategories.size > 0 ? [...allowedCategories] : Object.keys(_categoryLinks)
      for (const cat of sourceLinks) {
        const url = _categoryLinks[cat]
        if (url) joinUrlByCategory[cat] = url
      }
    }

    return {
      ...f,
      mine,
      assignedToFixture,
      joinUrl: Object.values(joinUrlByCategory)[0] ?? null,
      joinUrlByCategory,
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

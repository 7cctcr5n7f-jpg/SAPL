import { db } from "@/lib/db"
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
  players,
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
  /** Average LI (league index) for all active players in each team */
  homeAvgLi: number | null
  awayAvgLi: number | null
  /** Recent form string — up to last 6 results, e.g. "WWLWWL", newest last */
  homeForm: string
  awayForm: string
  // Only populated for logged-in players eligible to play this fixture.
  joinUrl: string | null
  mine: boolean
  // Player names per team, keyed by category (e.g. "Mens Open" → ["John Smith", "Peter Jones"])
  homePlayers: Record<string, string[]>
  awayPlayers: Record<string, string[]>
  // Individual category rubbers for this fixture
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

const LIVE_STATUSES = new Set(["active", "published"])

/** Team ids the user is eligible to play for (captain or active roster member). */
async function getMyTeamIds(user: CurrentUser): Promise<Set<number>> {
  const ids = new Set<number>()
  const captainTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.captainUserId, user.id))
  captainTeams.forEach((t) => ids.add(t.id))
  if (user.playerId) {
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.playerId, user.playerId), eq(teamMembers.status, "active")))
    memberships.forEach((m) => ids.add(m.teamId))
  }
  return ids
}

export async function getLeagueCentreData(user: CurrentUser | null): Promise<LeagueCentreData> {
  const season = await getCurrentSeason()
  if (!season) {
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
      currentPlayerId: user?.playerId ?? null,
    }
  }

  // Divisions in this season, with their region.
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

  // Assigned team counts per division (Placement Board entries).
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

  // Only surface divisions that are actually used this season (assigned teams).
  const usedDivisions = seasonDivisions.filter((d) => (entryByDivision.get(d.id) ?? 0) > 0)

  const divisionsOut: LCDivision[] = usedDivisions.map((d) => ({
    id: d.id,
    name: d.name,
    level: d.level,
    regionId: d.regionId,
    teamCount: entryByDivision.get(d.id) ?? 0,
  }))

  // Clubs per region (used for region cards).
  const clubCounts = await db
    .select({ regionId: clubs.regionId, count: sql<number>`count(*)::int` })
    .from(clubs)
    .groupBy(clubs.regionId)
  const clubByRegion = new Map<number, number>()
  clubCounts.forEach((r) => {
    if (r.regionId != null) clubByRegion.set(r.regionId, r.count)
  })

  // Build region cards from regions that have at least one used division.
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

  // Standings for all used divisions.
  const standingsOut: LCStanding[] = divisionIds.length
    ? (
        await db
          .select({
            divisionId: standings.divisionId,
            teamId: standings.teamId,
            teamName: teams.name,
            teamLogo: teams.logoUrl,
            orgName: organisations.name,
            orgSlug: organisations.slug,
            orgLogo: organisations.logoUrl,
            played: standings.played,
            wins: standings.wins,
            losses: standings.losses,
            setsWon: standings.setsWon,
            setsLost: standings.setsLost,
            gamesFor: standings.gamesFor,
            gamesAgainst: standings.gamesAgainst,
            points: standings.points,
            pointsDiff: standings.pointsDiff,
            rank: standings.rank,
            tpr: teams.tpr,
          })
          .from(standings)
          .leftJoin(teams, eq(standings.teamId, teams.id))
          .leftJoin(organisations, eq(teams.organisationId, organisations.id))
          .where(eq(standings.seasonId, season.id))
          .orderBy(asc(standings.divisionId), asc(standings.rank))
      ).filter((s) => entryByDivision.has(s.divisionId))
    : []

  // Fixtures (timeline). Join both teams + their orgs for logos.
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const homeOrg = alias(organisations, "homeOrg")
  const awayOrg = alias(organisations, "awayOrg")
  const fixtureRows = await db
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
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: home.name,
      awayName: away.name,
      homeLogo: sql<string | null>`coalesce(${home.logoUrl}, ${homeOrg.logoUrl})`,
      awayLogo: sql<string | null>`coalesce(${away.logoUrl}, ${awayOrg.logoUrl})`,
      venue: sql<string | null>`coalesce(${clubs.name}, ${fixtures.venue})`,
      // Fall back to the host club's booking link when the fixture has none.
      playtomicUrl: sql<string | null>`coalesce(nullif(${fixtures.playtomicUrl}, ''), nullif(${clubs.playtomicUrl}, ''))`,
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
    .where(eq(fixtures.seasonId, season.id))
    .orderBy(asc(fixtures.matchDate), asc(fixtures.week))

  const myTeamIds = user ? await getMyTeamIds(user) : new Set<number>()

  // Fetch team pairings with player names for all teams in these fixtures so
  // cards can display "Player 1 / Player 2" per category inline.
  const allTeamIds = Array.from(
    new Set(
      fixtureRows.flatMap((f) => [f.homeTeamId, f.awayTeamId].filter((id): id is number => id != null)),
    ),
  )
  type PairingRow = { teamId: number; category: string; firstName: string; lastName: string }
  const pairingRows: PairingRow[] = allTeamIds.length
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          firstName: players.firstName,
          lastName: players.lastName,
        })
        .from(teamPairings)
        .innerJoin(players, eq(teamPairings.playerId, players.id))
        .where(inArray(teamPairings.teamId, allTeamIds))
    : []

  // Build a map: teamId → category → ["First Last", ...]
  const teamPlayerMap = new Map<number, Record<string, string[]>>()
  for (const row of pairingRows) {
    let catMap = teamPlayerMap.get(row.teamId)
    if (!catMap) { catMap = {}; teamPlayerMap.set(row.teamId, catMap) }
    const arr = catMap[row.category] ?? []
    const name = `${row.firstName} ${row.lastName}`.trim()
    if (!arr.includes(name)) arr.push(name)
    catMap[row.category] = arr
  }

  // Fetch rubbers (individual category matches) for all fixtures this season
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

  // Build a map: fixtureId → LCRubber[]
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

  // Build per-team form strings from completed fixtures in week order.
  // W = win, L = loss, D = draw. Keep the last 6 results, oldest→newest.
  const teamFormMap = new Map<number, string>()
  const completedByWeek = [...fixtureRows]
    .filter((f) => normaliseStatus(f.status) === "completed" && f.winnerTeamId != null)
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0))
  for (const f of completedByWeek) {
    if (f.homeTeamId != null) {
      const result = f.winnerTeamId === f.homeTeamId ? "W" : "L"
      const prev = teamFormMap.get(f.homeTeamId) ?? ""
      teamFormMap.set(f.homeTeamId, (prev + result).slice(-6))
    }
    if (f.awayTeamId != null) {
      const result = f.winnerTeamId === f.awayTeamId ? "W" : "L"
      const prev = teamFormMap.get(f.awayTeamId) ?? ""
      teamFormMap.set(f.awayTeamId, (prev + result).slice(-6))
    }
  }

  const fixturesOut: LCFixture[] = fixtureRows
    .filter((f) => entryByDivision.has(f.divisionId))
    .map((f) => {
      const mine =
        !!user &&
        ((f.homeTeamId != null && myTeamIds.has(f.homeTeamId)) ||
          (f.awayTeamId != null && myTeamIds.has(f.awayTeamId)))
      return {
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
        homeForm: f.homeTeamId != null ? (teamFormMap.get(f.homeTeamId) ?? "") : "",
        awayForm: f.awayTeamId != null ? (teamFormMap.get(f.awayTeamId) ?? "") : "",
        // Never expose booking links publicly — only to eligible logged-in players.
        joinUrl: mine && f.status !== "completed" ? (f.playtomicUrl ?? null) : null,
        mine,
        homePlayers: f.homeTeamId != null ? (teamPlayerMap.get(f.homeTeamId) ?? {}) : {},
        awayPlayers: f.awayTeamId != null ? (teamPlayerMap.get(f.awayTeamId) ?? {}) : {},
        rubbers: rubbersByFixture.get(f.id) ?? [],
      }
    })

  // Team rankings (TPR leaderboard) scoped to teams used this season.
  const usedDivisionIds = divisionsOut.map((d) => d.id)
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

  // My upcoming matches (logged-in players only) — soonest first.
  const myMatches = fixturesOut
    .filter((f) => f.mine && f.status !== "completed")
    .sort((a, b) => {
      const da = a.matchDate ? Date.parse(a.matchDate) : Number.MAX_SAFE_INTEGER
      const db_ = b.matchDate ? Date.parse(b.matchDate) : Number.MAX_SAFE_INTEGER
      return da - db_
    })

  // Header stats.
  const teamCount = regionsOut.reduce((sum, r) => sum + r.teamCount, 0)
  const clubCount = regionsOut.reduce((sum, r) => sum + r.clubCount, 0)
  const matchesPlayed = fixturesOut.filter((f) => f.status === "completed").length
  const matchesRemaining = fixturesOut.length - matchesPlayed

  return {
    season: { id: season.id, name: season.name, weeks: season.weeks, status: season.status },
    stats: { seasonName: season.name, teamCount, clubCount, matchesPlayed, matchesRemaining },
    regions: regionsOut,
    divisions: divisionsOut,
    standings: standingsOut,
    fixtures: fixturesOut,
    rankings: rankingsOut,
    myMatches,
    authed: !!user,
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
    .where(eq(fixtures.id, fixtureId))
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

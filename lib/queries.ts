import { db } from "@/lib/db"
import {
  teams,
  organisations,
  clubs,
  divisions,
  seasons,
  standings,
  fixtures,
  matches,
  sponsors,
  settings,
  tprHistory,
  teamMembers,
  categories,
  regions,
  playoffs,
  user,
} from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { TEAM_VISIBLE_STATUSES } from "@/lib/team-lifecycle"
import { parseScoreDetail, tallySets } from "@/lib/engine/scoring"

export async function getCurrentSeason() {
  const [season] = await db
    .select({
      id: seasons.id,
      name: seasons.name,
      weeks: seasons.weeks,
      status: seasons.status,
      isCurrent: seasons.isCurrent,
      playerFee: seasons.playerFee,
    })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1)
  if (season) return season
  const [latest] = await db
    .select({
      id: seasons.id,
      name: seasons.name,
      weeks: seasons.weeks,
      status: seasons.status,
      isCurrent: seasons.isCurrent,
      playerFee: seasons.playerFee,
    })
    .from(seasons)
    .orderBy(desc(seasons.id))
    .limit(1)
  return latest ?? null
}

/**
 * The per-player league join fee (VAT inclusive, in Rand). Resolved from the
 * given season when provided, otherwise the current season. Falls back to the
 * DEFAULT_LEAGUE_JOIN_FEE constant when no season fee is configured.
 */
export async function getPlayerFee(seasonId?: number | null): Promise<number> {
  const { DEFAULT_LEAGUE_JOIN_FEE } = await import("@/lib/constants")
  if (seasonId != null) {
    const [s] = await db.select({ fee: seasons.playerFee }).from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    if (s?.fee != null) return s.fee
  }
  const current = await getCurrentSeason()
  return current?.playerFee ?? DEFAULT_LEAGUE_JOIN_FEE
}

export async function getDivisions(seasonId: number) {
  return db.select({ id: divisions.id, name: divisions.name, level: divisions.level, seasonId: divisions.seasonId, regionId: divisions.regionId }).from(divisions).where(eq(divisions.seasonId, seasonId)).orderBy(asc(divisions.level))
}

/** Divisions for a season including their SAPL region name, for region-grouped standings. */
export async function getDivisionsWithRegion(seasonId: number) {
  return db
    .select({
      id: divisions.id,
      name: divisions.name,
      level: divisions.level,
      regionId: divisions.regionId,
      regionName: regions.name,
    })
    .from(divisions)
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(eq(divisions.seasonId, seasonId))
    .orderBy(asc(regions.name), asc(divisions.level))
}

export async function getCategories() {
  return db.select({ id: categories.id, name: categories.name, sortOrder: categories.sortOrder }).from(categories).orderBy(asc(categories.sortOrder))
}

export async function getRegions() {
  return db.select({ id: regions.id, name: regions.name }).from(regions).orderBy(asc(regions.name))
}

// Team Power Rating leaderboard
export async function getTeamRankings(limit = 100) {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      tpr: teams.tpr,
      highestTpr: teams.highestTpr,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      divisionName: divisions.name,
      divisionLevel: divisions.level,
    })
    .from(teams)
    .leftJoin(organisations, eq(teams.organisationId, organisations.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(inArray(teams.status, [...TEAM_VISIBLE_STATUSES]))
    .orderBy(desc(teams.tpr))
    .limit(limit)
}

export async function getConferenceLeaders(limit = 12) {
  const season = await getCurrentSeason()
  if (!season) return []
  const divisionRows = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      level: divisions.level,
      regionName: regions.name,
    })
    .from(divisions)
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(eq(divisions.seasonId, season.id))

  const teamRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      divisionId: teams.divisionId,
    })
    .from(teams)
    .where(and(eq(teams.seasonId, season.id), inArray(teams.status, [...TEAM_VISIBLE_STATUSES])))

  const fixtureRows = await db
    .select({
      fixtureId: fixtures.id,
      divisionId: fixtures.divisionId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      winnerTeamId: fixtures.winnerTeamId,
      homeSetsWon: fixtures.homeSetsWon,
      awaySetsWon: fixtures.awaySetsWon,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
    })
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.status, "completed")))

  const fixtureIds = fixtureRows.map((f) => f.fixtureId)
  const matchRows = fixtureIds.length
    ? await db
        .select({
          fixtureId: matches.fixtureId,
          winnerTeamId: matches.winnerTeamId,
          scoreDetail: matches.scoreDetail,
        })
        .from(matches)
        .where(inArray(matches.fixtureId, fixtureIds))
    : []

  const rubbersByFixture = new Map<number, { homeMatchesWon: number; awayMatchesWon: number; homeGames: number; awayGames: number }>()
  const fixtureMap = new Map<number, { homeTeamId: number | null; awayTeamId: number | null }>()
  for (const f of fixtureRows) {
    fixtureMap.set(f.fixtureId, { homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId })
    rubbersByFixture.set(f.fixtureId, { homeMatchesWon: 0, awayMatchesWon: 0, homeGames: 0, awayGames: 0 })
  }
  for (const m of matchRows) {
    const fixture = fixtureMap.get(m.fixtureId)
    const agg = rubbersByFixture.get(m.fixtureId)
    if (!fixture || !agg) continue
    if (fixture.homeTeamId != null && m.winnerTeamId === fixture.homeTeamId) agg.homeMatchesWon += 1
    if (fixture.awayTeamId != null && m.winnerTeamId === fixture.awayTeamId) agg.awayMatchesWon += 1
    const tally = tallySets(parseScoreDetail(m.scoreDetail))
    agg.homeGames += tally.homeGames
    agg.awayGames += tally.awayGames
  }

  type LeaderStats = {
    teamId: number
    teamName: string
    played: number
    points: number
    matchesWon: number
    setsWon: number
    pointsDiff: number
  }
  const divisionTeamStats = new Map<number, LeaderStats[]>()
  for (const team of teamRows) {
    if (!team.divisionId) continue
    const arr = divisionTeamStats.get(team.divisionId) ?? []
    arr.push({
      teamId: team.teamId,
      teamName: team.teamName,
      played: 0,
      points: 0,
      matchesWon: 0,
      setsWon: 0,
      pointsDiff: 0,
    })
    divisionTeamStats.set(team.divisionId, arr)
  }

  const statsByTeam = new Map<number, LeaderStats>()
  for (const arr of divisionTeamStats.values()) {
    for (const row of arr) statsByTeam.set(row.teamId, row)
  }

  for (const fixture of fixtureRows) {
    if (fixture.homeTeamId == null || fixture.awayTeamId == null) continue
    const home = statsByTeam.get(fixture.homeTeamId)
    const away = statsByTeam.get(fixture.awayTeamId)
    if (!home || !away) continue
    const rubber = rubbersByFixture.get(fixture.fixtureId)
    const homeGames = rubber?.homeGames ?? 0
    const awayGames = rubber?.awayGames ?? 0
    home.played += 1
    away.played += 1
    home.points += fixture.homePoints ?? 0
    away.points += fixture.awayPoints ?? 0
    home.matchesWon += rubber?.homeMatchesWon ?? 0
    away.matchesWon += rubber?.awayMatchesWon ?? 0
    home.setsWon += fixture.homeSetsWon ?? 0
    away.setsWon += fixture.awaySetsWon ?? 0
    home.pointsDiff += homeGames - awayGames
    away.pointsDiff += awayGames - homeGames
  }

  const leaders = divisionRows
    .map((division) => {
      const rows = [...(divisionTeamStats.get(division.id) ?? [])]
      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
        if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
        if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
        return a.teamId - b.teamId
      })
      return rows[0]
        ? {
            teamId: rows[0].teamId,
            teamName: rows[0].teamName,
            points: rows[0].points,
            divisionName: division.name,
            divisionLevel: division.level,
            regionName: division.regionName,
          }
        : null
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => {
      if (a.divisionLevel !== b.divisionLevel) return a.divisionLevel - b.divisionLevel
      return (a.regionName ?? "").localeCompare(b.regionName ?? "")
    })

  return leaders.slice(0, limit)
}

export async function getDonutFactoryLeaders(limit = 3) {
  const season = await getCurrentSeason()
  if (!season) return []

  const rows = await db
    .select({
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      scoreDetail: matches.scoreDetail,
    })
    .from(matches)
    .innerJoin(fixtures, eq(matches.fixtureId, fixtures.id))
    .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.status, "completed")))

  const donutCounts = new Map<number, number>()
  for (const row of rows) {
    const sets = parseScoreDetail(row.scoreDetail)
    for (const set of sets) {
      if (set.home === 6 && set.away === 0 && row.homeTeamId != null) {
        donutCounts.set(row.homeTeamId, (donutCounts.get(row.homeTeamId) ?? 0) + 1)
      } else if (set.away === 6 && set.home === 0 && row.awayTeamId != null) {
        donutCounts.set(row.awayTeamId, (donutCounts.get(row.awayTeamId) ?? 0) + 1)
      }
    }
  }

  if (donutCounts.size === 0) return []

  const teamIds = [...donutCounts.keys()]
  const teamRows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, teamIds))
  const nameById = new Map<number, string>()
  for (const row of teamRows) nameById.set(row.id, row.name)

  return [...donutCounts.entries()]
    .map(([teamId, donuts]) => ({
      teamId,
      teamName: nameById.get(teamId) ?? `Team ${teamId}`,
      donuts,
    }))
    .sort((a, b) => {
      if (b.donuts !== a.donuts) return b.donuts - a.donuts
      return a.teamName.localeCompare(b.teamName)
    })
    .slice(0, limit)
}

// Club Performance Index leaderboard
export async function getCpiRankings() {
  const rows = await db
    .select({
      orgId: organisations.id,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      type: organisations.type,
      city: organisations.city,
      province: organisations.province,
      cpi: organisations.cpi,
      teamCount: sql<number>`count(${teams.id})::int`,
    })
    .from(organisations)
    .leftJoin(teams, eq(teams.organisationId, organisations.id))
    .groupBy(organisations.id)
    .orderBy(desc(organisations.cpi))
  return rows
}

export async function getStandingsForDivision(divisionId: number) {
  return db
    .select({
      teamId: standings.teamId,
      teamName: teams.name,
      orgName: organisations.name,
      orgSlug: organisations.slug,
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
    .where(eq(standings.divisionId, divisionId))
    .orderBy(asc(standings.rank))
}

export type FixtureRow = Awaited<ReturnType<typeof getFixtures>>[number]

export async function getFixtures(opts: { seasonId: number; divisionId?: number; week?: number }) {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const conditions = [eq(fixtures.seasonId, opts.seasonId)]
  conditions.push(eq(fixtures.published, true))
  if (opts.divisionId) conditions.push(eq(fixtures.divisionId, opts.divisionId))
  if (opts.week) conditions.push(eq(fixtures.week, opts.week))

  return db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      timeslot: fixtures.timeslot,
      venue: fixtures.venue,
      playtomicUrl: fixtures.playtomicUrl,
      courtLinks: fixtures.courtLinks,
      status: fixtures.status,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: home.name,
      awayTeamName: away.name,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
      homeSetsWon: fixtures.homeSetsWon,
      awaySetsWon: fixtures.awaySetsWon,
      winnerTeamId: fixtures.winnerTeamId,
      divisionId: fixtures.divisionId,
      divisionName: divisions.name,
      saplRegion: sql<string | null>`coalesce(${home.saplRegion}, ${away.saplRegion})`,
    })
    .from(fixtures)
    .leftJoin(home, eq(fixtures.homeTeamId, home.id))
    .leftJoin(away, eq(fixtures.awayTeamId, away.id))
    .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .where(and(...conditions))
    .orderBy(asc(fixtures.week), asc(fixtures.matchDate))
}

export async function getRecentResults(seasonId: number, limit = 8) {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  return db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      homeTeamName: home.name,
      awayTeamName: away.name,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
      winnerTeamId: fixtures.winnerTeamId,
      homeTeamId: fixtures.homeTeamId,
      divisionName: divisions.name,
    })
    .from(fixtures)
    .leftJoin(home, eq(fixtures.homeTeamId, home.id))
    .leftJoin(away, eq(fixtures.awayTeamId, away.id))
    .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.status, "completed")))
    .orderBy(desc(fixtures.week), desc(fixtures.id))
    .limit(limit)
}

export async function getOrganisations() {
  return db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      type: organisations.type,
      city: organisations.city,
      province: organisations.province,
      cpi: organisations.cpi,
      logoUrl: organisations.logoUrl,
      teamCount: sql<number>`count(${teams.id})::int`,
    })
    .from(organisations)
    .leftJoin(teams, eq(teams.organisationId, organisations.id))
    .groupBy(organisations.id)
    .orderBy(desc(organisations.cpi))
}

export async function getOrganisationBySlug(slug: string) {
  const [org] = await db.select({ id: organisations.id, name: organisations.name, slug: organisations.slug, type: organisations.type, city: organisations.city, province: organisations.province, cpi: organisations.cpi, logoUrl: organisations.logoUrl }).from(organisations).where(eq(organisations.slug, slug)).limit(1)
  if (!org) return null
  const orgTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      tpr: teams.tpr,
      highestTpr: teams.highestTpr,
      status: teams.status,
      divisionName: divisions.name,
      divisionLevel: divisions.level,
    })
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(eq(teams.organisationId, org.id))
    .orderBy(asc(divisions.level))
  return { org, teams: orgTeams }
}

export async function getTeamDetail(teamId: number) {
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      tpr: teams.tpr,
      highestTpr: teams.highestTpr,
      status: teams.status,
      captainUserId: teams.captainUserId,
      orgId: organisations.id,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      divisionId: divisions.id,
      divisionName: divisions.name,
      divisionLevel: divisions.level,
      seasonId: teams.seasonId,
    })
    .from(teams)
    .leftJoin(organisations, eq(teams.organisationId, organisations.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return null

  const roster = await db
    .select({
      memberId: teamMembers.id,
      playerId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      currentLi: user.currentLi,
      currentTpr: user.currentTpr,
      role: teamMembers.role,
      status: teamMembers.status,
    })
    .from(teamMembers)
    .leftJoin(user, eq(teamMembers.playerId, user.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))

  const history = await db
    .select({ tpr: tprHistory.tpr, change: tprHistory.change, createdAt: tprHistory.createdAt })
    .from(tprHistory)
    .where(eq(tprHistory.teamId, teamId))
    .orderBy(asc(tprHistory.createdAt))

  return { team, roster, history }
}

const sponsorFields = {
  id: sponsors.id, name: sponsors.name, tier: sponsors.tier, scopeId: sponsors.scopeId,
  logoUrl: sponsors.logoUrl, website: sponsors.website, description: sponsors.description,
  level: sponsors.level, tagline: sponsors.tagline, mainSponsor: sponsors.mainSponsor,
  contractStart: sponsors.contractStart, contractEnd: sponsors.contractEnd,
  active: sponsors.active, createdAt: sponsors.createdAt,
}

export async function getSponsors() {
  return db.select(sponsorFields).from(sponsors).where(eq(sponsors.active, true)).orderBy(asc(sponsors.tier))
}

export async function getMainSponsor() {
  const rows = await db
    .select(sponsorFields)
    .from(sponsors)
    .where(and(eq(sponsors.active, true), eq(sponsors.mainSponsor, true)))
    .limit(1)
  return rows[0] ?? null
}

export async function getPrizePool() {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(sql`${settings.key} in ('prize_pool','prize_pool_label')`)
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const amount = (map.get("prize_pool") ?? "").trim()
  const label = (map.get("prize_pool_label") ?? "Total Prize Pool").trim() || "Total Prize Pool"
  return { amount, label, hasAmount: amount.length > 0 }
}

export async function getFreeAgents() {
  return db
    .select()
    .from(user)
    .where(eq(user.lookingForTeam, true))
    .orderBy(desc(user.currentLi))
    .limit(200)
}

// Admin-managed clubs as simple {id,name} options for selects/filters.
export async function getClubOptions() {
  return db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .orderBy(asc(clubs.name))
}

export async function getLeagueStats() {
  const [teamCount] = await db.select({ c: sql<number>`count(*)::int` }).from(teams)
  const [orgCount] = await db.select({ c: sql<number>`count(*)::int` }).from(organisations)
  const [playerCount] = await db.select({ c: sql<number>`count(*)::int` }).from(user)
  const [fixtureCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(fixtures)
    .where(eq(fixtures.status, "completed"))
  const [divisionCount] = await db.select({ c: sql<number>`count(*)::int` }).from(divisions)
  return {
    teams: teamCount?.c ?? 0,
    organisations: orgCount?.c ?? 0,
    players: playerCount?.c ?? 0,
    matchesPlayed: fixtureCount?.c ?? 0,
    divisions: divisionCount?.c ?? 0,
  }
}

export async function getPlayoffs(seasonId: number) {
  return db.select({ id: playoffs.id }).from(playoffs).where(eq(playoffs.seasonId, seasonId)).orderBy(asc(playoffs.bracketPosition))
}

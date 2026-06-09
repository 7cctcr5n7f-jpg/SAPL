import { db } from "@/lib/db"
import {
  teams,
  organisations,
  clubs,
  divisions,
  seasons,
  standings,
  fixtures,
  players,
  sponsors,
  settings,
  tprHistory,
  teamMembers,
  categories,
  regions,
  playoffs,
} from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { and, asc, desc, eq, sql } from "drizzle-orm"

export async function getCurrentSeason() {
  const [season] = await db.select().from(seasons).where(eq(seasons.isCurrent, true)).limit(1)
  if (season) return season
  const [latest] = await db.select().from(seasons).orderBy(desc(seasons.id)).limit(1)
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
  return db.select().from(divisions).where(eq(divisions.seasonId, seasonId)).orderBy(asc(divisions.level))
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
  return db.select().from(categories).orderBy(asc(categories.sortOrder))
}

export async function getRegions() {
  return db.select().from(regions).orderBy(asc(regions.name))
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
    .where(eq(teams.status, "active"))
    .orderBy(desc(teams.tpr))
    .limit(limit)
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
  const [org] = await db.select().from(organisations).where(eq(organisations.slug, slug)).limit(1)
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
      playerId: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      gender: players.gender,
      currentLi: players.currentLi,
      currentTpr: players.currentTpr,
      role: teamMembers.role,
      status: teamMembers.status,
    })
    .from(teamMembers)
    .leftJoin(players, eq(teamMembers.playerId, players.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))

  const history = await db
    .select({ tpr: tprHistory.tpr, change: tprHistory.change, createdAt: tprHistory.createdAt })
    .from(tprHistory)
    .where(eq(tprHistory.teamId, teamId))
    .orderBy(asc(tprHistory.createdAt))

  return { team, roster, history }
}

export async function getSponsors() {
  return db.select().from(sponsors).where(eq(sponsors.active, true)).orderBy(asc(sponsors.tier))
}

export async function getMainSponsor() {
  const rows = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.active, true), eq(sponsors.mainSponsor, true)))
    .limit(1)
  return rows[0] ?? null
}

export async function getPrizePool() {
  const rows = await db.select().from(settings).where(sql`${settings.key} in ('prize_pool','prize_pool_label')`)
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const amount = (map.get("prize_pool") ?? "").trim()
  const label = (map.get("prize_pool_label") ?? "Total Prize Pool").trim() || "Total Prize Pool"
  return { amount, label, hasAmount: amount.length > 0 }
}

export async function getFreeAgents() {
  return db
    .select()
    .from(players)
    .where(eq(players.lookingForTeam, true))
    .orderBy(desc(players.currentLi))
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
  const [playerCount] = await db.select({ c: sql<number>`count(*)::int` }).from(players)
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
  return db.select().from(playoffs).where(eq(playoffs.seasonId, seasonId)).orderBy(asc(playoffs.bracketPosition))
}

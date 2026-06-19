import { db } from "@/lib/db"
import { teams, organisations, clubs, fixtures, user as user, teamMembers, divisions } from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { and, asc, desc, eq, ne, isNotNull, sql } from "drizzle-orm"
import { SAPL_REGIONS } from "@/lib/constants"

/** Headline + founding counts for the live stats band. */
export async function getLandingStats() {
  const [playerCount] = await db.select({ c: sql<number>`count(*)::int` }).from(user)
  const [teamCount] = await db.select({ c: sql<number>`count(*)::int` }).from(teams)
  const [venueCount] = await db.select({ c: sql<number>`count(*)::int` }).from(clubs)
  const [matchCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(fixtures)
    .where(eq(fixtures.status, "completed"))
  const [clubOrgCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(organisations)
    .where(eq(organisations.type, "Padel Club"))
  const [companyCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(organisations)
    .where(eq(organisations.type, "Corporate Company"))

  return {
    players: playerCount?.c ?? 0,
    teams: teamCount?.c ?? 0,
    venues: venueCount?.c ?? 0,
    matchesPlayed: matchCount?.c ?? 0,
    foundingClubs: clubOrgCount?.c ?? 0,
    foundingTeams: teamCount?.c ?? 0,
    foundingCompanies: companyCount?.c ?? 0,
  }
}

export type RegionBreakdown = {
  name: string
  teams: number
  clubs: number
  players: number
}

/** Teams / clubs / players grouped by SAPL region for the "Represent Your Region" cards. */
export async function getRegionBreakdown(): Promise<RegionBreakdown[]> {
  const teamRows = await db
    .select({ region: teams.saplRegion, c: sql<number>`count(*)::int` })
    .from(teams)
    .groupBy(teams.saplRegion)
  const clubRows = await db
    .select({ region: clubs.saplRegion, c: sql<number>`count(*)::int` })
    .from(clubs)
    .groupBy(clubs.saplRegion)
  const playerRows = await db
    .select({ region: teams.saplRegion, c: sql<number>`count(distinct ${teamMembers.playerId})::int` })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.status, "active"))
    .groupBy(teams.saplRegion)

  const tMap = new Map(teamRows.map((r) => [r.region, r.c]))
  const cMap = new Map(clubRows.map((r) => [r.region, r.c]))
  const pMap = new Map(playerRows.map((r) => [r.region, r.c]))

  return SAPL_REGIONS.map((name) => ({
    name,
    teams: tMap.get(name) ?? 0,
    clubs: cMap.get(name) ?? 0,
    players: pMap.get(name) ?? 0,
  }))
}

export type FeaturedClub = {
  id: number
  name: string
  slug: string | null
  saplRegion: string | null
  logoUrl: string | null
  cpi: number
  teamCount: number
  playerCount: number
}

/** Every club (managed in the admin portal), ordered by activity, for the clubs logo wall. */
export async function getFeaturedClubs(limit?: number): Promise<FeaturedClub[]> {
  const q = db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      saplRegion: clubs.saplRegion,
      logoUrl: clubs.logoUrl,
      cpi: sql<number>`coalesce(${organisations.cpi}, 0)`,
      teamCount: sql<number>`count(distinct ${teams.id})::int`,
      playerCount: sql<number>`count(distinct ${teamMembers.playerId})::int`,
    })
    .from(clubs)
    .leftJoin(organisations, eq(organisations.id, clubs.organisationId))
    .leftJoin(teams, eq(teams.homeClubId, clubs.id))
    .leftJoin(teamMembers, and(eq(teamMembers.teamId, teams.id), eq(teamMembers.status, "active")))
    .groupBy(clubs.id, organisations.cpi)
    .orderBy(desc(sql`count(distinct ${teams.id})`), desc(organisations.cpi), asc(clubs.name))
  return limit ? q.limit(limit) : q
}

export type PublicClub = {
  id: number
  name: string
  slug: string | null
  saplRegion: string | null
  logoUrl: string | null
  cpi: number
  teamCount: number
}

/** Every club from the admin portal, ranked by Club Performance Index for the Clubs page and Top Clubs board. */
export async function getPublicClubs(limit?: number): Promise<PublicClub[]> {
  const q = db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      saplRegion: clubs.saplRegion,
      logoUrl: clubs.logoUrl,
      cpi: sql<number>`coalesce(${organisations.cpi}, 0)`,
      teamCount: sql<number>`count(distinct ${teams.id})::int`,
    })
    .from(clubs)
    .leftJoin(organisations, eq(organisations.id, clubs.organisationId))
    .leftJoin(teams, eq(teams.homeClubId, clubs.id))
    .groupBy(clubs.id, organisations.cpi)
    .orderBy(desc(organisations.cpi), desc(sql`count(distinct ${teams.id})`), asc(clubs.name))
  return limit ? q.limit(limit) : q
}

/** A single club (by slug) plus the teams that play out of it, for the club detail page. */
export async function getClubBySlug(slug: string) {
  const [club] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      description: clubs.description,
      address: clubs.address,
      saplRegion: clubs.saplRegion,
      courts: clubs.courts,
      logoUrl: clubs.logoUrl,
      playtomicUrl: clubs.playtomicUrl,
      cpi: sql<number>`coalesce(${organisations.cpi}, 0)`,
    })
    .from(clubs)
    .leftJoin(organisations, eq(organisations.id, clubs.organisationId))
    .where(eq(clubs.slug, slug))
    .limit(1)
  if (!club) return null

  const clubTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      tpr: teams.tpr,
      divisionName: divisions.name,
      divisionLevel: divisions.level,
    })
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(eq(teams.homeClubId, club.id))
    .orderBy(asc(divisions.level))

  return { club, teams: clubTeams }
}

export type UpcomingFixture = {
  id: number
  week: number
  matchDate: Date | string | null
  venue: string | null
  homeTeamName: string | null
  awayTeamName: string | null
  divisionName: string | null
  saplRegion: string | null
}

/** Next scheduled fixtures (teams already assigned) for the upcoming-fixtures preview. */
export async function getUpcomingFixtures(seasonId: number, limit = 6): Promise<UpcomingFixture[]> {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  return db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      venue: fixtures.venue,
      homeTeamName: home.name,
      awayTeamName: away.name,
      divisionName: divisions.name,
      saplRegion: home.saplRegion,
    })
    .from(fixtures)
    .innerJoin(home, eq(fixtures.homeTeamId, home.id))
    .innerJoin(away, eq(fixtures.awayTeamId, away.id))
    .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .where(
      and(
        eq(fixtures.seasonId, seasonId),
        ne(fixtures.status, "completed"),
        isNotNull(fixtures.homeTeamId),
        isNotNull(fixtures.awayTeamId),
      ),
    )
    .orderBy(asc(fixtures.week), asc(fixtures.matchDate))
    .limit(limit)
}

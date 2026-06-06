import { db } from "@/lib/db"
import { fixtures, teams, divisions, clubs, teamMembers, organisations, regions } from "@/lib/db/schema"
import { alias } from "drizzle-orm/pg-core"
import { and, asc, eq } from "drizzle-orm"
import { getCurrentSeason } from "@/lib/queries"
import type { CurrentUser } from "@/lib/session"

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
  courtLinks: Record<string, string>
  homePoints: number | null
  awayPoints: number | null
  winnerTeamId: number | null
  mine: boolean
  canEditLink: boolean
}

export type FixtureScope = "all" | "club" | "team" | "none"

export type HostClub = { id: number; name: string }

export type DashboardFixturesResult = {
  seasonName: string | null
  scope: FixtureScope
  canManageVenue: boolean
  fixtures: DashboardFixture[]
  clubs: HostClub[]
}

async function baseFixtures(seasonId: number) {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
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
    .where(eq(fixtures.seasonId, seasonId))
    .orderBy(asc(fixtures.week), asc(divisions.level), asc(fixtures.matchDate))
}

/**
 * Role-aware fixtures for the dashboard:
 *  - league/super admin: every fixture, can edit venue + Playtomic link
 *  - club admin (org owner): fixtures hosted at their club(s) or involving their
 *    teams, can edit the Playtomic link (their duty)
 *  - captain/player: only fixtures for teams they belong to, view + join link
 */
export async function getDashboardFixtures(user: CurrentUser): Promise<DashboardFixturesResult> {
  const season = await getCurrentSeason()
  if (!season) return { seasonName: null, scope: "none", canManageVenue: false, fixtures: [], clubs: [] }

  const rows = await baseFixtures(season.id)
  const isAdmin = user.role === "league_admin" || user.role === "super_admin"

  if (isAdmin) {
    const hostClubs = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .orderBy(asc(clubs.name))
    return {
      seasonName: season.name,
      scope: "all",
      canManageVenue: true,
      clubs: hostClubs,
      fixtures: rows.map((f) => ({ ...f, mine: true, canEditLink: true })),
    }
  }

  // Club admin: the user owns an organisation (with clubs + teams).
  const [org] = await db.select().from(organisations).where(eq(organisations.ownerUserId, user.id)).limit(1)
  if (org) {
    const orgClubs = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.organisationId, org.id))
    const orgTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.organisationId, org.id))
    const clubIds = new Set(orgClubs.map((c) => c.id))
    const teamIds = new Set(orgTeams.map((t) => t.id))
    const visible = rows.filter(
      (f) =>
        (f.venueClubId != null && clubIds.has(f.venueClubId)) ||
        (f.homeTeamId != null && teamIds.has(f.homeTeamId)) ||
        (f.awayTeamId != null && teamIds.has(f.awayTeamId)),
    )
    return {
      seasonName: season.name,
      scope: "club",
      canManageVenue: false,
      clubs: [],
      fixtures: visible.map((f) => ({
        ...f,
        mine: (f.homeTeamId != null && teamIds.has(f.homeTeamId)) || (f.awayTeamId != null && teamIds.has(f.awayTeamId)),
        // A club manager may only edit booking links for fixtures hosted at one
        // of their own clubs — not matches their team plays away at another venue.
        canEditLink: f.venueClubId != null && clubIds.has(f.venueClubId),
      })),
    }
  }

  // Captain / player: only fixtures for teams they belong to.
  const myTeamIds = new Set<number>()
  const captainTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.captainUserId, user.id))
  captainTeams.forEach((t) => myTeamIds.add(t.id))
  if (user.playerId) {
    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.playerId, user.playerId), eq(teamMembers.status, "active")))
    memberships.forEach((m) => myTeamIds.add(m.teamId))
  }
  const visible = rows.filter(
    (f) => (f.homeTeamId != null && myTeamIds.has(f.homeTeamId)) || (f.awayTeamId != null && myTeamIds.has(f.awayTeamId)),
  )
  return {
    seasonName: season.name,
    scope: "team",
    canManageVenue: false,
    clubs: [],
    fixtures: visible.map((f) => ({ ...f, mine: true, canEditLink: false })),
  }
}

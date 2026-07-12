import { db } from "@/lib/db"
import {
  fixtures,
  teams,
  divisions,
  seasons,
  standings,
  disputes,
  playoffs,
  regions,
  organisations,
  clubs,
} from "@/lib/db/schema"
import { eq, desc, asc, inArray } from "drizzle-orm"

export async function getRegions() {
  return db.select({ id: regions.id, name: regions.name }).from(regions).orderBy(asc(regions.name))
}

// All teams with their current division assignment, for the League Control
// team-assignment panel.
export async function getTeamsForAssignment() {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      divisionId: teams.divisionId,
      regionId: teams.regionId,
      orgName: organisations.name,
      province: organisations.province,
    })
    .from(teams)
    .leftJoin(organisations, eq(teams.organisationId, organisations.id))
    .orderBy(asc(teams.name))
  return rows
}

async function teamNameMap(ids: number[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return new Map<number, string>()
  const rows = await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, unique))
  return new Map(rows.map((r) => [r.id, r.name]))
}

export async function getAdminSummary() {
  const openDisputes = (await db.select({ id: disputes.id }).from(disputes).where(eq(disputes.status, "open"))).length
  const teamCount = (await db.select({ id: teams.id }).from(teams)).length
  const fixtureCount = (await db.select({ id: fixtures.id }).from(fixtures)).length
  return { openDisputes, teamCount, fixtureCount }
}

export async function getSeasonsWithDivisions() {
  const ss = await db
    .select({
      id: seasons.id,
      name: seasons.name,
      status: seasons.status,
      isCurrent: seasons.isCurrent,
      weeks: seasons.weeks,
    })
    .from(seasons)
    .orderBy(desc(seasons.id))
  const ds = await db
    .select({
      id: divisions.id,
      seasonId: divisions.seasonId,
      name: divisions.name,
      level: divisions.level,
      maxTeams: divisions.maxTeams,
      regionId: divisions.regionId,
    })
    .from(divisions)
    .orderBy(asc(divisions.level))
  return ss.map((s) => ({
    ...s,
    divisions: ds.filter((d) => d.seasonId === s.id),
  }))
}

export async function getAllDivisions() {
  return db.select({ id: divisions.id }).from(divisions).orderBy(asc(divisions.level))
}

export async function getAdminFixtures(divisionId?: number) {
  const select = { id: fixtures.id, homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId, week: fixtures.week }
  const rows = divisionId
    ? await db.select(select).from(fixtures).where(eq(fixtures.divisionId, divisionId)).orderBy(asc(fixtures.week))
    : await db.select(select).from(fixtures).orderBy(asc(fixtures.week)).limit(60)
  const ids = rows.flatMap((f) => [f.homeTeamId, f.awayTeamId]).filter((id): id is number => id != null)
  const names = await teamNameMap(ids)
  return rows.map((f) => ({
    ...f,
    homeName: (f.homeTeamId != null ? names.get(f.homeTeamId) : undefined) ?? "TBD",
    awayName: (f.awayTeamId != null ? names.get(f.awayTeamId) : undefined) ?? "TBD",
  }))
}

export async function getOpenDisputes() {
  const rows = await db
    .select()
    .from(disputes)
    .where(inArray(disputes.status, ["open", "under_review"]))
    .orderBy(desc(disputes.createdAt))
  return rows
}

export async function getPlayoffs(seasonId?: number) {
  const select = {
    id: playoffs.id,
    type: playoffs.type,
    round: playoffs.round,
    divisionId: playoffs.divisionId,
    homeTeamId: playoffs.homeTeamId,
    awayTeamId: playoffs.awayTeamId,
    homeLabel: playoffs.homeLabel,
    awayLabel: playoffs.awayLabel,
    homeScore: playoffs.homeScore,
    awayScore: playoffs.awayScore,
    status: playoffs.status,
    bracketPosition: playoffs.bracketPosition,
    matchDate: playoffs.matchDate,
    timeslot: playoffs.timeslot,
    venueClubId: playoffs.venueClubId,
    venue: playoffs.venue,
  }
  const rows = seasonId
    ? await db.select(select).from(playoffs).where(eq(playoffs.seasonId, seasonId)).orderBy(asc(playoffs.bracketPosition))
    : await db.select(select).from(playoffs).orderBy(asc(playoffs.bracketPosition))
  const names = await teamNameMap(rows.flatMap((p) => [p.homeTeamId ?? 0, p.awayTeamId ?? 0]))
  return rows.map((p) => ({
    ...p,
    // Real team once pulled from standings, otherwise the placeholder label.
    homeName: p.homeTeamId ? (names.get(p.homeTeamId) ?? "TBD") : (p.homeLabel ?? "TBD"),
    awayName: p.awayTeamId ? (names.get(p.awayTeamId) ?? "TBD") : (p.awayLabel ?? "TBD"),
    homeResolved: p.homeTeamId != null,
    awayResolved: p.awayTeamId != null,
  }))
}

/** Venues a playoff can be hosted at, with court counts (one fixture = 4 courts). */
export async function getPlayoffVenues() {
  return db
    .select({ id: clubs.id, name: clubs.name, courts: clubs.courts })
    .from(clubs)
    .orderBy(asc(clubs.name))
}

export async function getDivisionStandings(divisionId: number) {
  const rows = await db
    .select()
    .from(standings)
    .where(eq(standings.divisionId, divisionId))
    .orderBy(asc(standings.rank))
  const names = await teamNameMap(rows.map((s) => s.teamId))
  return rows.map((s) => ({ ...s, teamName: names.get(s.teamId) ?? "TBD" }))
}

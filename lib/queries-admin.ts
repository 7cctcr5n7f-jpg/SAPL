import { db } from "@/lib/db"
import {
  fixtures,
  fixturePlanningPairings,
  matches,
  teams,
  divisions,
  seasons,
  standings,
  disputes,
  playoffs,
  regions,
  organisations,
  clubs,
  settings,
  user,
  players,
  teamPairings,
  teamInvites,
} from "@/lib/db/schema"
import { and, eq, desc, asc, inArray, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

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
      startDate: seasons.startDate,
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
      regionName: regions.name,
    })
    .from(divisions)
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .orderBy(asc(divisions.level))
  return ss.map((s) => ({
    ...s,
    divisions: ds.filter((d) => d.seasonId === s.id),
  }))
}

export async function getSeasonFixturePlanning(seasonId: number) {
  const pairingRows = await db
    .select({
      id: fixturePlanningPairings.id,
      seasonId: fixturePlanningPairings.seasonId,
      divisionId: fixturePlanningPairings.divisionId,
      round: fixturePlanningPairings.round,
      pairingOrder: fixturePlanningPairings.pairingOrder,
      week: fixturePlanningPairings.week,
      teamAId: fixturePlanningPairings.teamAId,
      teamBId: fixturePlanningPairings.teamBId,
      homeTeamId: fixturePlanningPairings.homeTeamId,
      awayTeamId: fixturePlanningPairings.awayTeamId,
      timeslot: fixturePlanningPairings.timeslot,
    })
    .from(fixturePlanningPairings)
    .where(eq(fixturePlanningPairings.seasonId, seasonId))
    .orderBy(asc(fixturePlanningPairings.divisionId), asc(fixturePlanningPairings.round), asc(fixturePlanningPairings.pairingOrder))

  const divisionRows = await db
    .select({
      id: divisions.id,
      seasonId: divisions.seasonId,
      name: divisions.name,
      level: divisions.level,
      maxTeams: divisions.maxTeams,
      regionId: divisions.regionId,
      regionName: regions.name,
    })
    .from(divisions)
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(eq(divisions.seasonId, seasonId))
    .orderBy(asc(divisions.level), asc(divisions.id))

  const teamIds = [...new Set(pairingRows.flatMap((row) => [row.teamAId, row.teamBId]))]
  const teamRows = teamIds.length
    ? await db
        .select({
          id: teams.id,
          name: teams.name,
          logoUrl: sql<string | null>`coalesce(${teams.logoUrl}, ${clubs.logoUrl}, ${organisations.logoUrl})`,
          homeClubId: teams.homeClubId,
          homeClubName: clubs.name,
          homeClubCourts: clubs.courts,
        })
        .from(teams)
        .leftJoin(clubs, eq(teams.homeClubId, clubs.id))
        .leftJoin(organisations, eq(clubs.organisationId, organisations.id))
        .where(inArray(teams.id, teamIds))
    : []
  const teamsById = new Map(teamRows.map((row) => [row.id, row]))

  return {
    divisions: divisionRows,
    pairings: pairingRows.map((row) => ({
      ...row,
      teamAName: teamsById.get(row.teamAId)?.name ?? `Team ${row.teamAId}`,
      teamBName: teamsById.get(row.teamBId)?.name ?? `Team ${row.teamBId}`,
      teamALogoUrl: teamsById.get(row.teamAId)?.logoUrl ?? null,
      teamBLogoUrl: teamsById.get(row.teamBId)?.logoUrl ?? null,
      teamAHomeClubName: teamsById.get(row.teamAId)?.homeClubName ?? null,
      teamBHomeClubName: teamsById.get(row.teamBId)?.homeClubName ?? null,
      teamAHomeClubCourts: teamsById.get(row.teamAId)?.homeClubCourts ?? null,
      teamBHomeClubCourts: teamsById.get(row.teamBId)?.homeClubCourts ?? null,
    })),
  }
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

export type FixtureCheckerEntry = {
  key: string
  fixtureId: number
  week: number
  homeTeam: string
  awayTeam: string
  venue: string | null
  matchDate: string | null
  timeslot: string | null
  category: string
  court: string | null
  time: string | null
  link: string | null
  players: Array<{
    id: string
    name: string
    side: "home" | "away"
    checked: boolean
    invitePending: boolean
  }>
}

function normalizeCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
}

function entryKey(fixtureId: number, category: string) {
  return `${fixtureId}:${normalizeCategoryKey(category)}`
}

export async function getSeasonFixtureCheckerEntries(seasonId: number): Promise<FixtureCheckerEntry[]> {
  const home = alias(teams, "home")
  const away = alias(teams, "away")
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeName: home.name,
      awayName: away.name,
      venue: sql<string | null>`coalesce(${clubs.name}, ${fixtures.venue})`,
      matchDate: fixtures.matchDate,
      timeslot: fixtures.timeslot,
      courtLinks: fixtures.courtLinks,
      courtAssignments: fixtures.courtAssignments,
    })
    .from(fixtures)
    .leftJoin(home, eq(fixtures.homeTeamId, home.id))
    .leftJoin(away, eq(fixtures.awayTeamId, away.id))
    .leftJoin(clubs, eq(fixtures.venueClubId, clubs.id))
    .where(eq(fixtures.seasonId, seasonId))
    .orderBy(asc(fixtures.week), asc(fixtures.matchDate), asc(fixtures.id))

  if (fixtureRows.length === 0) return []

  const fixtureIds = fixtureRows.map((row) => row.id)
  const matchRows = await db
    .select({
      fixtureId: matches.fixtureId,
      category: matches.category,
      homePlayerIds: sql<string[]>`${matches.homePlayerIds}`,
      awayPlayerIds: sql<string[]>`${matches.awayPlayerIds}`,
    })
    .from(matches)
    .where(inArray(matches.fixtureId, fixtureIds))

  const playerIds = new Set<number>()
  for (const matchRow of matchRows) {
    for (const id of Array.isArray(matchRow.homePlayerIds) ? matchRow.homePlayerIds : []) if (id) playerIds.add(id)
    for (const id of Array.isArray(matchRow.awayPlayerIds) ? matchRow.awayPlayerIds : []) if (id) playerIds.add(id)
  }

  const playerRows = playerIds.size
    ? await db
        .select({
          playerId: players.id,
          userId: players.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        })
        .from(players)
        .innerJoin(user, eq(players.userId, user.id))
        .where(inArray(players.id, [...playerIds]))
    : []
  const playerByMatchPlayerId = new Map(
    playerRows.map((row) => [
      row.playerId,
      {
        userId: row.userId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email,
      },
    ]),
  )

  const fixtureTeamIds = [...new Set(fixtureRows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter((id): id is number => id != null))]
  const pairingRows = fixtureTeamIds.length
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          pairIndex: teamPairings.pairIndex,
          slotIndex: teamPairings.slotIndex,
          userId: teamPairings.playerId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        })
        .from(teamPairings)
        .innerJoin(user, eq(teamPairings.playerId, user.id))
        .where(inArray(teamPairings.teamId, fixtureTeamIds))
    : []
  const inviteRows = fixtureTeamIds.length
    ? await db
        .select({
          id: teamInvites.id,
          teamId: teamInvites.teamId,
          category: teamInvites.category,
          pairIndex: teamInvites.pairIndex,
          slotIndex: teamInvites.slotIndex,
          invitedName: teamInvites.invitedName,
          email: teamInvites.email,
        })
        .from(teamInvites)
        .where(and(inArray(teamInvites.teamId, fixtureTeamIds), eq(teamInvites.status, "pending")))
    : []
  const pairingsByTeamCategory = new Map<string, Array<{ userId: string; name: string; pairIndex: number; slotIndex: number }>>()
  for (const row of pairingRows) {
    const key = `${row.teamId}:${normalizeCategoryKey(row.category)}`
    const current = pairingsByTeamCategory.get(key) ?? []
    current.push({
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email,
      pairIndex: row.pairIndex ?? 99,
      slotIndex: row.slotIndex ?? 99,
    })
    pairingsByTeamCategory.set(key, current)
  }
  const pendingInvitesByTeamCategory = new Map<
    string,
    Array<{ id: number; name: string; pairIndex: number; slotIndex: number }>
  >()
  for (const row of inviteRows) {
    if (!row.category) continue
    const key = `${row.teamId}:${normalizeCategoryKey(row.category)}`
    const current = pendingInvitesByTeamCategory.get(key) ?? []
    current.push({
      id: row.id,
      name: row.invitedName?.trim() || row.email,
      pairIndex: row.pairIndex ?? 99,
      slotIndex: row.slotIndex ?? 99,
    })
    pendingInvitesByTeamCategory.set(key, current)
  }

  const [stateRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, `fixture_checker_state:${seasonId}`))
    .limit(1)
  const rawState = stateRow?.value ?? "{}"
  let checkedByEntry: Record<string, string[]> = {}
  try {
    const parsed = JSON.parse(rawState)
    if (parsed && typeof parsed === "object") checkedByEntry = parsed as Record<string, string[]>
  } catch {
    checkedByEntry = {}
  }

  const matchesByFixture = new Map<number, typeof matchRows>()
  for (const row of matchRows) {
    const current = matchesByFixture.get(row.fixtureId) ?? []
    current.push(row)
    matchesByFixture.set(row.fixtureId, current)
  }

  const entries: FixtureCheckerEntry[] = []
  for (const fixture of fixtureRows) {
    const rawLinks = (fixture.courtLinks ?? {}) as Record<string, string>
    const rawAssignments =
      (fixture.courtAssignments ?? {}) as Record<string, { court: string | null; time: string | null }>
    const normalizedLinkMap = new Map<string, string>()
    for (const [category, link] of Object.entries(rawLinks)) {
      if (link) normalizedLinkMap.set(normalizeCategoryKey(category), link)
    }

    const categories = new Set<string>([
      ...Object.keys(rawLinks),
      ...Object.keys(rawAssignments),
      ...(matchesByFixture.get(fixture.id) ?? []).map((row) => row.category).filter(Boolean),
    ])

    for (const category of categories) {
      const link = rawLinks[category] ?? normalizedLinkMap.get(normalizeCategoryKey(category)) ?? null
      const match = (matchesByFixture.get(fixture.id) ?? []).find(
        (row) => normalizeCategoryKey(row.category) === normalizeCategoryKey(category),
      )
      const homeIds = Array.isArray(match?.homePlayerIds) ? match?.homePlayerIds : []
      const awayIds = Array.isArray(match?.awayPlayerIds) ? match?.awayPlayerIds : []
      const key = entryKey(fixture.id, category)
      const checked = new Set(checkedByEntry[key] ?? [])
      const homeFromMatch = homeIds
        .map((id) => playerByMatchPlayerId.get(id))
        .filter((row): row is { userId: string; name: string } => !!row)
      const awayFromMatch = awayIds
        .map((id) => playerByMatchPlayerId.get(id))
        .filter((row): row is { userId: string; name: string } => !!row)

      const pairingHome =
        fixture.homeTeamId != null
          ? (pairingsByTeamCategory.get(`${fixture.homeTeamId}:${normalizeCategoryKey(category)}`) ?? [])
              .sort((a, b) => a.pairIndex - b.pairIndex || a.slotIndex - b.slotIndex)
              .slice(0, 2)
              .map((row) => ({ userId: row.userId, name: row.name }))
          : []
      const pairingAway =
        fixture.awayTeamId != null
          ? (pairingsByTeamCategory.get(`${fixture.awayTeamId}:${normalizeCategoryKey(category)}`) ?? [])
              .sort((a, b) => a.pairIndex - b.pairIndex || a.slotIndex - b.slotIndex)
              .slice(0, 2)
              .map((row) => ({ userId: row.userId, name: row.name }))
          : []
      const pendingHome =
        fixture.homeTeamId != null
          ? (pendingInvitesByTeamCategory.get(`${fixture.homeTeamId}:${normalizeCategoryKey(category)}`) ?? [])
              .sort((a, b) => a.pairIndex - b.pairIndex || a.slotIndex - b.slotIndex)
              .map((row) => ({ id: `invite:${row.id}`, name: row.name }))
          : []
      const pendingAway =
        fixture.awayTeamId != null
          ? (pendingInvitesByTeamCategory.get(`${fixture.awayTeamId}:${normalizeCategoryKey(category)}`) ?? [])
              .sort((a, b) => a.pairIndex - b.pairIndex || a.slotIndex - b.slotIndex)
              .map((row) => ({ id: `invite:${row.id}`, name: row.name }))
          : []

      const resolvedHome = homeFromMatch.length ? homeFromMatch : pairingHome
      const resolvedAway = awayFromMatch.length ? awayFromMatch : pairingAway

      const players = [
        ...resolvedHome.map((row) => ({
          id: row.userId,
          name: row.name,
          side: "home" as const,
          checked: checked.has(row.userId),
          invitePending: false,
        })),
        ...pendingHome.map((row) => ({
          id: row.id,
          name: row.name,
          side: "home" as const,
          checked: checked.has(row.id),
          invitePending: true,
        })),
        ...resolvedAway.map((row) => ({
          id: row.userId,
          name: row.name,
          side: "away" as const,
          checked: checked.has(row.userId),
          invitePending: false,
        })),
        ...pendingAway.map((row) => ({
          id: row.id,
          name: row.name,
          side: "away" as const,
          checked: checked.has(row.id),
          invitePending: true,
        })),
      ]

      entries.push({
        key,
        fixtureId: fixture.id,
        week: fixture.week,
        homeTeam: fixture.homeName ?? "TBD",
        awayTeam: fixture.awayName ?? "TBD",
        venue: fixture.venue ?? null,
        matchDate: fixture.matchDate ? new Date(fixture.matchDate).toISOString() : null,
        timeslot: fixture.timeslot ?? null,
        category,
        court: rawAssignments[category]?.court ?? null,
        time: rawAssignments[category]?.time ?? null,
        link,
        players,
      })
    }
  }

  return entries
}

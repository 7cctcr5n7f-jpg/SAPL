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
  teamPairings,
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
  const teamRows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      divisionId: teams.divisionId,
      conference: sql<string | null>`coalesce(${regions.name}, ${teams.saplRegion})`,
      divisionName: divisions.name,
      divisionLevel: divisions.level,
    })
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(and(eq(teams.seasonId, season.id), inArray(teams.status, [...TEAM_VISIBLE_STATUSES])))

  const fixtureRows = await db
    .select({
      fixtureId: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
      homeSetsWon: fixtures.homeSetsWon,
      awaySetsWon: fixtures.awaySetsWon,
    })
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.status, "completed")))

  const fixtureIds = fixtureRows.map((row) => row.fixtureId)
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
  const fixtureTeamMap = new Map<number, { homeTeamId: number | null; awayTeamId: number | null }>()
  for (const row of fixtureRows) {
    rubbersByFixture.set(row.fixtureId, { homeMatchesWon: 0, awayMatchesWon: 0, homeGames: 0, awayGames: 0 })
    fixtureTeamMap.set(row.fixtureId, { homeTeamId: row.homeTeamId, awayTeamId: row.awayTeamId })
  }
  for (const match of matchRows) {
    const fixtureTeams = fixtureTeamMap.get(match.fixtureId)
    const agg = rubbersByFixture.get(match.fixtureId)
    if (!fixtureTeams || !agg) continue
    if (fixtureTeams.homeTeamId != null && match.winnerTeamId === fixtureTeams.homeTeamId) agg.homeMatchesWon += 1
    if (fixtureTeams.awayTeamId != null && match.winnerTeamId === fixtureTeams.awayTeamId) agg.awayMatchesWon += 1
    const tally = tallySets(parseScoreDetail(match.scoreDetail))
    agg.homeGames += tally.homeGames
    agg.awayGames += tally.awayGames
  }

  type TeamStats = {
    teamId: number
    teamName: string
    conference: string | null
    divisionName: string | null
    divisionLevel: number | null
    points: number
    matchesWon: number
    setsWon: number
    pointsDiff: number
  }
  const statsByTeam = new Map<number, TeamStats>()
  for (const row of teamRows) {
    statsByTeam.set(row.teamId, {
      teamId: row.teamId,
      teamName: row.teamName,
      conference: row.conference,
      divisionName: row.divisionName,
      divisionLevel: row.divisionLevel,
      points: 0,
      matchesWon: 0,
      setsWon: 0,
      pointsDiff: 0,
    })
  }

  for (const row of fixtureRows) {
    if (row.homeTeamId == null || row.awayTeamId == null) continue
    const home = statsByTeam.get(row.homeTeamId)
    const away = statsByTeam.get(row.awayTeamId)
    if (!home || !away) continue
    const rubber = rubbersByFixture.get(row.fixtureId)
    const homeGames = rubber?.homeGames ?? 0
    const awayGames = rubber?.awayGames ?? 0
    home.points += row.homePoints ?? 0
    away.points += row.awayPoints ?? 0
    home.matchesWon += rubber?.homeMatchesWon ?? 0
    away.matchesWon += rubber?.awayMatchesWon ?? 0
    home.setsWon += row.homeSetsWon ?? 0
    away.setsWon += row.awaySetsWon ?? 0
    home.pointsDiff += homeGames - awayGames
    away.pointsDiff += awayGames - homeGames
  }

  const compare = (a: TeamStats, b: TeamStats) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
    return a.teamName.localeCompare(b.teamName)
  }

  const byConference = new Map<string, TeamStats[]>()
  for (const row of statsByTeam.values()) {
    const key = (row.conference ?? "Unassigned").trim() || "Unassigned"
    const list = byConference.get(key) ?? []
    list.push(row)
    byConference.set(key, list)
  }
  for (const list of byConference.values()) list.sort(compare)

  const selected = new Map<number, TeamStats & { qualifierType: "auto" | "wildcard" }>()
  const conferenceThirds: TeamStats[] = []
  for (const list of byConference.values()) {
    if (list[0]) selected.set(list[0].teamId, { ...list[0], qualifierType: "auto" })
    if (list[1]) selected.set(list[1].teamId, { ...list[1], qualifierType: "auto" })
    if (list[2]) conferenceThirds.push(list[2])
  }

  conferenceThirds.sort(compare)
  for (const row of conferenceThirds.slice(0, 2)) {
    if (!selected.has(row.teamId)) selected.set(row.teamId, { ...row, qualifierType: "wildcard" })
  }

  // Fallback: if fewer than 8 teams selected (small datasets), fill with best remaining.
  if (selected.size < 8) {
    const remaining = [...statsByTeam.values()].filter((row) => !selected.has(row.teamId)).sort(compare)
    for (const row of remaining) {
      selected.set(row.teamId, { ...row, qualifierType: "wildcard" })
      if (selected.size >= 8) break
    }
  }

  return [...selected.values()].sort(compare).slice(0, Math.min(8, limit))
}

export async function getDonutFactoryLeaders(limit = 10) {
  const season = await getCurrentSeason()
  if (!season) return []

  const rows = await db
    .select({
      fixtureId: matches.fixtureId,
      category: matches.category,
      homePlayerIds: matches.homePlayerIds,
      awayPlayerIds: matches.awayPlayerIds,
      scoreDetail: matches.scoreDetail,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(matches)
    .innerJoin(fixtures, eq(matches.fixtureId, fixtures.id))
    .where(and(eq(fixtures.seasonId, season.id), eq(fixtures.status, "completed")))

  function extractPlayerIds(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
      .filter((item): item is string => item.length > 0)
  }

  const pairDonutCounts = new Map<string, { teamId: number; playerIds: string[]; category: string; donuts: number }>()
  const allPlayerIds = new Set<string>()
  const fixtureTeamIds = new Set<number>()
  const teamIdsInWinners = new Set<number>()
  for (const row of rows) {
    if (row.homeTeamId != null) fixtureTeamIds.add(row.homeTeamId)
    if (row.awayTeamId != null) fixtureTeamIds.add(row.awayTeamId)
    const homeIds = extractPlayerIds(row.homePlayerIds)
    const awayIds = extractPlayerIds(row.awayPlayerIds)
    homeIds.forEach((id) => allPlayerIds.add(id))
    awayIds.forEach((id) => allPlayerIds.add(id))
    const sets = parseScoreDetail(row.scoreDetail)
    for (const set of sets) {
      if (set.home === 6 && set.away === 0 && homeIds.length > 0 && row.homeTeamId != null) {
        const ids = [...homeIds].sort()
        ids.forEach((id) => allPlayerIds.add(id))
        teamIdsInWinners.add(row.homeTeamId)
        const key = `${row.homeTeamId}:${row.category.toLowerCase().trim()}:${ids.join(",")}`
        const current = pairDonutCounts.get(key)
        pairDonutCounts.set(key, {
          teamId: row.homeTeamId,
          playerIds: ids,
          category: row.category,
          donuts: (current?.donuts ?? 0) + 1,
        })
      } else if (set.away === 6 && set.home === 0 && awayIds.length > 0 && row.awayTeamId != null) {
        const ids = [...awayIds].sort()
        ids.forEach((id) => allPlayerIds.add(id))
        teamIdsInWinners.add(row.awayTeamId)
        const key = `${row.awayTeamId}:${row.category.toLowerCase().trim()}:${ids.join(",")}`
        const current = pairDonutCounts.get(key)
        pairDonutCounts.set(key, {
          teamId: row.awayTeamId,
          playerIds: ids,
          category: row.category,
          donuts: (current?.donuts ?? 0) + 1,
        })
      }
    }
  }

  // Fallback for historical fixtures where match player IDs were not saved:
  // infer the matchup players from team pairings (pairIndex 1) per category.
  const pairingRows = fixtureTeamIds.size
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          pairIndex: teamPairings.pairIndex,
          slotIndex: teamPairings.slotIndex,
          playerId: teamPairings.playerId,
        })
        .from(teamPairings)
        .where(and(inArray(teamPairings.teamId, [...fixtureTeamIds]), eq(teamPairings.pairIndex, 1)))
    : []
  const pairingByTeamCategory = new Map<string, string[]>()
  const normalizeCategory = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
  for (const row of pairingRows) {
    if (!row.playerId) continue
    const key = `${row.teamId}:${normalizeCategory(row.category)}`
    const current = pairingByTeamCategory.get(key) ?? []
    current.push(String(row.playerId))
    pairingByTeamCategory.set(key, current)
    allPlayerIds.add(String(row.playerId))
  }

  if (pairingByTeamCategory.size > 0) {
    for (const row of rows) {
      const parsed = parseScoreDetail(row.scoreDetail)
      if (!parsed.length || row.homeTeamId == null || row.awayTeamId == null) continue
      const homeIds = extractPlayerIds(row.homePlayerIds)
      const awayIds = extractPlayerIds(row.awayPlayerIds)
      const key = normalizeCategory(row.category)
      const homeFallbackIds = homeIds.length === 0 ? (pairingByTeamCategory.get(`${row.homeTeamId}:${key}`) ?? []) : []
      const awayFallbackIds = awayIds.length === 0 ? (pairingByTeamCategory.get(`${row.awayTeamId}:${key}`) ?? []) : []

      for (const set of parsed) {
        if (set.home === 6 && set.away === 0 && homeFallbackIds.length > 0) {
          for (const playerId of homeFallbackIds) {
            allPlayerIds.add(playerId)
          }
          teamIdsInWinners.add(row.homeTeamId)
          const ids = [...homeFallbackIds].sort()
          const key = `${row.homeTeamId}:${row.category.toLowerCase().trim()}:${ids.join(",")}`
          const current = pairDonutCounts.get(key)
          pairDonutCounts.set(key, {
            teamId: row.homeTeamId,
            playerIds: ids,
            category: row.category,
            donuts: (current?.donuts ?? 0) + 1,
          })
        } else if (set.away === 6 && set.home === 0 && awayFallbackIds.length > 0) {
          for (const playerId of awayFallbackIds) allPlayerIds.add(playerId)
          teamIdsInWinners.add(row.awayTeamId)
          const ids = [...awayFallbackIds].sort()
          const key = `${row.awayTeamId}:${row.category.toLowerCase().trim()}:${ids.join(",")}`
          const current = pairDonutCounts.get(key)
          pairDonutCounts.set(key, {
            teamId: row.awayTeamId,
            playerIds: ids,
            category: row.category,
            donuts: (current?.donuts ?? 0) + 1,
          })
        }
      }
    }
  }

  if (pairDonutCounts.size === 0) return []
  const players = allPlayerIds.size
    ? await db
        .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
        .from(user)
        .where(inArray(user.id, [...allPlayerIds]))
    : []
  const nameById = new Map<string, string>()
  for (const row of players) {
    const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
    if (full) nameById.set(String(row.id), full)
  }

  const teamsById = teamIdsInWinners.size
    ? await db
        .select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl })
        .from(teams)
        .where(inArray(teams.id, [...teamIdsInWinners]))
    : []
  const teamMetaById = new Map<number, { name: string; logoUrl: string | null }>()
  for (const row of teamsById) teamMetaById.set(row.id, { name: row.name, logoUrl: row.logoUrl })

  return [...pairDonutCounts.values()]
    .map((row) => {
      const pairLabel = row.playerIds.map((id) => nameById.get(id) ?? "Unknown").join(" / ")
      return {
        teamId: row.teamId,
        teamName: teamMetaById.get(row.teamId)?.name ?? `Team ${row.teamId}`,
        teamLogoUrl: teamMetaById.get(row.teamId)?.logoUrl ?? null,
        pairLabel,
        category: row.category,
        donuts: row.donuts,
      }
    })
    .sort((a, b) => {
      if (b.donuts !== a.donuts) return b.donuts - a.donuts
      return a.pairLabel.localeCompare(b.pairLabel)
    })
    .slice(0, limit)
}

export async function getFixtureCategoryMatchups(fixtureId: number) {
  function extractPlayerIds(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
      .filter((item): item is string => item.length > 0)
  }

  const [fixture] = await db
    .select({ homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fixture || fixture.homeTeamId == null || fixture.awayTeamId == null) return []

  const rows = await db
    .select({
      id: matches.id,
      category: matches.category,
      session: matches.session,
      homePlayerIds: matches.homePlayerIds,
      awayPlayerIds: matches.awayPlayerIds,
    })
    .from(matches)
    .where(eq(matches.fixtureId, fixtureId))
    .orderBy(asc(matches.session), asc(matches.id))

  const playerIds = new Set<string>()
  for (const row of rows) {
    extractPlayerIds(row.homePlayerIds).forEach((id) => playerIds.add(id))
    extractPlayerIds(row.awayPlayerIds).forEach((id) => playerIds.add(id))
  }

  const plannedRows = await db
    .select({
      teamId: teamPairings.teamId,
      category: teamPairings.category,
      pairIndex: teamPairings.pairIndex,
      slotIndex: teamPairings.slotIndex,
      playerId: teamPairings.playerId,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    .from(teamPairings)
    .leftJoin(user, eq(teamPairings.playerId, user.id))
    .where(and(inArray(teamPairings.teamId, [fixture.homeTeamId, fixture.awayTeamId]), eq(teamPairings.pairIndex, 1)))
    .orderBy(asc(teamPairings.teamId), asc(teamPairings.category), asc(teamPairings.slotIndex))

  const playerRows = playerIds.size
    ? await db
        .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
        .from(user)
        .where(inArray(user.id, [...playerIds]))
    : []
  const nameById = new Map<string, string>()
  for (const row of playerRows) {
    const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
    if (full) nameById.set(String(row.id), full)
  }

  function normalizeCategory(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
  }

  const plannedByTeamCategory = new Map<string, string[]>()
  for (const row of plannedRows) {
    const key = `${row.teamId}:${normalizeCategory(row.category)}`
    const current = plannedByTeamCategory.get(key) ?? []
    const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
    if (name) current.push(name)
    plannedByTeamCategory.set(key, current)
  }

  const orderedCategories = await db
    .select({ name: categories.name, sortOrder: categories.sortOrder })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))

  const knownCategoryNames = new Map<string, string>()
  for (const row of orderedCategories) knownCategoryNames.set(normalizeCategory(row.name), row.name)
  for (const row of rows) {
    const key = normalizeCategory(row.category)
    if (!knownCategoryNames.has(key)) knownCategoryNames.set(key, row.category)
  }

  const orderedKeys = [
    ...orderedCategories.map((row) => normalizeCategory(row.name)),
    ...[...knownCategoryNames.keys()].filter((key) => !orderedCategories.some((row) => normalizeCategory(row.name) === key)),
  ]

  const matchByCategory = new Map<string, { homePair: string[]; awayPair: string[] }>()
  for (const row of rows) {
    const key = normalizeCategory(row.category)
    const homePair = extractPlayerIds(row.homePlayerIds).map((id) => nameById.get(id)).filter((name): name is string => Boolean(name))
    const awayPair = extractPlayerIds(row.awayPlayerIds).map((id) => nameById.get(id)).filter((name): name is string => Boolean(name))
    if (!matchByCategory.has(key)) matchByCategory.set(key, { homePair, awayPair })
  }

  return orderedKeys.map((key) => {
    const fromMatch = matchByCategory.get(key)
    const plannedHome = plannedByTeamCategory.get(`${fixture.homeTeamId}:${key}`) ?? []
    const plannedAway = plannedByTeamCategory.get(`${fixture.awayTeamId}:${key}`) ?? []
    const homePair = fromMatch?.homePair?.length ? fromMatch.homePair : plannedHome
    const awayPair = fromMatch?.awayPair?.length ? fromMatch.awayPair : plannedAway
    return {
      category: knownCategoryNames.get(key) ?? key,
      homePair: homePair.join(" & "),
      awayPair: awayPair.join(" & "),
    }
  }).filter((row) => row.homePair || row.awayPair)
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

import { db } from "@/lib/db"
import {
  fixtures,
  matches,
  standings,
  teams,
  tprHistory,
  divisions,
} from "@/lib/db/schema"
import { eq, and, inArray, asc } from "drizzle-orm"
import { scoreFixture, tallySets, formatScoreDetail, parseScoreDetail, type MatchResult, type SetScore } from "@/lib/engine/scoring"
import { calculateTpr } from "@/lib/engine/tpr"
import { syncTeamLifecycleStatus } from "@/lib/engine/team-stats"

export type CategoryScoreInput = {
  category: string
  session: number
  isFeatureCourt: boolean
  /** Actual set scores entered by the captain, e.g. [{home:6,away:4},...]. */
  sets: SetScore[]
  homePlayerIds?: number[]
  awayPlayerIds?: number[]
}

/**
 * Apply an approved fixture result end-to-end:
 *  - writes individual match rows
 *  - computes league points (1/set + winner bonus)
 *  - updates the fixture row + status
 *  - updates both teams' standings (with rank recompute for the division)
 *  - updates both teams' TPR and writes TPR history snapshots
 *
 * Idempotency: rewrites fixture matches from a merged view of existing + edited
 * categories so updating one pairing never drops other recorded pairings.
 */
export async function applyFixtureResult(fixtureId: number, categoryScores: CategoryScoreInput[]) {
  const [fixtureRow] = await db
    .select({
      id: fixtures.id,
      seasonId: fixtures.seasonId,
      divisionId: fixtures.divisionId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1)
  if (!fixtureRow) throw new Error("Fixture not found")
  if (fixtureRow.homeTeamId == null || fixtureRow.awayTeamId == null) {
    throw new Error("Cannot record a result before both teams are assigned")
  }
  // Both teams are guaranteed present from here on.
  const fixture = { ...fixtureRow, homeTeamId: fixtureRow.homeTeamId, awayTeamId: fixtureRow.awayTeamId }

  const [division] = fixture.divisionId
    ? await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.id, fixture.divisionId)).limit(1)
    : [null]

  const existingMatchRows = await db
    .select({
      category: matches.category,
      session: matches.session,
      isFeatureCourt: matches.isFeatureCourt,
      homeSetsWon: matches.homeSetsWon,
      awaySetsWon: matches.awaySetsWon,
      homeGames: matches.homeGames,
      awayGames: matches.awayGames,
      scoreDetail: matches.scoreDetail,
      winnerTeamId: matches.winnerTeamId,
      homePlayerIds: matches.homePlayerIds,
      awayPlayerIds: matches.awayPlayerIds,
    })
    .from(matches)
    .where(eq(matches.fixtureId, fixtureId))

  const editsByCategory = new Map(categoryScores.map((categoryScore) => [categoryScore.category, categoryScore]))

  const mergedRows: Array<{
    category: string
    session: number
    isFeatureCourt: boolean
    homeSetsWon: number
    awaySetsWon: number
    splitSets: number
    homeGames: number
    awayGames: number
    scoreDetail: string | null
    winnerTeamId: number | null
    homePlayerIds: number[] | null
    awayPlayerIds: number[] | null
  }> = []

  for (const row of existingMatchRows) {
    const edited = editsByCategory.get(row.category)
    if (edited) {
      const tally = tallySets(edited.sets)
      const winnerTeamId =
        tally.homeSetsWon > tally.awaySetsWon
          ? fixture.homeTeamId
          : tally.awaySetsWon > tally.homeSetsWon
            ? fixture.awayTeamId
            : null
      mergedRows.push({
        category: edited.category,
        session: edited.session,
        isFeatureCourt: edited.isFeatureCourt,
        homeSetsWon: tally.homeSetsWon,
        awaySetsWon: tally.awaySetsWon,
        splitSets: tally.splitSets,
        homeGames: tally.homeGames,
        awayGames: tally.awayGames,
        scoreDetail: formatScoreDetail(edited.sets) || null,
        winnerTeamId,
        homePlayerIds: edited.homePlayerIds ?? (row.homePlayerIds as number[] | null),
        awayPlayerIds: edited.awayPlayerIds ?? (row.awayPlayerIds as number[] | null),
      })
      editsByCategory.delete(row.category)
      continue
    }

    const parsedSets = parseScoreDetail(row.scoreDetail)
    const parsedTally = parsedSets.length > 0 ? tallySets(parsedSets) : null
    mergedRows.push({
      category: row.category,
      session: row.session,
      isFeatureCourt: row.isFeatureCourt,
      homeSetsWon: row.homeSetsWon,
      awaySetsWon: row.awaySetsWon,
      splitSets: parsedTally?.splitSets ?? 0,
      homeGames: row.homeGames,
      awayGames: row.awayGames,
      scoreDetail: row.scoreDetail,
      winnerTeamId: row.winnerTeamId,
      homePlayerIds: (row.homePlayerIds as number[] | null) ?? null,
      awayPlayerIds: (row.awayPlayerIds as number[] | null) ?? null,
    })
  }

  // New category result that wasn't in existing rows yet.
  for (const edited of editsByCategory.values()) {
    const tally = tallySets(edited.sets)
    const winnerTeamId =
      tally.homeSetsWon > tally.awaySetsWon
        ? fixture.homeTeamId
        : tally.awaySetsWon > tally.homeSetsWon
          ? fixture.awayTeamId
          : null
    mergedRows.push({
      category: edited.category,
      session: edited.session,
      isFeatureCourt: edited.isFeatureCourt,
      homeSetsWon: tally.homeSetsWon,
      awaySetsWon: tally.awaySetsWon,
      splitSets: tally.splitSets,
      homeGames: tally.homeGames,
      awayGames: tally.awayGames,
      scoreDetail: formatScoreDetail(edited.sets) || null,
      winnerTeamId,
      homePlayerIds: edited.homePlayerIds ?? null,
      awayPlayerIds: edited.awayPlayerIds ?? null,
    })
  }

  // 1. Score fixture from full merged category set (existing + this edit).
  const score = scoreFixture(
    mergedRows.map((row): MatchResult => ({
      category: row.category,
      homeSetsWon: row.homeSetsWon,
      awaySetsWon: row.awaySetsWon,
      splitSets: row.splitSets,
      homeGames: row.homeGames,
      awayGames: row.awayGames,
    })),
  )
  const winnerTeamId =
    score.winnerSide === "home" ? fixture.homeTeamId : score.winnerSide === "away" ? fixture.awayTeamId : null

  // 2. Persist merged matches (reset + reinsert full merged set).
  await db.delete(matches).where(eq(matches.fixtureId, fixtureId))
  for (const row of mergedRows) {
    await db.insert(matches).values({
      fixtureId,
      category: row.category,
      session: row.session,
      isFeatureCourt: row.isFeatureCourt,
      homeSetsWon: row.homeSetsWon,
      awaySetsWon: row.awaySetsWon,
      homeGames: row.homeGames,
      awayGames: row.awayGames,
      scoreDetail: row.scoreDetail,
      winnerTeamId: row.winnerTeamId,
      homePlayerIds: row.homePlayerIds,
      awayPlayerIds: row.awayPlayerIds,
    })
  }

  // 3. Update fixture
  await db
    .update(fixtures)
    .set({
      status: "completed",
      homePoints: score.homePoints,
      awayPoints: score.awayPoints,
      homeSetsWon: score.homeSetsWon,
      awaySetsWon: score.awaySetsWon,
      winnerTeamId,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, fixtureId))

  // 4. Update standings for both teams (best-effort; fixture save is canonical)
  try {
    await bumpStanding({
      seasonId: fixture.seasonId,
      divisionId: fixture.divisionId,
      teamId: fixture.homeTeamId,
      points: score.homePoints,
      setsWon: score.homeSetsWon,
      setsLost: score.awaySetsWon,
      gamesFor: score.homeGames,
      gamesAgainst: score.awayGames,
      won: score.winnerSide === "home",
      lost: score.winnerSide === "away",
    })
    await bumpStanding({
      seasonId: fixture.seasonId,
      divisionId: fixture.divisionId,
      teamId: fixture.awayTeamId,
      points: score.awayPoints,
      setsWon: score.awaySetsWon,
      setsLost: score.homeSetsWon,
      gamesFor: score.awayGames,
      gamesAgainst: score.homeGames,
      won: score.winnerSide === "away",
      lost: score.winnerSide === "home",
    })
    await recomputeRanks(fixture.divisionId)
  } catch (error) {
    console.error("Failed to update standings after fixture result save", {
      fixtureId,
      divisionId: fixture.divisionId,
      error,
    })
  }

  // 5. TPR update (best-effort; do not fail the score save path)
  try {
    const [homeTeam] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, fixture.homeTeamId)).limit(1)
    const [awayTeam] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, fixture.awayTeamId)).limit(1)
    if (homeTeam && awayTeam) {
      const tpr = calculateTpr({
        homeTpr: homeTeam.tpr,
        awayTpr: awayTeam.tpr,
        homeSetsWon: score.homeSetsWon,
        awaySetsWon: score.awaySetsWon,
        divisionLevel: division?.level ?? 4,
      })
      await db
        .update(teams)
        .set({ tpr: tpr.homeTpr, highestTpr: Math.max(homeTeam.highestTpr, tpr.homeTpr), updatedAt: new Date() })
        .where(eq(teams.id, homeTeam.id))
      await db
        .update(teams)
        .set({ tpr: tpr.awayTpr, highestTpr: Math.max(awayTeam.highestTpr, tpr.awayTpr), updatedAt: new Date() })
        .where(eq(teams.id, awayTeam.id))

      await db.insert(tprHistory).values([
        {
          teamId: homeTeam.id,
          tpr: tpr.homeTpr,
          change: tpr.homeChange,
          reason: `vs ${awayTeam.name}`,
          fixtureId,
          seasonId: fixture.seasonId,
        },
        {
          teamId: awayTeam.id,
          tpr: tpr.awayTpr,
          change: tpr.awayChange,
          reason: `vs ${homeTeam.name}`,
          fixtureId,
          seasonId: fixture.seasonId,
        },
      ])
    }
  } catch (error) {
    console.error("Failed to update TPR after fixture result save", { fixtureId, error })
  }

  try {
    await syncTeamLifecycleStatus(fixture.homeTeamId)
    await syncTeamLifecycleStatus(fixture.awayTeamId)
  } catch (error) {
    console.error("Failed to sync team lifecycle status after result save", {
      fixtureId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      error,
    })
  }

  return { score, winnerTeamId }
}

export async function rebuildDivisionStandings(divisionId: number, seasonId: number) {
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      divisionId: fixtures.divisionId,
      seasonId: fixtures.seasonId,
    })
    .from(fixtures)
    .where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.seasonId, seasonId), eq(fixtures.status, "completed")))
    .orderBy(asc(fixtures.week), asc(fixtures.id))

  const teamIds = Array.from(
    new Set(fixtureRows.flatMap((row) => [row.homeTeamId, row.awayTeamId].filter((id): id is number => id != null))),
  )

  await db.delete(standings).where(and(eq(standings.divisionId, divisionId), eq(standings.seasonId, seasonId)))
  if (teamIds.length === 0) return

  for (const row of fixtureRows) {
    const categoryRows = await db
      .select({
        category: matches.category,
        homeSetsWon: matches.homeSetsWon,
        awaySetsWon: matches.awaySetsWon,
        scoreDetail: matches.scoreDetail,
        homeGames: matches.homeGames,
        awayGames: matches.awayGames,
      })
      .from(matches)
      .where(eq(matches.fixtureId, row.id))

    if (row.homeTeamId == null || row.awayTeamId == null || categoryRows.length === 0) continue
    const score = scoreFixture(
      categoryRows.map((row) => {
        const parsed = parseScoreDetail(row.scoreDetail)
        const tally = parsed.length > 0 ? tallySets(parsed) : null
        return {
          category: row.category,
          homeSetsWon: row.homeSetsWon,
          awaySetsWon: row.awaySetsWon,
          splitSets: tally?.splitSets ?? 0,
          homeGames: row.homeGames,
          awayGames: row.awayGames,
        }
      }),
    )
    await bumpStanding({
      seasonId,
      divisionId,
      teamId: row.homeTeamId,
      points: score.homePoints,
      setsWon: score.homeSetsWon,
      setsLost: score.awaySetsWon,
      gamesFor: score.homeGames,
      gamesAgainst: score.awayGames,
      won: score.winnerSide === "home",
      lost: score.winnerSide === "away",
    })
    await bumpStanding({
      seasonId,
      divisionId,
      teamId: row.awayTeamId,
      points: score.awayPoints,
      setsWon: score.awaySetsWon,
      setsLost: score.homeSetsWon,
      gamesFor: score.awayGames,
      gamesAgainst: score.homeGames,
      won: score.winnerSide === "away",
      lost: score.winnerSide === "home",
    })
  }

  await recomputeRanks(divisionId)
}

async function bumpStanding(args: {
  seasonId: number
  divisionId: number
  teamId: number
  points: number
  setsWon: number
  setsLost: number
  gamesFor: number
  gamesAgainst: number
  won: boolean
  lost: boolean
}) {
  const [existing] = await db
    .select()
    .from(standings)
    .where(and(eq(standings.teamId, args.teamId), eq(standings.seasonId, args.seasonId)))
    .limit(1)

  if (!existing) {
    await db.insert(standings).values({
      seasonId: args.seasonId,
      divisionId: args.divisionId,
      teamId: args.teamId,
      played: 1,
      wins: args.won ? 1 : 0,
      losses: args.lost ? 1 : 0,
      setsWon: args.setsWon,
      setsLost: args.setsLost,
      gamesFor: args.gamesFor,
      gamesAgainst: args.gamesAgainst,
      points: args.points,
      pointsDiff: args.gamesFor - args.gamesAgainst,
    })
    return
  }

  const gamesFor = existing.gamesFor + args.gamesFor
  const gamesAgainst = existing.gamesAgainst + args.gamesAgainst
  await db
    .update(standings)
    .set({
      played: existing.played + 1,
      wins: existing.wins + (args.won ? 1 : 0),
      losses: existing.losses + (args.lost ? 1 : 0),
      setsWon: existing.setsWon + args.setsWon,
      setsLost: existing.setsLost + args.setsLost,
      gamesFor,
      gamesAgainst,
      points: existing.points + args.points,
      pointsDiff: gamesFor - gamesAgainst,
      updatedAt: new Date(),
    })
    .where(eq(standings.id, existing.id))
}

async function recomputeRanks(divisionId: number) {
  const rows = await db
    .select({
      id: standings.id,
      points: standings.points,
      pointsDiff: standings.pointsDiff,
      wins: standings.wins,
      setsWon: standings.setsWon,
      teamId: standings.teamId,
    })
    .from(standings)
    .where(eq(standings.divisionId, divisionId))
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    return a.teamId - b.teamId
  })
  for (let i = 0; i < sorted.length; i++) {
    await db.update(standings).set({ rank: i + 1 }).where(eq(standings.id, sorted[i].id))
  }
}

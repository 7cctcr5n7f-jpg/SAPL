import { db } from "@/lib/db"
import {
  fixtures,
  matches,
  standings,
  teams,
  tprHistory,
  divisions,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { scoreFixture, tallySets, formatScoreDetail, type MatchResult, type SetScore } from "@/lib/engine/scoring"
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
 * Idempotency: deletes any pre-existing matches for the fixture first.
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

  // 1. Score the fixture. Derive sets won + games from the entered set scores.
  const tallied = categoryScores.map((c) => ({ input: c, tally: tallySets(c.sets) }))
  const matchResults: MatchResult[] = tallied.map(({ input, tally }) => ({
    category: input.category,
    homeSetsWon: tally.homeSetsWon,
    awaySetsWon: tally.awaySetsWon,
    homeGames: tally.homeGames,
    awayGames: tally.awayGames,
  }))
  const score = scoreFixture(matchResults)
  const winnerTeamId =
    score.winnerSide === "home" ? fixture.homeTeamId : score.winnerSide === "away" ? fixture.awayTeamId : null

  // 2. Persist matches (reset first for idempotency)
  await db.delete(matches).where(eq(matches.fixtureId, fixtureId))
  for (const { input: c, tally } of tallied) {
    const mWinner =
      tally.homeSetsWon > tally.awaySetsWon
        ? fixture.homeTeamId
        : tally.awaySetsWon > tally.homeSetsWon
          ? fixture.awayTeamId
          : null
    await db.insert(matches).values({
      fixtureId,
      category: c.category,
      session: c.session,
      isFeatureCourt: c.isFeatureCourt,
      homeSetsWon: tally.homeSetsWon,
      awaySetsWon: tally.awaySetsWon,
      homeGames: tally.homeGames,
      awayGames: tally.awayGames,
      scoreDetail: formatScoreDetail(c.sets) || null,
      winnerTeamId: mWinner,
      homePlayerIds: c.homePlayerIds ?? null,
      awayPlayerIds: c.awayPlayerIds ?? null,
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

  // 4. Update standings for both teams
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

  // 5. TPR update
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

  await syncTeamLifecycleStatus(fixture.homeTeamId)
  await syncTeamLifecycleStatus(fixture.awayTeamId)

  return { score, winnerTeamId }
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
  const rows = await db.select({ id: standings.id }).from(standings).where(eq(standings.divisionId, divisionId))
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    return b.pointsDiff - a.pointsDiff
  })
  for (let i = 0; i < sorted.length; i++) {
    await db.update(standings).set({ rank: i + 1 }).where(eq(standings.id, sorted[i].id))
  }
}

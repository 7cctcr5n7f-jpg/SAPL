// One-off backfill: recompute stored fixture-level scoring fields
// (homePoints, awayPoints, homeSetsWon, awaySetsWon, winnerTeamId) for every
// completed fixture using the corrected scoreFixture logic (points-based
// win/draw/loss + split-category scoring). Existing fixtures were persisted
// under older scoring rules and never get recomputed on read, so this keeps
// stored data in sync with the current engine.
import { db } from "@/lib/db"
import { fixtures, matches } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { scoreFixture, tallySets, parseScoreDetail } from "@/lib/engine/scoring"
import { rebuildDivisionStandings } from "@/lib/engine/apply-result"

async function main() {
  const fixtureRows = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      divisionId: fixtures.divisionId,
      seasonId: fixtures.seasonId,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
      winnerTeamId: fixtures.winnerTeamId,
    })
    .from(fixtures)
    .where(eq(fixtures.status, "completed"))

  console.log(`Found ${fixtureRows.length} completed fixtures`)
  let updated = 0
  const divisionSeasonPairs = new Set<string>()

  for (const row of fixtureRows) {
    if (row.homeTeamId == null || row.awayTeamId == null) continue
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

    if (categoryRows.length === 0) continue

    const score = scoreFixture(
      categoryRows.map((r) => {
        const parsed = parseScoreDetail(r.scoreDetail)
        const tally = parsed.length > 0 ? tallySets(parsed) : null
        return {
          category: r.category,
          homeSetsWon: r.homeSetsWon,
          awaySetsWon: r.awaySetsWon,
          splitSets: tally?.splitSets ?? 0,
          homeGames: r.homeGames,
          awayGames: r.awayGames,
        }
      }),
    )

    const winnerTeamId =
      score.winnerSide === "home" ? row.homeTeamId : score.winnerSide === "away" ? row.awayTeamId : null

    const changed =
      row.homePoints !== score.homePoints ||
      row.awayPoints !== score.awayPoints ||
      row.winnerTeamId !== winnerTeamId

    if (changed) {
      await db
        .update(fixtures)
        .set({
          homePoints: score.homePoints,
          awayPoints: score.awayPoints,
          homeSetsWon: score.homeSetsWon,
          awaySetsWon: score.awaySetsWon,
          winnerTeamId,
          updatedAt: new Date(),
        })
        .where(eq(fixtures.id, row.id))
      updated++
      console.log(
        `  fixture ${row.id}: points ${row.homePoints}-${row.awayPoints} -> ${score.homePoints}-${score.awayPoints}, winner ${row.winnerTeamId} -> ${winnerTeamId}`,
      )
    }

    divisionSeasonPairs.add(`${row.divisionId}:${row.seasonId}`)
  }

  console.log(`Updated ${updated} fixtures`)

  console.log("Rebuilding standings tables for affected divisions...")
  for (const pair of divisionSeasonPairs) {
    const [divisionId, seasonId] = pair.split(":").map(Number)
    await rebuildDivisionStandings(divisionId, seasonId)
    console.log(`  ✓ division ${divisionId}`)
  }
  console.log("Done.")
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

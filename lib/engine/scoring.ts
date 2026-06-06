import { LEAGUE_SCORING } from "@/lib/constants"

export type MatchResult = {
  category: string
  homeSetsWon: number
  awaySetsWon: number
}

export type FixtureScore = {
  homePoints: number
  awayPoints: number
  homeSetsWon: number
  awaySetsWon: number
  homeMatchesWon: number
  awayMatchesWon: number
  winnerSide: "home" | "away" | "draw"
}

/**
 * League scoring:
 *  - 1 point per set won
 *  - 1 bonus point to the fixture winner (most sets won across all matches)
 */
export function scoreFixture(matches: MatchResult[]): FixtureScore {
  let homeSetsWon = 0
  let awaySetsWon = 0
  let homeMatchesWon = 0
  let awayMatchesWon = 0

  for (const m of matches) {
    homeSetsWon += m.homeSetsWon
    awaySetsWon += m.awaySetsWon
    if (m.homeSetsWon > m.awaySetsWon) homeMatchesWon++
    else if (m.awaySetsWon > m.homeSetsWon) awayMatchesWon++
  }

  let homePoints = homeSetsWon * LEAGUE_SCORING.pointPerSet
  let awayPoints = awaySetsWon * LEAGUE_SCORING.pointPerSet

  let winnerSide: "home" | "away" | "draw" = "draw"
  if (homeSetsWon > awaySetsWon) {
    winnerSide = "home"
    homePoints += LEAGUE_SCORING.bonusForWinner
  } else if (awaySetsWon > homeSetsWon) {
    winnerSide = "away"
    awayPoints += LEAGUE_SCORING.bonusForWinner
  }

  return {
    homePoints,
    awayPoints,
    homeSetsWon,
    awaySetsWon,
    homeMatchesWon,
    awayMatchesWon,
    winnerSide,
  }
}

export type StandingRow = {
  teamId: number
  played: number
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  points: number
  pointsDiff: number
  rank: number
  headToHead: Record<number, number> // teamId -> net result against that team
}

/**
 * League table ordering:
 *  1. Points
 *  2. Match Wins
 *  3. Sets Won
 *  4. Head-to-Head
 *  5. Points Difference
 */
export function sortStandings(rows: StandingRow[]): StandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    const h2hA = a.headToHead[b.teamId] ?? 0
    const h2hB = b.headToHead[a.teamId] ?? 0
    if (h2hA !== h2hB) return h2hB - h2hA
    return b.pointsDiff - a.pointsDiff
  })
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }))
}

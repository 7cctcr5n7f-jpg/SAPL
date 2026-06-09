import { LEAGUE_SCORING } from "@/lib/constants"

/** A single set score line, e.g. { home: 6, away: 4 }. */
export type SetScore = { home: number; away: number }

export type MatchResult = {
  category: string
  homeSetsWon: number
  awaySetsWon: number
  homeGames: number
  awayGames: number
}

export type FixtureScore = {
  homePoints: number
  awayPoints: number
  homeSetsWon: number
  awaySetsWon: number
  homeGames: number
  awayGames: number
  homeMatchesWon: number
  awayMatchesWon: number
  winnerSide: "home" | "away" | "draw"
}

/**
 * Derive sets won and total games from a list of set scores for one rubber.
 * A set is won by whichever side has more games in that set; equal games count
 * as no set won for either side (shouldn't happen in a completed set).
 */
export function tallySets(sets: SetScore[]): {
  homeSetsWon: number
  awaySetsWon: number
  homeGames: number
  awayGames: number
} {
  let homeSetsWon = 0
  let awaySetsWon = 0
  let homeGames = 0
  let awayGames = 0
  for (const s of sets) {
    const h = Number.isFinite(s.home) ? Math.max(0, Math.trunc(s.home)) : 0
    const a = Number.isFinite(s.away) ? Math.max(0, Math.trunc(s.away)) : 0
    if (h === 0 && a === 0) continue // empty/unplayed set row
    homeGames += h
    awayGames += a
    if (h > a) homeSetsWon++
    else if (a > h) awaySetsWon++
  }
  return { homeSetsWon, awaySetsWon, homeGames, awayGames }
}

/**
 * Parse a stored scoreDetail string like "6-4, 7-6, 6-2" back into set scores.
 * Tolerant of spacing and en-dashes.
 */
export function parseScoreDetail(scoreDetail: string | null | undefined): SetScore[] {
  if (!scoreDetail) return []
  return scoreDetail
    .split(",")
    .map((part) => part.trim().replace(/\u2013|\u2014/g, "-"))
    .filter(Boolean)
    .map((part) => {
      const [h, a] = part.split("-").map((n) => Number.parseInt(n.trim(), 10))
      return { home: Number.isFinite(h) ? h : 0, away: Number.isFinite(a) ? a : 0 }
    })
    .filter((s) => s.home !== 0 || s.away !== 0)
}

/** Format set scores into a display/storage string, e.g. "6-4, 7-6, 6-2". */
export function formatScoreDetail(sets: SetScore[]): string {
  return sets
    .filter((s) => s.home !== 0 || s.away !== 0)
    .map((s) => `${s.home}-${s.away}`)
    .join(", ")
}

/**
 * League scoring:
 *  - 1 point per set won
 *  - 1 bonus point to the fixture winner (most sets won across all matches)
 */
export function scoreFixture(matches: MatchResult[]): FixtureScore {
  let homeSetsWon = 0
  let awaySetsWon = 0
  let homeGames = 0
  let awayGames = 0
  let homeMatchesWon = 0
  let awayMatchesWon = 0

  for (const m of matches) {
    homeSetsWon += m.homeSetsWon
    awaySetsWon += m.awaySetsWon
    homeGames += m.homeGames
    awayGames += m.awayGames
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
    homeGames,
    awayGames,
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
  gamesFor: number
  gamesAgainst: number
  points: number
  pointsDiff: number // gamesFor - gamesAgainst
  rank: number
  headToHead: Record<number, number> // teamId -> net result against that team
}

/**
 * League table ordering:
 *  1. Points
 *  2. Match Wins
 *  3. Sets Won
 *  4. Head-to-Head
 *  5. Points Difference (Games For − Games Against)
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

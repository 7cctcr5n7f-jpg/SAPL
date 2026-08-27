import { LEAGUE_SCORING } from "@/lib/constants"

/** A single set score line, e.g. { home: 6, away: 4 }. */
export type SetScore = { home: number; away: number }

export type MatchResult = {
  category: string
  homeSetsWon: number
  awaySetsWon: number
  splitSets: number
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

function isCompletedSet(home: number, away: number) {
  if (home === away) return false
  return Math.max(home, away) >= 6
}

/**
 * Derive sets won and total games from a list of set scores for one rubber.
 * A set is won by whichever side has more games in that set; equal games count
 * as no set won for either side (shouldn't happen in a completed set).
 */
export function tallySets(sets: SetScore[]): {
  homeSetsWon: number
  awaySetsWon: number
  splitSets: number
  homeGames: number
  awayGames: number
} {
  let homeSetsWon = 0
  let awaySetsWon = 0
  let splitSets = 0
  let homeGames = 0
  let awayGames = 0
  for (const s of sets) {
    const h = Number.isFinite(s.home) ? Math.max(0, Math.trunc(s.home)) : 0
    const a = Number.isFinite(s.away) ? Math.max(0, Math.trunc(s.away)) : 0
    if (h === 0 && a === 0) continue // empty/unplayed set row
    homeGames += h
    awayGames += a
    if (h === a) continue
    if (!isCompletedSet(h, a)) {
      splitSets++
      continue
    }
    if (h > a) homeSetsWon++
    else awaySetsWon++
  }
  return { homeSetsWon, awaySetsWon, splitSets, homeGames, awayGames }
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
 *  - 1 point per completed set won (per category)
 *  - 0.5 point each for an incomplete/unfinished set entered (e.g. 3-4)
 *  - 1 bonus point per CATEGORY won (team that won more sets in that category)
 *
 * Example: winning a category 2-1 in sets → 2 + 1 = 3 pts
 *          winning a category 3-0 in sets → 3 + 1 = 4 pts
 *          losing a category 1-2 in sets  → 1 + 0 = 1 pt
 *
 * Fixture-level win/loss is determined by who won more categories.
 */
export function scoreFixture(matches: MatchResult[]): FixtureScore {
  let homeSetsWon = 0
  let awaySetsWon = 0
  let homeGames = 0
  let awayGames = 0
  let homeMatchesWon = 0
  let awayMatchesWon = 0
  let homePoints = 0
  let awayPoints = 0

  for (const m of matches) {
    homeSetsWon += m.homeSetsWon
    awaySetsWon += m.awaySetsWon
    homeGames += m.homeGames
    awayGames += m.awayGames

    // Per-category points: completed sets won + split points for unfinished sets
    homePoints += m.homeSetsWon * LEAGUE_SCORING.pointPerSet
    awayPoints += m.awaySetsWon * LEAGUE_SCORING.pointPerSet
    const splitSets = m.splitSets ?? 0
    if (splitSets > 0) {
      homePoints += splitSets * 0.5
      awayPoints += splitSets * 0.5
    }
    if (m.homeSetsWon > m.awaySetsWon) {
      homeMatchesWon++
      homePoints += LEAGUE_SCORING.bonusForWinner
    } else if (m.awaySetsWon > m.homeSetsWon) {
      awayMatchesWon++
      awayPoints += LEAGUE_SCORING.bonusForWinner
    } else if (m.homeSetsWon > 0 && m.homeSetsWon === m.awaySetsWon) {
      // Category tied on completed sets (e.g. 1-1): split only the category
      // bonus point (0.5 each). Any unfinished deciding set is already split
      // above via splitSets * 0.5 for each side.
      homePoints += LEAGUE_SCORING.bonusForWinner / 2
      awayPoints += LEAGUE_SCORING.bonusForWinner / 2
    }
  }

  // Fixture winner determined by total points (not raw categories won) —
  // e.g. 10 points to 6 is a win even if categories won are tied 2-2.
  let winnerSide: "home" | "away" | "draw" = "draw"
  if (homePoints > awayPoints) winnerSide = "home"
  else if (awayPoints > homePoints) winnerSide = "away"

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
 *  1. Points (most first)
 *  2. Points Difference (gamesFor − gamesAgainst)
 *  3. Match Wins
 *  4. Sets Won
 *  5. Head-to-Head
 */
export function sortStandings(rows: StandingRow[]): StandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    const h2hA = a.headToHead[b.teamId] ?? 0
    const h2hB = b.headToHead[a.teamId] ?? 0
    if (h2hA !== h2hB) return h2hB - h2hA
    return a.teamId - b.teamId
  })
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }))
}

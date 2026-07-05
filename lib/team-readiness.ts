import "server-only"
import { db } from "@/lib/db"
import { teams, teamMembers, user, payments } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { TEAM_SQUAD_SIZE } from "@/lib/constants"

/** Hard cap on the number of active players a team may carry (4 pairs x 2). */
export const MAX_TEAM_PLAYERS = TEAM_SQUAD_SIZE

export type TeamReadiness = {
  teamId: number
  /** Active roster size. */
  playerCount: number
  /** Full-squad target / hard cap (8). */
  maxPlayers: number
  /** Average Playtomic rating across rated players, or null when none are rated. */
  avgRating: number | null
  /** Average League Index across the active roster, or null when empty. */
  avgLi: number | null
  /** Players whose fee is settled (paid, or covered because the club pays). */
  paidCount: number
  /** Active players who still owe their league fee. */
  unpaidCount: number
  /** True when the roster carries a full squad of 8. */
  rosterComplete: boolean
  /** True when every active player's fee is settled (or the club covers fees). */
  feesSettled: boolean
  /** Whether the club is paying fees on behalf of the squad. */
  clubPaysFees: boolean
  /** A team is League Ready when it fields a full, fully-paid squad. */
  isLeagueReady: boolean
  /** Human-readable list of what still blocks readiness (empty when ready). */
  reasons: string[]
}

/**
 * Maps an average Playtomic rating to a suggested division band. This is an
 * advisory recommendation surfaced to League Admins only — final placement is
 * always decided by the league office. Returns null when no rating is available.
 */
export function suggestDivision(avgRating: number | null): string | null {
  if (avgRating == null || avgRating <= 0) return null
  if (avgRating >= 4.5) return "Premier / Division 1"
  if (avgRating >= 3.5) return "Division 2–3"
  if (avgRating >= 2.5) return "Division 4–5"
  return "Division 6+"
}

/**
 * Computes a team's League Ready status: roster completeness (full squad of 8),
 * fee settlement across the active roster, and roster averages (Playtomic
 * rating + League Index). A team is "League Ready" only when it fields a full,
 * fully-paid squad. Used by My Team, the admin Payments dashboard, and the admin
 * season-readiness overview.
 */
export async function getTeamReadiness(teamId: number): Promise<TeamReadiness | null> {
  const [team] = await db
    .select({ id: teams.id, seasonId: teams.seasonId, clubPaysFees: teams.clubPaysFees })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return null

  const roster = await db
    .select({ playerId: teamMembers.playerId, li: user.currentLi, rating: user.playtomicRating })
    .from(teamMembers)
    .innerJoin(user, eq(user.id, teamMembers.playerId))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))

  const playerCount = roster.length

  const rated = roster.map((r) => r.rating).filter((v): v is number => v != null && v > 0)
  const avgRating =
    rated.length > 0 ? Math.round((rated.reduce((s, v) => s + v, 0) / rated.length) * 100) / 100 : null

  const lis = roster.map((r) => r.li).filter((v): v is number => v != null && v > 0)
  const avgLi = lis.length > 0 ? Math.round((lis.reduce((s, v) => s + v, 0) / lis.length) * 100) / 100 : null

  // Fee settlement — mirrors getPlayerTeamFees: a club that pays fees covers the
  // whole squad; otherwise each active player needs a paid individual payment.
  let paidCount = 0
  if (team.clubPaysFees) {
    paidCount = playerCount
  } else {
    for (const r of roster) {
      const [pay] = await db
        .select({ status: payments.status })
        .from(payments)
        .where(
          and(
            eq(payments.teamId, teamId),
            eq(payments.playerId, r.playerId),
            eq(payments.type, "individual"),
          ),
        )
        .limit(1)
      if (pay?.status === "paid") paidCount += 1
    }
  }
  const unpaidCount = Math.max(0, playerCount - paidCount)

  const rosterComplete = playerCount >= MAX_TEAM_PLAYERS
  const feesSettled = team.clubPaysFees || unpaidCount === 0
  const isLeagueReady = rosterComplete && feesSettled

  const reasons: string[] = []
  if (!rosterComplete) {
    const missing = MAX_TEAM_PLAYERS - playerCount
    reasons.push(`Add ${missing} more player${missing === 1 ? "" : "s"} to complete the squad of ${MAX_TEAM_PLAYERS}.`)
  }
  if (!feesSettled) {
    reasons.push(`${unpaidCount} player${unpaidCount === 1 ? "" : "s"} still owe their league fee.`)
  }

  return {
    teamId,
    playerCount,
    maxPlayers: MAX_TEAM_PLAYERS,
    avgRating,
    avgLi,
    paidCount,
    unpaidCount,
    rosterComplete,
    feesSettled,
    clubPaysFees: team.clubPaysFees,
    isLeagueReady,
    reasons,
  }
}

/** A single team's readiness row, decorated with the team name for admin tables. */
export type SeasonReadinessTeam = TeamReadiness & { teamName: string }

export type SeasonReadiness = {
  teams: SeasonReadinessTeam[]
  totalTeams: number
  readyTeams: number
  rosterCompleteTeams: number
  feesSettledTeams: number
  playersOutstanding: number
}

/**
 * Batch equivalent of {@link getTeamReadiness} for every active team in a season.
 * Uses a handful of grouped queries (no per-team round trips) so it scales to a
 * full league. Powers the admin Payments readiness dashboard and the admin
 * season-readiness overview.
 */
export async function getSeasonReadiness(seasonId: number): Promise<SeasonReadiness> {
  const teamRows = await db
    .select({ id: teams.id, name: teams.name, clubPaysFees: teams.clubPaysFees })
    .from(teams)
    .where(and(eq(teams.seasonId, seasonId), eq(teams.status, "active")))

  const empty: SeasonReadiness = {
    teams: [],
    totalTeams: 0,
    readyTeams: 0,
    rosterCompleteTeams: 0,
    feesSettledTeams: 0,
    playersOutstanding: 0,
  }
  if (teamRows.length === 0) return empty

  const teamIds = teamRows.map((t) => t.id)

  // All active roster members across the season's teams, with rating + LI.
  const rosterRows = await db
    .select({
      teamId: teamMembers.teamId,
      playerId: teamMembers.playerId,
      li: user.currentLi,
      rating: user.playtomicRating,
    })
    .from(teamMembers)
    .innerJoin(user, eq(user.id, teamMembers.playerId))
    .where(and(inArray(teamMembers.teamId, teamIds), eq(teamMembers.status, "active")))

  // All settled individual payments for these teams.
  const payRows = await db
    .select({ teamId: payments.teamId, playerId: payments.playerId })
    .from(payments)
    .where(
      and(
        inArray(payments.teamId, teamIds),
        eq(payments.type, "individual"),
        eq(payments.status, "paid"),
      ),
    )

  const rosterByTeam = new Map<number, { playerId: string; li: number | null; rating: number | null }[]>()
  for (const r of rosterRows) {
    const list = rosterByTeam.get(r.teamId) ?? []
    list.push({ playerId: r.playerId, li: r.li, rating: r.rating })
    rosterByTeam.set(r.teamId, list)
  }

  const paidByTeam = new Map<number, Set<string>>()
  for (const p of payRows) {
    if (p.teamId == null || p.playerId == null) continue
    const set = paidByTeam.get(p.teamId) ?? new Set<string>()
    set.add(p.playerId)
    paidByTeam.set(p.teamId, set)
  }

  const rows: SeasonReadinessTeam[] = teamRows.map((team) => {
    const roster = rosterByTeam.get(team.id) ?? []
    const playerCount = roster.length

    const rated = roster.map((r) => r.rating).filter((v): v is number => v != null && v > 0)
    const avgRating =
      rated.length > 0 ? Math.round((rated.reduce((s, v) => s + v, 0) / rated.length) * 100) / 100 : null
    const lis = roster.map((r) => r.li).filter((v): v is number => v != null && v > 0)
    const avgLi = lis.length > 0 ? Math.round((lis.reduce((s, v) => s + v, 0) / lis.length) * 100) / 100 : null

    let paidCount = 0
    if (team.clubPaysFees) {
      paidCount = playerCount
    } else {
      const paidSet = paidByTeam.get(team.id) ?? new Set<string>()
      paidCount = roster.filter((r) => paidSet.has(r.playerId)).length
    }
    const unpaidCount = Math.max(0, playerCount - paidCount)

    const rosterComplete = playerCount >= MAX_TEAM_PLAYERS
    const feesSettled = team.clubPaysFees || unpaidCount === 0
    const isLeagueReady = rosterComplete && feesSettled

    const reasons: string[] = []
    if (!rosterComplete) {
      const missing = MAX_TEAM_PLAYERS - playerCount
      reasons.push(`Add ${missing} more player${missing === 1 ? "" : "s"} to complete the squad of ${MAX_TEAM_PLAYERS}.`)
    }
    if (!feesSettled) {
      reasons.push(`${unpaidCount} player${unpaidCount === 1 ? "" : "s"} still owe their league fee.`)
    }

    return {
      teamId: team.id,
      teamName: team.name,
      playerCount,
      maxPlayers: MAX_TEAM_PLAYERS,
      avgRating,
      avgLi,
      paidCount,
      unpaidCount,
      rosterComplete,
      feesSettled,
      clubPaysFees: team.clubPaysFees,
      isLeagueReady,
      reasons,
    }
  })

  // Sort: not-ready first (needs attention), then by name.
  rows.sort((a, b) => {
    if (a.isLeagueReady !== b.isLeagueReady) return a.isLeagueReady ? 1 : -1
    return a.teamName.localeCompare(b.teamName)
  })

  return {
    teams: rows,
    totalTeams: rows.length,
    readyTeams: rows.filter((r) => r.isLeagueReady).length,
    rosterCompleteTeams: rows.filter((r) => r.rosterComplete).length,
    feesSettledTeams: rows.filter((r) => r.feesSettled).length,
    playersOutstanding: rows.reduce((s, r) => s + r.unpaidCount, 0),
  }
}

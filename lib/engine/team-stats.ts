import { db } from "@/lib/db"
import { teams, teamPairings, players, clubs, fixtures, seasons } from "@/lib/db/schema"
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm"
import { deriveTeamLifecycleStatus } from "@/lib/team-lifecycle"
import { isSeasonLockedStatus } from "@/lib/season-lifecycle"

/**
 * Recomputes the cached roster aggregates for a team (average League Index and
 * active player count) and re-syncs its SAPL region / regionId from its home
 * club. Safe to call after any pairing or home-club mutation.
 *
 * The "squad" is defined as the unique set of players filling pairing slots —
 * there is no separate roster table driving these stats any more.
 */
export async function recomputeTeamStats(teamId: number) {
  const [team] = await db
    .select({
      id: teams.id,
      homeClubId: teams.homeClubId,
      saplRegion: teams.saplRegion,
      regionId: teams.regionId,
      divisionId: teams.divisionId,
      seasonId: teams.seasonId,
      maxPlayers: teams.maxPlayers,
      status: teams.status,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return

  // Derive the squad from unique player IDs in ppl_team_pairings.
  const slotRows = await db
    .select({ playerId: teamPairings.playerId })
    .from(teamPairings)
    .where(and(eq(teamPairings.teamId, teamId), isNotNull(teamPairings.playerId)))

  const uniquePlayerIds = [...new Set(slotRows.map((r) => r.playerId as string))]

  // Read playtomicRating from ppl_players (the canonical source set by admins).
  // user.playtomicRating is a mirror only — ppl_players is always authoritative.
  let roster: { pr: number | null }[] = []
  if (uniquePlayerIds.length > 0) {
    roster = await db
      .select({ pr: players.playtomicRating })
      .from(players)
      .where(inArray(players.userId, uniquePlayerIds))
  }

  const playerCount = uniquePlayerIds.length
  // Average only players who have a Playtomic rating set (not null/0 players skew the avg)
  const ratedPlayers = roster.filter((r) => r.pr != null)
  const avgLi =
    ratedPlayers.length > 0
      ? Math.round((ratedPlayers.reduce((s, r) => s + (r.pr ?? 0), 0) / ratedPlayers.length) * 100) / 100
      : 0

  let saplRegion = team.saplRegion ?? null
  let regionId = team.regionId ?? null
  if (team.homeClubId) {
    const [club] = await db
      .select({ saplRegion: clubs.saplRegion, regionId: clubs.regionId })
      .from(clubs)
      .where(eq(clubs.id, team.homeClubId))
      .limit(1)
    if (club) {
      saplRegion = club.saplRegion ?? saplRegion
      regionId = club.regionId ?? regionId
    }
  }

  let seasonStatus: string | null = null
  if (team.seasonId != null) {
    const [season] = await db
      .select({ status: seasons.status })
      .from(seasons)
      .where(eq(seasons.id, team.seasonId))
      .limit(1)
    seasonStatus = season?.status ?? null
  }

  const [fixtureAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      remaining: sql<number>`count(case when ${fixtures.status} != 'completed' then 1 end)::int`,
    })
    .from(fixtures)
    .where(or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)))

  const lifecycleStatus =
    team.status === "inactive"
      ? "inactive"
      : deriveTeamLifecycleStatus({
          playerCount,
          maxPlayers: team.maxPlayers ?? 8,
          divisionId: team.divisionId ?? null,
          fixtureCount: fixtureAgg?.total ?? 0,
          remainingFixtureCount: fixtureAgg?.remaining ?? 0,
          seasonStatus: isSeasonLockedStatus(seasonStatus) ? "active" : seasonStatus,
        })

  await db
    .update(teams)
    .set({ avgLi, playerCount, saplRegion, regionId, status: lifecycleStatus, updatedAt: new Date() })
    .where(eq(teams.id, teamId))
}

export async function syncTeamLifecycleStatus(teamId: number) {
  await recomputeTeamStats(teamId)
}

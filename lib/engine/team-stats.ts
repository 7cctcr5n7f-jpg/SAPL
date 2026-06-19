import { db } from "@/lib/db"
import { teams, teamMembers, players, clubs } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

/**
 * Recomputes the cached roster aggregates for a team (average League Index and
 * active player count) and re-syncs its SAPL region / regionId from its home
 * club. Safe to call after any roster or home-club mutation.
 */
export async function recomputeTeamStats(teamId: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return

  const roster = await db
    .select({ li: user.currentLi })
    .from(teamMembers)
    .innerJoin(players, eq(user.id, teamMembers.playerId))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))

  const playerCount = roster.length
  const avgLi =
    playerCount > 0 ? Math.round((roster.reduce((s, r) => s + (r.li ?? 0), 0) / playerCount) * 100) / 100 : 0

  let saplRegion = team.saplRegion ?? null
  let regionId = team.regionId ?? null
  if (team.homeClubId) {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, team.homeClubId)).limit(1)
    if (club) {
      saplRegion = club.saplRegion ?? saplRegion
      regionId = club.regionId ?? regionId
    }
  }

  await db
    .update(teams)
    .set({ avgLi, playerCount, saplRegion, regionId, updatedAt: new Date() })
    .where(eq(teams.id, teamId))
}

"use server"

import { db } from "@/lib/db"
import {
  results,
  fixtures,
  teams,
  teamMembers,
  user as userTable,
  notifications,
  fixtureUnavailable,
} from "@/lib/db/schema"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { applyFixtureResult } from "@/lib/engine/apply-result"
import { tallySets } from "@/lib/engine/scoring"
import { recomputeTeamStats } from "@/lib/engine/team-stats"
import { getPlayerSeasonTeamConflict } from "@/lib/queries-dashboard"
import { getAccessContext } from "@/lib/access"
import { notifyTeam } from "@/lib/notify"

async function getFixtureForUser(user: CurrentUser, fixtureId: number, isAdmin: boolean) {
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!fixture) return null
  // Super admins can edit any fixture's result.
  if (isAdmin) return fixture
  // Template fixtures with no teams assigned yet cannot have a result.
  if (fixture.homeTeamId == null || fixture.awayTeamId == null) return null
  // Anyone who can manage either team (captain, team owner, or team/club manager
  // with captain_hub access) may record the result.
  const canHome = await canManageTeam(user, fixture.homeTeamId)
  const canAway = await canManageTeam(user, fixture.awayTeamId)
  if (!canHome && !canAway) return null
  return fixture
}

export type SubmittedCategory = {
  category: string
  session: number
  isFeatureCourt: boolean
  /** Actual set scores entered by the captain, e.g. [{home:6,away:4},...]. */
  sets: { home: number; away: number }[]
}

export async function submitResult(fixtureId: number, categories: SubmittedCategory[]) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const isAdmin = me.isSuperAdmin
  // getFixtureForUser enforces that the user can manage one of the teams in this
  // fixture (captain, owner, or team/club manager), so we don't gate on role here.
  const fixture = await getFixtureForUser(me, fixtureId, isAdmin)
  if (!fixture) return { error: "You do not manage a team in this fixture." }
  if (fixture.homeTeamId == null || fixture.awayTeamId == null) {
    return { error: "Both teams must be assigned before recording a result." }
  }
  const homeTeamId = fixture.homeTeamId
  const awayTeamId = fixture.awayTeamId

  // Captains of either team (or admins) may record AND edit results — no
  // approval step. getFixtureForUser already enforced that this user is
  // entitled to this fixture.
  const wasCompleted = fixture.status === "completed"

  // Validate scores: every category needs at least one decisive set.
  for (const c of categories) {
    const tally = tallySets(c.sets)
    if (tally.homeSetsWon === 0 && tally.awaySetsWon === 0) {
      return { error: `Enter a valid set score for ${c.category}.` }
    }
  }

  // Apply the result immediately — no approval step.
  const { score, winnerTeamId } = await applyFixtureResult(fixtureId, categories)

  // Record an audit row for the result (status approved / final).
  await db.delete(results).where(eq(results.fixtureId, fixtureId))
  await db.insert(results).values({
    fixtureId,
    submittedByUserId: me.id,
    approvedByUserId: me.id,
    status: "approved",
    homePoints: score.homePoints,
    awayPoints: score.awayPoints,
    homeSetsWon: score.homeSetsWon,
    awaySetsWon: score.awaySetsWon,
    winnerTeamId,
    payload: categories,
    approvedAt: new Date(),
  })

  // Notify both teams' rosters that the result is final, with a link to view it.
  const scoreLine = `${score.homePoints} – ${score.awayPoints}`
  const title = wasCompleted ? "Result updated" : "Result recorded — standings updated"
  const body = `Final score ${scoreLine}. Tap to view the match.`
  const href = `/league-centre/match/${fixtureId}`
  await notifyTeam(homeTeamId, { type: "result_recorded", title, body, fixtureId, href })
  await notifyTeam(awayTeamId, { type: "result_recorded", title, body, fixtureId, href })

  revalidatePath("/dashboard/captain")
  revalidatePath("/admin/fixtures")
  revalidatePath("/standings")
  revalidatePath("/league-centre")
  return { success: wasCompleted ? "Result updated." : "Result recorded. Standings updated." }
}

/** Can this user manage the given team's lineup (captain, owner, club/team manager, or league admin)? */
async function canManageTeam(
  user: CurrentUser,
  teamId: number,
): Promise<boolean> {
  const access = await getAccessContext(user)
  // captain_hub or team_management permission plus the team being in scope
  // (owner email / captaincy / manual assignment / club-homed) grants access.
  if (access.isLeagueAdmin) return true
  if (!access.can("captain_hub") && !access.can("team_management")) return false
  return access.canManageTeam(teamId)
}

/**
 * Mark a roster player available/unavailable for a specific upcoming fixture.
 * Captains use this to drop players from a given week's lineup.
 */
export async function setPlayerAvailability(
  fixtureId: number,
  teamId: number,
  playerId: number,
  unavailable: boolean,
) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  if (!(await canManageTeam(me, teamId))) return { error: "You do not manage this team." }

  // The team must actually be in this fixture.
  const [fx] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!fx || (fx.homeTeamId !== teamId && fx.awayTeamId !== teamId)) {
    return { error: "This team is not in that fixture." }
  }

  if (unavailable) {
    await db
      .insert(fixtureUnavailable)
      .values({ fixtureId, teamId, playerId })
      .onConflictDoNothing({ target: [fixtureUnavailable.fixtureId, fixtureUnavailable.playerId] })
  } else {
    await db
      .delete(fixtureUnavailable)
      .where(and(eq(fixtureUnavailable.fixtureId, fixtureId), eq(fixtureUnavailable.playerId, playerId)))
  }

  revalidatePath("/dashboard/captain")
  return { success: unavailable ? "Marked unavailable" : "Marked available" }
}

export async function addPlayer(teamId: number, playerId: number) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  if (!(await canManageTeam(me, teamId))) return { error: "You do not manage this team." }
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return { error: "Team not found." }

  // One team per player per season: block if the player is already active on a
  // different team in the same season.
  const conflict = await getPlayerSeasonTeamConflict(playerId, team.seasonId, teamId)
  if (conflict) {
    return { error: `This player already plays for ${conflict.teamName} this season. They must leave that team first.` }
  }

  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, playerId)))
    .limit(1)
  if (existing && existing.status === "active") {
    return { error: "Player is already on the roster." }
  }

  // Add the player straight onto the roster — no approval needed from the player.
  if (existing) {
    await db
      .update(teamMembers)
      .set({ status: "active", initiatedBy: "team", updatedAt: new Date() })
      .where(eq(teamMembers.id, existing.id))
  } else {
    await db.insert(teamMembers).values({
      teamId,
      playerId,
      role: "member",
      status: "active",
      initiatedBy: "team",
    })
  }

  const [player] = await db.select().from(userTable).where(eq(userTable.id, playerId)).limit(1)
  if (player) {
    await db
      .update(userTable)
      .set({ availability: "on_team", lookingForTeam: false, onMarketplace: false, updatedAt: new Date() })
      .where(eq(userTable.id, playerId))
    await db.insert(notifications).values({
      userId: player.id,
      type: "team_invite",
      title: "You've been added to a team",
      body: `${team.name} has added you to their roster.`,
      scope: "direct",
    })
  }

  await recomputeTeamStats(teamId)
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  revalidatePath("/dashboard")
  return { success: `${player ? player.firstName : "Player"} added to ${team.name}.` }
}

export async function removeMember(teamId: number, membershipId: number) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  if (!(await canManageTeam(me, teamId))) return { error: "You do not manage this team." }

  await db
    .update(teamMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(teamMembers.id, membershipId), eq(teamMembers.teamId, teamId)))

  revalidatePath("/dashboard/captain")
  return { success: "Player removed from roster." }
}

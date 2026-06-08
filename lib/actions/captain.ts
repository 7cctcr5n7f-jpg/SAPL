"use server"

import { db } from "@/lib/db"
import {
  results,
  fixtures,
  teams,
  teamMembers,
  players,
  notifications,
  fixtureUnavailable,
  organisations,
} from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { applyFixtureResult } from "@/lib/engine/apply-result"
import { recomputeTeamStats } from "@/lib/engine/team-stats"
import { getPlayerSeasonTeamConflict } from "@/lib/queries-dashboard"

async function getFixtureForUser(userId: string, fixtureId: number, isAdmin: boolean) {
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1)
  if (!fixture) return null
  // Admins can edit any fixture's result.
  if (isAdmin) return fixture
  // Template fixtures with no teams assigned yet cannot have a result.
  if (fixture.homeTeamId == null || fixture.awayTeamId == null) return null
  const myTeams = await db.select().from(teams).where(eq(teams.captainUserId, userId))
  const ids = new Set(myTeams.map((t) => t.id))
  if (!ids.has(fixture.homeTeamId) && !ids.has(fixture.awayTeamId)) return null
  return fixture
}

async function notifyTeamCaptain(teamId: number, title: string, body: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (team?.captainUserId) {
    await db.insert(notifications).values({
      userId: team.captainUserId,
      type: "result_recorded",
      title,
      body,
      scope: "direct",
    })
  }
}

export type SubmittedCategory = {
  category: string
  session: number
  isFeatureCourt: boolean
  homeSetsWon: number
  awaySetsWon: number
  scoreDetail?: string
}

export async function submitResult(fixtureId: number, categories: SubmittedCategory[]) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const isAdmin = me.isSuperAdmin || me.role === "league_admin"
  if (!isAdmin && me.role !== "captain" && me.role !== "org_admin") {
    return { error: "Only captains can submit results." }
  }
  const fixture = await getFixtureForUser(me.id, fixtureId, isAdmin)
  if (!fixture) return { error: "You do not captain a team in this fixture." }
  if (fixture.homeTeamId == null || fixture.awayTeamId == null) {
    return { error: "Both teams must be assigned before recording a result." }
  }
  const homeTeamId = fixture.homeTeamId
  const awayTeamId = fixture.awayTeamId

  // Captains of either team (or admins) may record AND edit results — no
  // approval step. getFixtureForUser already enforced that this user is
  // entitled to this fixture.
  const wasCompleted = fixture.status === "completed"

  // Validate scores
  for (const c of categories) {
    if (c.homeSetsWon < 0 || c.awaySetsWon < 0 || (c.homeSetsWon === 0 && c.awaySetsWon === 0)) {
      return { error: `Enter a valid score for ${c.category}.` }
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

  // Notify both captains that the result is final.
  const scoreLine = `${score.homePoints} – ${score.awayPoints}`
  const verb = wasCompleted ? "updated by a league admin" : "recorded"
  await notifyTeamCaptain(homeTeamId, "Result " + verb, `Fixture #${fixtureId} final score: ${scoreLine}.`)
  await notifyTeamCaptain(awayTeamId, "Result " + verb, `Fixture #${fixtureId} final score: ${scoreLine}.`)

  revalidatePath("/dashboard/captain")
  revalidatePath("/admin/fixtures")
  revalidatePath("/standings")
  return { success: wasCompleted ? "Result updated." : "Result recorded. Standings updated." }
}

/** Can this user manage the given team's lineup (captain, its org admin, or league admin)? */
async function canManageTeam(
  user: { id: string; role: string; isSuperAdmin: boolean },
  teamId: number,
): Promise<boolean> {
  if (user.isSuperAdmin || user.role === "league_admin") return true
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return false
  if (team.captainUserId === user.id) return true
  if (user.role === "org_admin" && team.organisationId) {
    const [org] = await db
      .select()
      .from(organisations)
      .where(and(eq(organisations.id, team.organisationId), eq(organisations.ownerUserId, user.id)))
      .limit(1)
    if (org) return true
  }
  return false
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
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.captainUserId, me.id)))
    .limit(1)
  if (!team) return { error: "You do not captain this team." }

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

  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
  if (player) {
    await db
      .update(players)
      .set({ availability: "on_team", lookingForTeam: false, updatedAt: new Date() })
      .where(eq(players.id, playerId))
    await db.insert(notifications).values({
      userId: player.userId,
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
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.captainUserId, me.id)))
    .limit(1)
  if (!team) return { error: "You do not captain this team." }

  await db
    .update(teamMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(teamMembers.id, membershipId), eq(teamMembers.teamId, teamId)))

  revalidatePath("/dashboard/captain")
  return { success: "Player removed from roster." }
}

"use server"

import { db } from "@/lib/db"
import {
  teams,
  teamMembers,
  teamPairings,
  teamInvites,
  players,
  user as authUser,
  notifications,
} from "@/lib/db/schema"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { recomputeTeamStats } from "@/lib/engine/team-stats"
import { getPlayerSeasonTeamConflict } from "@/lib/queries-dashboard"
import { sendEmail, teamAddInviteEmail, appBaseUrl } from "@/lib/email"
import { getAccessContext } from "@/lib/access"

// ---------------------------------------------------------------------------
// Permission helper: who may manage a team's pairings / invites?
//  - the team captain
//  - an org admin who owns the team's organisation
//  - league / super admins
// ---------------------------------------------------------------------------
async function canManageTeam(me: CurrentUser, teamId: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return null
  const access = await getAccessContext(me)
  if (access.isLeagueAdmin) return team
  if (!access.can("captain_hub") && !access.can("team_management")) return null
  // Owner email / captaincy / manual assignment / club-homed teams are in scope.
  return access.canManageTeam(teamId) ? team : null
}

// Assign a roster player to a specific pairing slot (or clear it with playerId=null).
export async function setPairingSlot(input: {
  teamId: number
  category: string
  pairIndex: number
  slotIndex: number
  playerId: number | null
}) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const team = await canManageTeam(me, input.teamId)
  if (!team) return { error: "You cannot manage this team." }

  const [existing] = await db
    .select()
    .from(teamPairings)
    .where(
      and(
        eq(teamPairings.teamId, input.teamId),
        eq(teamPairings.category, input.category),
        eq(teamPairings.pairIndex, input.pairIndex),
        eq(teamPairings.slotIndex, input.slotIndex),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(teamPairings)
      .set({ playerId: input.playerId, updatedAt: new Date() })
      .where(eq(teamPairings.id, existing.id))
  } else {
    await db.insert(teamPairings).values({
      teamId: input.teamId,
      category: input.category,
      pairIndex: input.pairIndex,
      slotIndex: input.slotIndex,
      playerId: input.playerId,
    })
  }

  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return { success: "Lineup updated." }
}

// Add a player to a team by email and (optionally) a specific pairing slot.
// If the email already belongs to a registered player, they are added to the
// roster immediately (no approval needed). Otherwise a pending invite is stored,
// an account-creation email is sent, and the membership is resolved when they
// register with that email address.
export async function invitePlayerByEmail(input: {
  teamId: number
  email: string
  category?: string
  pairIndex?: number
  slotIndex?: number
}) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const team = await canManageTeam(me, input.teamId)
  if (!team) return { error: "You cannot manage this team." }

  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." }

  // Does a registered user with a player profile already exist for this email?
  const [existingUser] = await db.select().from(authUser).where(eq(authUser.email, email)).limit(1)
  let existingPlayer: typeof players.$inferSelect | undefined
  if (existingUser) {
    ;[existingPlayer] = await db.select().from(players).where(eq(players.userId, existingUser.id)).limit(1)
  }

  if (existingPlayer) {
    // One team per player per season.
    const conflict = await getPlayerSeasonTeamConflict(existingPlayer.id, team.seasonId, input.teamId)
    if (conflict) {
      return {
        error: `${existingPlayer.firstName} already plays for ${conflict.teamName} this season. They must leave that team first.`,
      }
    }
    // Immediate add for an existing player — no approval needed.
    await joinTeam(input.teamId, existingPlayer.id, {
      category: input.category,
      pairIndex: input.pairIndex,
      slotIndex: input.slotIndex,
    })
    await db.insert(notifications).values({
      userId: existingPlayer.userId,
      type: "team_invite",
      title: "You've been added to a team",
      body: `${team.name} has added you to their squad.`,
      scope: "direct",
    })
    revalidatePath("/dashboard/captain")
    revalidatePath("/dashboard/org")
    revalidatePath("/dashboard")
    return { success: `${existingPlayer.firstName} ${existingPlayer.lastName} added to ${team.name}.` }
  }

  // Otherwise store a pending invite to be resolved on registration.
  const [already] = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.teamId, input.teamId), eq(teamInvites.email, email), eq(teamInvites.status, "pending")))
    .limit(1)
  if (already) {
    await db
      .update(teamInvites)
      .set({
        category: input.category ?? null,
        pairIndex: input.pairIndex ?? null,
        slotIndex: input.slotIndex ?? null,
      })
      .where(eq(teamInvites.id, already.id))
  } else {
    await db.insert(teamInvites).values({
      teamId: input.teamId,
      email,
      category: input.category ?? null,
      pairIndex: input.pairIndex ?? null,
      slotIndex: input.slotIndex ?? null,
      invitedByUserId: me.id,
      token: randomUUID(),
      status: "pending",
    })
  }

  // Send an account-creation email so the invitee can claim their spot. The
  // registration page pre-fills the email; their membership resolves on signup.
  const registerUrl = `${appBaseUrl()}/register?email=${encodeURIComponent(email)}`
  const { subject, html, text } = teamAddInviteEmail({
    teamName: team.name,
    captainName: me.name,
    registerUrl,
  })
  const { sent } = await sendEmail({ to: email, subject, html, text })
  if (!sent) {
    console.log(`[v0] Team add invite for ${email} (no email provider): ${registerUrl}`)
  }

  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return {
    success: `${email} has been added as pending. They'll join ${team.name} automatically once they create their account.`,
  }
}

export async function cancelInvite(inviteId: number) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const [invite] = await db.select().from(teamInvites).where(eq(teamInvites.id, inviteId)).limit(1)
  if (!invite) return { error: "Invite not found." }
  const team = await canManageTeam(me, invite.teamId)
  if (!team) return { error: "You cannot manage this team." }
  await db.update(teamInvites).set({ status: "cancelled" }).where(eq(teamInvites.id, inviteId))
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return { success: "Invite cancelled." }
}

// Add a player to a team roster (idempotent) and optionally fill a pairing slot.
async function joinTeam(
  teamId: number,
  playerId: number,
  slot?: { category?: string; pairIndex?: number; slotIndex?: number },
) {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, playerId)))
    .limit(1)
  if (member) {
    if (member.status !== "active") {
      await db
        .update(teamMembers)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(teamMembers.id, member.id))
    }
  } else {
    await db.insert(teamMembers).values({
      teamId,
      playerId,
      role: "member",
      status: "active",
      initiatedBy: "team",
    })
  }

  if (slot?.category && slot.pairIndex && slot.slotIndex) {
    const [existing] = await db
      .select()
      .from(teamPairings)
      .where(
        and(
          eq(teamPairings.teamId, teamId),
          eq(teamPairings.category, slot.category),
          eq(teamPairings.pairIndex, slot.pairIndex),
          eq(teamPairings.slotIndex, slot.slotIndex),
        ),
      )
      .limit(1)
    if (existing) {
      await db.update(teamPairings).set({ playerId, updatedAt: new Date() }).where(eq(teamPairings.id, existing.id))
    } else {
      await db.insert(teamPairings).values({
        teamId,
        category: slot.category,
        pairIndex: slot.pairIndex,
        slotIndex: slot.slotIndex,
        playerId,
      })
    }
  }

  await recomputeTeamStats(teamId)
}

// Resolve any pending email invites for a freshly-registered player.
// Called from the onboarding action once a player profile exists.
export async function resolvePendingInvites(email: string, playerId: number) {
  const normalized = email.trim().toLowerCase()
  const pending = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.email, normalized), eq(teamInvites.status, "pending")))

  for (const invite of pending) {
    const [team] = await db.select().from(teams).where(eq(teams.id, invite.teamId)).limit(1)
    // Respect "one team per player per season": if the player has already been
    // joined to another team in this season (e.g. an earlier pending invite),
    // skip this one and leave it pending so a captain/player can resolve it.
    if (team) {
      const conflict = await getPlayerSeasonTeamConflict(playerId, team.seasonId, invite.teamId)
      if (conflict) continue
    }
    await joinTeam(invite.teamId, playerId, {
      category: invite.category ?? undefined,
      pairIndex: invite.pairIndex ?? undefined,
      slotIndex: invite.slotIndex ?? undefined,
    })
    await db
      .update(teamInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id))
  }
  return pending.length
}

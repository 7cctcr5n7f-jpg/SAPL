"use server"

import { db } from "@/lib/db"
import {
  teams,
  teamMembers,
  teamPairings,
  teamInvites,
  players,
  organisations,
  user as authUser,
  notifications,
} from "@/lib/db/schema"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { recomputeTeamStats } from "@/lib/engine/team-stats"

// ---------------------------------------------------------------------------
// Permission helper: who may manage a team's pairings / invites?
//  - the team captain
//  - an org admin who owns the team's organisation
//  - league / super admins
// ---------------------------------------------------------------------------
async function canManageTeam(me: CurrentUser, teamId: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return null
  if (me.isSuperAdmin || me.role === "league_admin") return team
  if (team.captainUserId === me.id) return team
  if (me.role === "org_admin") {
    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, team.organisationId))
      .limit(1)
    if (org?.ownerUserId === me.id) return team
  }
  return null
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

// Invite a player by email to a team and (optionally) a specific pairing slot.
// If the email already belongs to a registered player, they are joined immediately.
// Otherwise a pending invite is stored and resolved when they register.
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
    // Immediate join for an existing player.
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
    return { success: `${existingPlayer.firstName} ${existingPlayer.lastName} joined ${team.name}.` }
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

  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return { success: `Invite sent to ${email}. They'll join automatically when they register.` }
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

"use server"

import { db } from "@/lib/db"
import {
  teams,
  teamMembers,
  teamPairings,
  teamInvites,
  user,
  notifications,
} from "@/lib/db/schema"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { and, eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { recomputeTeamStats } from "@/lib/engine/team-stats"
import { getPlayerSeasonTeamConflict } from "@/lib/queries-dashboard"
import { sendEmail, teamInviteEmail, appBaseUrl } from "@/lib/email"
import { getAccessContext } from "@/lib/access"
import { TEAM_SQUAD_SIZE } from "@/lib/constants"
import { TeamFullError } from "@/lib/team-errors"

// ---------------------------------------------------------------------------
// Permission helper: who may manage a team's pairings / invites?
//  - the team captain
//  - an org admin who owns the team's organisation
//  - league / super admins
// ---------------------------------------------------------------------------
async function canManageTeam(me: CurrentUser, teamId: number) {
  const [team] = await db
    .select({ id: teams.id, name: teams.name, seasonId: teams.seasonId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
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
  playerId: string | null
}) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const team = await canManageTeam(me, input.teamId)
  if (!team) return { error: "You cannot manage this team." }

  // A player may only occupy ONE pairing slot across the whole team lineup.
  // Block assigning someone who is already placed in another slot/category.
  if (input.playerId != null) {
    const placed = await db
      .select({ category: teamPairings.category, slotIndex: teamPairings.slotIndex })
      .from(teamPairings)
      .where(and(eq(teamPairings.teamId, input.teamId), eq(teamPairings.playerId, input.playerId)))
    const elsewhere = placed.find(
      (p) => !(p.category === input.category && p.slotIndex === input.slotIndex),
    )
    if (elsewhere) {
      const [p] = await db
        .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
        .from(user)
        .where(eq(user.id, input.playerId))
        .limit(1)
      const who = p ? `${p.firstName} ${p.lastName}` : "That player"
      return { error: `${who} is already assigned to ${elsewhere.category}. Clear that slot first.` }
    }
  }

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

/**
 * Remove a player from a team entirely: mark their roster membership as removed,
 * clear them out of every pairing slot for this team, and reset their
 * availability so the one-team-per-season conflict no longer blocks re-assigning
 * them elsewhere. Clearing a pairing slot alone does NOT do this.
 */
export async function removeFromTeam(input: { teamId: number; playerId: string }) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const team = await canManageTeam(me, input.teamId)
  if (!team) return { error: "You cannot manage this team." }

  // 1) Drop the roster membership.
  await db
    .update(teamMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.playerId, input.playerId)))

  // 2) Clear the player out of any pairing slots for this team.
  await db
    .update(teamPairings)
    .set({ playerId: null, updatedAt: new Date() })
    .where(and(eq(teamPairings.teamId, input.teamId), eq(teamPairings.playerId, input.playerId)))

  // 3) If the player is no longer active on ANY team, mark them as a free agent
  //    again so they can be picked up / re-assigned without a stale conflict.
  const stillActive = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.playerId, input.playerId), eq(teamMembers.status, "active")))
    .limit(1)
  if (stillActive.length === 0) {
    await db
      .update(user)
      .set({ availability: "available", updatedAt: new Date() })
      .where(eq(user.id, input.playerId))
  }

  await recomputeTeamStats(input.teamId)
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  revalidatePath("/dashboard")
  return { success: "Player removed from team." }
}

// Add a player to a team by email and (optionally) a specific pairing slot.
// If the email already belongs to a registered player, they are added to the
// roster immediately (no approval needed). Otherwise a pending invite is stored,
// an account-creation email is sent, and the membership is resolved when they
// register with that email address.
export async function invitePlayerByEmail(input: {
  teamId: number
  email: string
  /** Player's name, captured on Add Player and shown for a pending invite. */
  name?: string
  /** Playtomic rating, captured on Add Player and applied to the profile on link. */
  playtomicRating?: number | null
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
  const [existingUser] = await db
    .select({ id: user.id, isPlayer: user.isPlayer, firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  let existingPlayer = existingUser

  if (existingPlayer && existingPlayer.isPlayer) {
    // One team per player per season.
    const conflict = await getPlayerSeasonTeamConflict(existingPlayer.id, team.seasonId, input.teamId)
    if (conflict) {
      return {
        error: `${existingPlayer.firstName} already plays for ${conflict.teamName} this season. They must leave that team first.`,
      }
    }
    // Immediate add for an existing player — no approval needed.
    try {
      await joinTeam(input.teamId, existingPlayer.id, {
        category: input.category,
        pairIndex: input.pairIndex,
        slotIndex: input.slotIndex,
      })
    } catch (err) {
      if (err instanceof TeamFullError) return { error: err.message }
      throw err
    }
    // Capture the Playtomic rating on the profile when supplied (used for the
    // team's average rating). Overwrites so the manager's latest input wins.
    if (input.playtomicRating != null && input.playtomicRating > 0) {
      await db
        .update(user)
        .set({ playtomicRating: input.playtomicRating, updatedAt: new Date() })
        .where(eq(user.id, existingPlayer.id))
    }
    await db.insert(notifications).values({
      userId: existingPlayer.id,
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
        invitedName: input.name?.trim() || null,
        invitedRating: input.playtomicRating ?? null,
        category: input.category ?? null,
        pairIndex: input.pairIndex ?? null,
        slotIndex: input.slotIndex ?? null,
      })
      .where(eq(teamInvites.id, already.id))
  } else {
    await db.insert(teamInvites).values({
      teamId: input.teamId,
      email,
      invitedName: input.name?.trim() || null,
      invitedRating: input.playtomicRating ?? null,
      category: input.category ?? null,
      pairIndex: input.pairIndex ?? null,
      slotIndex: input.slotIndex ?? null,
      invitedByUserId: me.id,
      token: randomUUID(),
      status: "pending",
    })
  }

  // Fetch the token we just stored so we can build the accept/decline URLs
  const [storedInvite] = await db
    .select({ token: teamInvites.token })
    .from(teamInvites)
    .where(and(eq(teamInvites.teamId, input.teamId), eq(teamInvites.email, email), eq(teamInvites.status, "pending")))
    .orderBy(desc(teamInvites.createdAt))
    .limit(1)

  const base = appBaseUrl()
  const acceptUrl = `${base}/invite/${storedInvite?.token}`
  const declineUrl = `${base}/invite/${storedInvite?.token}/decline`

  const { subject, html, text } = teamInviteEmail({
    teamName: team.name,
    captainName: me.name,
    acceptUrl,
    declineUrl,
  })
  const { sent } = await sendEmail({ to: email, subject, html, text })
  if (!sent) {
    console.log(`[v0] Team invite for ${email} — Accept: ${acceptUrl} | Decline: ${declineUrl}`)
  }

  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return {
    success: `${email} has been added as pending. They'll join ${team.name} automatically once they create their account.`,
  }
}

/**
 * Fetch all free agents (players on the marketplace) for the Add Player picker.
 * Wrapped as a server action so client components can call it without a fetch.
 */
export async function getFreeAgentsAction() {
  const me = await getCurrentUser()
  if (!me) return []
  return db
    .select({
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      playtomicRating: user.playtomicRating,
      city: user.city,
      province: user.province,
      avatarUrl: user.avatarUrl,
    })
    .from(user)
    .where(eq(user.lookingForTeam, true))
    .orderBy(user.name)
    .limit(200)
}

/**
 * Look up a registered player by email.
 * Returns their display name, Playtomic rating and player ID so the captain's
 * "Add Player" dialog can auto-fill the name and avoid duplicates.
 */
export async function lookupPlayerByEmail(email: string): Promise<{
  found: boolean
  userId?: string
  name?: string
  playtomicRating?: number | null
}> {
  const me = await getCurrentUser()
  if (!me) return { found: false }

  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes("@")) return { found: false }

  const [found] = await db
    .select({
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      playtomicRating: user.playtomicRating,
      isPlayer: user.isPlayer,
    })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1)

  if (!found) return { found: false }

  const displayName = found.firstName
    ? `${found.firstName} ${found.lastName ?? ""}`.trim()
    : found.name

  return {
    found: true,
    userId: found.id,
    name: displayName,
    playtomicRating: found.playtomicRating,
  }
}

/**
 * Send a direct team invitation to a player who is already on the marketplace
 * (i.e. has lookingForTeam = true). Creates a pending teamInvite by email so
 * the existing invite-resolution machinery handles acceptance.
 */
export async function inviteMarketplacePlayer(input: { teamId: number; playerId: string }) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const team = await canManageTeam(me, input.teamId)
  if (!team) return { error: "You cannot manage this team." }

  const [player] = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      isPlayer: user.isPlayer,
      lookingForTeam: user.lookingForTeam,
    })
    .from(user)
    .where(eq(user.id, input.playerId))
    .limit(1)

  if (!player) return { error: "Player not found." }

  // If they're already a registered player, add them straight to the roster.
  if (player.isPlayer) {
    const conflict = await getPlayerSeasonTeamConflict(player.id, team.seasonId, input.teamId)
    if (conflict) {
      return { error: `${player.firstName ?? player.name} already plays for ${conflict.teamName} this season.` }
    }
    try {
      await joinTeam(input.teamId, player.id)
    } catch (err) {
      if (err instanceof TeamFullError) return { error: err.message }
      throw err
    }
    await db.insert(notifications).values({
      userId: player.id,
      type: "team_invite",
      title: "You've been added to a team",
      body: `${team.name} has added you to their squad.`,
      scope: "direct",
    })
    // Clear marketplace flag so they no longer appear as a free agent.
    await db.update(user).set({ lookingForTeam: false, onMarketplace: false }).where(eq(user.id, player.id))
    revalidatePath("/dashboard/captain")
    revalidatePath("/dashboard/org")
    revalidatePath("/dashboard")
    const displayName = player.firstName ? `${player.firstName} ${player.lastName ?? ""}`.trim() : player.name
    return { success: `${displayName} added to ${team.name}.` }
  }

  // Player has an account but no player profile yet — fall back to email invite.
  const displayName = player.firstName ? `${player.firstName} ${player.lastName ?? ""}`.trim() : player.name
  return invitePlayerByEmail({ teamId: input.teamId, email: player.email, name: displayName })
}

export async function cancelInvite(inviteId: number) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  const [invite] = await db
    .select({ id: teamInvites.id, teamId: teamInvites.teamId, email: teamInvites.email, status: teamInvites.status, category: teamInvites.category })
    .from(teamInvites)
    .where(eq(teamInvites.id, inviteId))
    .limit(1)
  if (!invite) return { error: "Invite not found." }
  const team = await canManageTeam(me, invite.teamId)
  if (!team) return { error: "You cannot manage this team." }
  await db.update(teamInvites).set({ status: "cancelled" }).where(eq(teamInvites.id, inviteId))
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return { success: "Invite cancelled." }
}

// Add a player to a team roster (idempotent) and optionally fill a pairing slot.
// Enforces the hard cap of 8 active players — throws TeamFullError when the
// roster is full and the player isn't already an active member.
async function joinTeam(
  teamId: number,
  playerId: string,
  slot?: { category?: string; pairIndex?: number; slotIndex?: number },
) {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, playerId)))
    .limit(1)

  const isAlreadyActive = member?.status === "active"
  if (!isAlreadyActive) {
    // Adding a net-new active member — enforce the 8-player hard cap.
    const active = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))
    if (active.length >= TEAM_SQUAD_SIZE) throw new TeamFullError()
  }

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

/**
 * Process a team invite by token.
 * Returns what should happen next so the server page can redirect appropriately:
 *  - { joined: true }                            → send to dashboard
 *  - { needsProfile: true, token }               → send to onboarding with token
 *  - { needsAccount: true, token, email }        → send to sign-up with token
 *  - { error: string }                           → show error
 */
export async function processTeamInviteByToken(token: string): Promise<
  | { joined: true; teamName: string }
  | { needsProfile: true; token: string; teamName: string }
  | { needsAccount: true; token: string; email: string; teamName: string }
  | { alreadyOnTeam: true; teamName: string }
  | { declined: true }
  | { error: string }
> {
  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.token, token), eq(teamInvites.status, "pending")))
    .limit(1)

  if (!invite) return { error: "This invitation link is invalid or has already been used." }

  const [team] = await db
    .select({ id: teams.id, name: teams.name, seasonId: teams.seasonId })
    .from(teams)
    .where(eq(teams.id, invite.teamId))
    .limit(1)

  if (!team) return { error: "The team for this invitation no longer exists." }

  // Is the invitee already a registered user?
  const [invitedUser] = await db
    .select({ id: user.id, isPlayer: user.isPlayer, firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(eq(user.email, invite.email))
    .limit(1)

  if (!invitedUser) {
    // No account at all — redirect to sign-up preserving the token
    return { needsAccount: true, token, email: invite.email, teamName: team.name }
  }

  if (!invitedUser.isPlayer) {
    // Has an account but no player profile yet — redirect to onboarding
    return { needsProfile: true, token, teamName: team.name }
  }

  // Check for season conflict
  const conflict = await getPlayerSeasonTeamConflict(invitedUser.id, team.seasonId, team.id)
  if (conflict) {
    return { alreadyOnTeam: true, teamName: conflict.teamName }
  }

  // Join the team immediately
  try {
    await joinTeam(team.id, invitedUser.id, {
      category: invite.category ?? undefined,
      pairIndex: invite.pairIndex ?? undefined,
      slotIndex: invite.slotIndex ?? undefined,
    })
  } catch (err) {
    if (err instanceof TeamFullError) return { error: "The team is full." }
    throw err
  }

  if (invite.invitedRating != null && invite.invitedRating > 0) {
    const [prof] = await db.select({ rating: user.playtomicRating }).from(user).where(eq(user.id, invitedUser.id)).limit(1)
    if (!prof?.rating) {
      await db.update(user).set({ playtomicRating: invite.invitedRating }).where(eq(user.id, invitedUser.id))
    }
  }

  await db.update(teamInvites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(teamInvites.id, invite.id))
  await db.update(user).set({ lookingForTeam: false, onMarketplace: false, availability: "unavailable" }).where(eq(user.id, invitedUser.id))

  await db.insert(notifications).values({
    userId: invitedUser.id,
    type: "team_invite",
    title: "You joined a team",
    body: `You have joined ${team.name}.`,
    scope: "direct",
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")

  return { joined: true, teamName: team.name }
}

/**
 * Decline a team invitation by token. Marks it as cancelled.
 */
export async function declineTeamInviteByToken(token: string): Promise<{ ok: boolean; teamName: string; error?: string }> {
  const [invite] = await db
    .select({ id: teamInvites.id, teamId: teamInvites.teamId, status: teamInvites.status })
    .from(teamInvites)
    .where(eq(teamInvites.token, token))
    .limit(1)

  if (!invite) return { ok: false, teamName: "", error: "Invalid invitation link." }
  if (invite.status !== "pending") return { ok: false, teamName: "", error: "This invitation has already been used." }

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, invite.teamId)).limit(1)

  await db.update(teamInvites).set({ status: "cancelled" }).where(eq(teamInvites.id, invite.id))

  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")

  return { ok: true, teamName: team?.name ?? "the team" }
}

// Resolve any pending email invites for a freshly-registered player.
// Called from the onboarding action once a player profile exists.
export async function resolvePendingInvites(email: string, playerId: string) {
  const normalized = email.trim().toLowerCase()
  const pending = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.email, normalized), eq(teamInvites.status, "pending")))

  for (const invite of pending) {
    const [team] = await db
      .select({ id: teams.id, seasonId: teams.seasonId })
      .from(teams)
      .where(eq(teams.id, invite.teamId))
      .limit(1)
    // Respect "one team per player per season": if the player has already been
    // joined to another team in this season (e.g. an earlier pending invite),
    // skip this one and leave it pending so a captain/player can resolve it.
    if (team) {
      const conflict = await getPlayerSeasonTeamConflict(playerId, team.seasonId, invite.teamId)
      if (conflict) continue
    }
    try {
      await joinTeam(invite.teamId, playerId, {
        category: invite.category ?? undefined,
        pairIndex: invite.pairIndex ?? undefined,
        slotIndex: invite.slotIndex ?? undefined,
      })
    } catch (err) {
      // Team filled up before this invite resolved — leave it pending so a
      // manager can make room or cancel it later.
      if (err instanceof TeamFullError) continue
      throw err
    }
    // Carry the Playtomic rating captured at Add Player time onto the new
    // player's profile if they haven't set one themselves.
    if (invite.invitedRating != null && invite.invitedRating > 0) {
      const [prof] = await db
        .select({ rating: user.playtomicRating })
        .from(user)
        .where(eq(user.id, playerId))
        .limit(1)
      if (!prof?.rating) {
        await db
          .update(user)
          .set({ playtomicRating: invite.invitedRating, updatedAt: new Date() })
          .where(eq(user.id, playerId))
      }
    }
    await db
      .update(teamInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id))
  }
  return pending.length
}

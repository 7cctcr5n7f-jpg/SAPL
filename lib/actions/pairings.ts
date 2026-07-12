"use server"

import { db } from "@/lib/db"
import {
  teams,
  teamMembers,
  teamPairings,
  teamInvites,
  user,
  userMeta,
  notifications,
} from "@/lib/db/schema"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { and, eq, desc, ne, not, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { recomputeTeamStats } from "@/lib/engine/team-stats"
import { getPlayerSeasonTeamConflict } from "@/lib/queries-dashboard"
import { sendEmail, teamInviteEmail, appBaseUrl } from "@/lib/email"
import { getAccessContext } from "@/lib/access"
import { TEAM_SQUAD_SIZE, CATEGORY_RULES } from "@/lib/constants"
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

    // Gender enforcement: only male players in Mens categories, only female in Ladies.
    const rule = CATEGORY_RULES.find((r) => r.name === input.category)
    if (rule) {
      const [playerUser] = await db
        .select({ firstName: user.firstName, lastName: user.lastName, gender: user.gender })
        .from(user)
        .where(eq(user.id, input.playerId))
        .limit(1)

      const playerGender = playerUser?.gender ?? null
      const catGender = rule.gender // "male" | "female" | "mixed"

      if (catGender === "male" && playerGender === "female") {
        const name = playerUser ? `${playerUser.firstName ?? ""} ${playerUser.lastName ?? ""}`.trim() : "This player"
        return { error: `${name} is female and cannot be assigned to a Mens category.` }
      }
      if (catGender === "female" && playerGender === "male") {
        const name = playerUser ? `${playerUser.firstName ?? ""} ${playerUser.lastName ?? ""}`.trim() : "This player"
        return { error: `${name} is male and cannot be assigned to a Ladies category.` }
      }
    }
  }

  const existingRows = await db
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

  if (existingRows.length > 0) {
    await db
      .update(teamPairings)
      .set({ playerId: input.playerId, updatedAt: new Date() })
      .where(
        and(
          eq(teamPairings.teamId, input.teamId),
          eq(teamPairings.category, input.category),
          eq(teamPairings.pairIndex, input.pairIndex),
          eq(teamPairings.slotIndex, input.slotIndex),
        ),
      )
  } else {
    await db.insert(teamPairings).values({
      teamId: input.teamId,
      category: input.category,
      pairIndex: input.pairIndex,
      slotIndex: input.slotIndex,
      playerId: input.playerId,
    })
  }

  // Keep ppl_team_members in sync so the permission / availability system stays
  // correct. Adding to a slot = add active member. Clearing a slot = remove if
  // they have no other slots for this team.
  if (input.playerId != null) {
    // Ensure active membership for the player being placed.
    const [member] = await db
      .select({ id: teamMembers.id, status: teamMembers.status })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.playerId, input.playerId)))
      .limit(1)
    if (member) {
      if (member.status !== "active") {
        await db.update(teamMembers).set({ status: "active", updatedAt: new Date() }).where(eq(teamMembers.id, member.id))
      }
    } else {
      await db.insert(teamMembers).values({
        teamId: input.teamId,
        playerId: input.playerId,
        role: "member",
        status: "active",
        initiatedBy: "team",
      })
    }
  } else {
    // Slot was cleared — find the player(s) who were just removed.
    // We only remove their membership if they hold no other pairing slots.
    const clearedPlayerIds = [...new Set(existingRows.map((r) => r.playerId).filter((id): id is string => id != null))]
    for (const clearedPlayerId of clearedPlayerIds) {
      const otherSlots = await db
        .select({ id: teamPairings.id })
        .from(teamPairings)
        .where(
          and(
            eq(teamPairings.teamId, input.teamId),
            eq(teamPairings.playerId, clearedPlayerId),
          ),
        )
      if (otherSlots.length === 0) {
        // No other slots — mark as removed so availability frees up.
        await db
          .update(teamMembers)
          .set({ status: "removed", updatedAt: new Date() })
          .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.playerId, clearedPlayerId)))
        // Mark player as available again if they're on no other active team.
        const stillActive = await db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(and(eq(teamMembers.playerId, clearedPlayerId), eq(teamMembers.status, "active")))
          .limit(1)
        if (stillActive.length === 0) {
          await db
            .update(user)
            .set({ availability: "available", updatedAt: new Date() })
            .where(eq(user.id, clearedPlayerId))
        }
      }
    }
  }

  await recomputeTeamStats(input.teamId)
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/my-team")
  revalidatePath("/admin/teams")
  revalidatePath("/admin/teams")
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

  // 2) Delete the player's pairing slot row for this team entirely.
  // Using DELETE (not UPDATE SET playerId = null) so no ghost rows remain
  // that could be mistakenly overwritten when a new player is added to the
  // same slot, causing unexpected category shifts.
  await db
    .delete(teamPairings)
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
  revalidatePath("/dashboard/my-team")
  revalidatePath("/dashboard")
  revalidatePath("/admin/teams")
  return { success: "Player removed from team." }
}

// Add a player to a team by email and (optionally) a specific pairing slot.
// Always stores a pending invite and sends the player an email with an
// accept/decline link — even if they already have an account. The player must
// explicitly click Accept before they are placed in a pairing slot. This
// applies to both new and existing registered players.
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

  // Check for an existing registered player with this email so we can validate
  // season conflicts upfront — but we no longer add them automatically.
  const [existingUser] = await db
    .select({ id: user.id, isPlayer: user.isPlayer, firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (existingUser?.isPlayer) {
    const active = await getActiveMembership(existingUser.id, input.teamId)
    if (active) {
      return {
        error: `${existingUser.firstName} is already an active team member of ${active.teamName}. They must leave that team first.`,
      }
    }

    // Block the invite early if they are already on another team this season.
    const conflict = await getPlayerSeasonTeamConflict(existingUser.id, team.seasonId, input.teamId)
    if (conflict) {
      return {
        error: `${existingUser.firstName} already plays for ${conflict.teamName} this season. They must leave that team first.`,
      }
    }
  }

  // Always create a pending invite — every player must Accept the invite link
  // before they are placed in a slot, regardless of whether they have an account.
  // Store a pending invite to be resolved on registration.
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
    .select({
      id: teamInvites.id,
      token: teamInvites.token,
      email: teamInvites.email,
      category: teamInvites.category,
      pairIndex: teamInvites.pairIndex,
      slotIndex: teamInvites.slotIndex,
    })
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
  revalidatePath("/dashboard/my-team")
  return {
    success: `Invite sent to ${email}. They are shown as pending in your squad until they accept.`,
    invite: storedInvite
      ? {
          id: storedInvite.id,
          email: storedInvite.email,
          category: storedInvite.category,
          pairIndex: storedInvite.pairIndex,
          slotIndex: storedInvite.slotIndex,
        }
      : null,
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
  * Fetch all registered players who are NOT currently an active member of any
  * team. These are shown in the registered-player tab so a team owner can send
  * them invitations.
  */
  export async function getRegisteredFreeAgentsAction() {
    const me = await getCurrentUser()
    if (!me) return []

    // Subquery: player IDs that are already active on any team.
    const activeMemberIds = (
      await db
        .select({ playerId: teamMembers.playerId })
        .from(teamMembers)
        .where(eq(teamMembers.status, "active"))
    ).map((r) => r.playerId)

  const query = db
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
    .where(
      and(
        // Every user who has completed basic registration (has a firstName set)
        // is eligible. isPlayer and lookingForTeam are unreliable — captains who
        // register a team but don't play, and players invited before completing
        // their profile, may never have those flags set. Using firstName as the
        // minimum signal that the account is real and ready to be assigned.
        sql`${user.firstName} IS NOT NULL AND trim(${user.firstName}) != ''`,
        activeMemberIds.length > 0
          ? not(inArray(user.id, activeMemberIds))
          : undefined,
      ),
    )
    .orderBy(user.firstName)
    .limit(500)

    return query
  }

/**
 * Legacy compatibility shim.
 * Registered players must now always go through the invitation flow.
 */
export async function addRegisteredPlayerDirectly(input: {
  teamId: number
  playerId: string
  category?: string
  pairIndex?: number
  slotIndex?: number
}) {
  return inviteMarketplacePlayer(input)
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
  export async function inviteMarketplacePlayer(input: {
    teamId: number
    playerId: string
    category?: string
    pairIndex?: number
    slotIndex?: number
  }) {
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

  // Always go through the invite flow — the player must accept before being placed.
  const displayName = player.firstName ? `${player.firstName} ${player.lastName ?? ""}`.trim() : player.name
  return invitePlayerByEmail({
    teamId: input.teamId,
    email: player.email,
    name: displayName,
    category: input.category,
    pairIndex: input.pairIndex,
    slotIndex: input.slotIndex,
  })
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
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/my-team")
  revalidatePath("/admin/teams")
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

  if (slot?.category && slot.pairIndex != null && slot.slotIndex != null) {
    // Delete any existing row for this exact slot (including ghost rows where
    // playerId was previously set to null by an old removeFromTeam call).
    // Then insert clean so the player is always placed in exactly the right slot
    // on exactly the right team — no cross-team or cross-category bleed.
    await db
      .delete(teamPairings)
      .where(
        and(
          eq(teamPairings.teamId, teamId),
          eq(teamPairings.category, slot.category),
          eq(teamPairings.pairIndex, slot.pairIndex),
          eq(teamPairings.slotIndex, slot.slotIndex),
        ),
      )
    await db.insert(teamPairings).values({
      teamId,
      category: slot.category,
      pairIndex: slot.pairIndex,
      slotIndex: slot.slotIndex,
      playerId,
    })
  }

  await recomputeTeamStats(teamId)
}

async function markPlayerAsActiveTeamMember(playerId: string) {
  await db
    .update(user)
    .set({ availability: "on_team", lookingForTeam: false, onMarketplace: false, updatedAt: new Date() })
    .where(eq(user.id, playerId))
}

async function getActiveMembership(playerId: string, excludeTeamId?: number) {
  const rows = await db
    .select({ teamId: teamMembers.teamId, teamName: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.playerId, playerId), eq(teamMembers.status, "active")))
    .limit(5)

  const active = excludeTeamId != null ? rows.find((r) => r.teamId !== excludeTeamId) : rows[0]
  return active ?? null
}

async function cancelOtherPendingInvites(email: string, acceptedInviteId: number) {
  const normalized = email.trim().toLowerCase()
  await db
    .update(teamInvites)
    .set({ status: "cancelled" })
    .where(
      and(
        sql`lower(${teamInvites.email}) = ${normalized}`,
        eq(teamInvites.status, "pending"),
        ne(teamInvites.id, acceptedInviteId),
      ),
    )
}

/**
 * Read-only invite preview — fetches metadata needed to render the accept page
 * without mutating any state. Safe to call on every page load / email pre-fetch.
 *
 * Returns one of:
 *  - { ready: true, teamName, captainName, category }  → show Accept / Decline UI
 *  - { already: true, teamName }                       → already accepted, show success
 *  - { needsProfile: true, token }                     → redirect to onboarding
 *  - { needsAccount: true, email, token, teamName }    → redirect to sign-up
 *  - { error: string }                                 → show error
 */
export async function getInvitePreview(
  token: string,
  sessionUserId: string,
): Promise<
  | { ready: true; teamName: string; captainName: string; category: string | null }
  | { already: true; teamName: string }
  | { needsProfile: true; token: string }
  | { needsAccount: true; token: string; email: string; teamName: string }
  | { error: string }
> {
  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.token, token))
    .limit(1)

  if (!invite) return { error: "This invitation link is invalid or has already been used." }

  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.id, invite.teamId))
    .limit(1)

  if (!team) return { error: "The team for this invitation no longer exists." }

  if (invite.status === "cancelled") return { error: "This invitation has been cancelled." }

  // Check the session user's profile status.
  const [sessionUser] = await db
    .select({ id: user.id, isPlayer: user.isPlayer })
    .from(user)
    .where(eq(user.id, sessionUserId))
    .limit(1)

  if (!sessionUser) return { error: "Could not verify your account. Please sign in again." }

  // If the invite was accepted, verify the player is actually on the roster.
  // If the teamMembers row is missing (a prior flow marked the invite accepted
  // without inserting the row), show the Accept UI again so processTeamInviteByToken
  // can repair it.
  if (invite.status === "accepted") {
    const [existingMember] = await db
      .select({ id: teamMembers.id, status: teamMembers.status })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerId, sessionUser.id)))
      .limit(1)

    if (existingMember?.status === "active") {
      return { already: true, teamName: team.name }
    }
    // Fall through to show Accept UI so they can re-trigger processTeamInviteByToken.
  }

  const [meta] = await db
    .select({ id: userMeta.id })
    .from(userMeta)
    .where(eq(userMeta.userId, sessionUserId))
    .limit(1)

  const hasProfile = sessionUser.isPlayer || meta != null
  if (!hasProfile) return { needsProfile: true, token }

  // Captain name for the accept page.
  const captainName = invite.invitedByUserId
    ? await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, invite.invitedByUserId))
        .limit(1)
        .then((rows) => rows[0]?.name ?? "Your captain")
    : "Your captain"

  return {
    ready: true,
    teamName: team.name,
    captainName,
    category: invite.category ?? null,
  }
}

/**
 * Process a team invite by token.
 * Returns what should happen next so the server page can redirect appropriately:
 *  - { joined: true }                            → send to dashboard
 *  - { needsProfile: true, token }               → send to onboarding with token
 *  - { needsAccount: true, token, email }        → send to sign-up with token
 *  - { error: string }                           → show error
 */
export async function processTeamInviteByToken(
  token: string,
  options?: { userId?: string },
): Promise<
  | { joined: true; teamName: string }
  | { needsProfile: true; token: string; teamName: string }
  | { needsAccount: true; token: string; email: string; teamName: string }
  | { alreadyOnTeam: true; teamName: string }
  | { declined: true }
  | { error: string }
> {
  // Fetch the invite without filtering on status so we can handle accepted/
  // cancelled states gracefully (e.g. after onboarding resolves it).
  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.token, token))
    .limit(1)

  if (!invite) return { error: "This invitation link is invalid or has already been used." }

  const [team] = await db
    .select({ id: teams.id, name: teams.name, seasonId: teams.seasonId })
    .from(teams)
    .where(eq(teams.id, invite.teamId))
    .limit(1)

  if (!team) return { error: "The team for this invitation no longer exists." }

  // If the invite was already accepted, verify the player is actually on the
  // team roster. It's possible the invite was marked accepted by a prior flow
  // (e.g. onboarding email match) without the teamMembers row being created,
  // so we check and repair that here rather than silently returning success.
  if (invite.status === "accepted") {
    const resolvedUserId = options?.userId ?? (await getCurrentUser())?.id ?? null
    if (resolvedUserId) {
      const [existingMember] = await db
        .select({ id: teamMembers.id, status: teamMembers.status })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerId, resolvedUserId)))
        .limit(1)

      if (!existingMember || existingMember.status !== "active") {
        // Roster row is missing or stale — add them now.
        try {
          await joinTeam(team.id, resolvedUserId, {
            category: invite.category ?? undefined,
            pairIndex: invite.pairIndex ?? undefined,
            slotIndex: invite.slotIndex ?? undefined,
          })
        } catch (err) {
          if (err instanceof TeamFullError) return { error: "The team is full." }
          throw err
        }
        revalidatePath("/dashboard")
        revalidatePath("/dashboard/captain")
        revalidatePath("/dashboard/my-team")
      }
      await markPlayerAsActiveTeamMember(resolvedUserId)
    }
    await cancelOtherPendingInvites(invite.email, invite.id)
    return { joined: true, teamName: team.name }
  }

  if (invite.status === "cancelled") {
    return { error: "This invitation has been cancelled." }
  }

  let invitedUser: { id: string; isPlayer: boolean } | undefined

  if (options?.userId) {
    const [row] = await db
      .select({ id: user.id, isPlayer: user.isPlayer })
      .from(user)
      .where(eq(user.id, options.userId))
      .limit(1)
    invitedUser = row ?? undefined
  } else {
    // Prefer the currently signed-in user over an email lookup.
    // The invite email and the account email may differ (e.g. iCloud relay vs
    // real address), so we always honour the authenticated session first.
    const sessionUser = await getCurrentUser()
    if (sessionUser) {
      const [row] = await db
        .select({ id: user.id, isPlayer: user.isPlayer })
        .from(user)
        .where(eq(user.id, sessionUser.id))
        .limit(1)
      invitedUser = row ?? undefined
    } else {
      // No session — fall back to matching by invite email
      const [row] = await db
        .select({ id: user.id, isPlayer: user.isPlayer })
        .from(user)
        .where(eq(user.email, invite.email))
        .limit(1)
      invitedUser = row ?? undefined
    }
  }

  if (!invitedUser) {
    if (options?.userId) {
      return { error: "Could not verify your account. Please sign in again." }
    }
    // No account at all — send to sign-up preserving the token
    return { needsAccount: true, token, email: invite.email, teamName: team.name }
  }

  // Check if this user has a player profile. Some users are created via admin
  // assignment and never go through onboarding, so isPlayer may be false even
  // though they have a userMeta row (League Index etc). Check both.
  const [meta] = await db
    .select({ id: userMeta.id })
    .from(userMeta)
    .where(eq(userMeta.userId, invitedUser.id))
    .limit(1)

  const hasProfile = invitedUser.isPlayer || meta != null

  if (!hasProfile) {
    // Has an account but no player profile yet — redirect to onboarding
    return { needsProfile: true, token, teamName: team.name }
  }

  // Check for season conflict
  const active = await getActiveMembership(invitedUser.id, team.id)
  if (active) {
    return { alreadyOnTeam: true, teamName: active.teamName }
  }

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
    const [row] = await db
      .select({ rating: user.playtomicRating })
      .from(user)
      .where(eq(user.id, invitedUser.id))
      .limit(1)
    if (!row?.rating) {
      await db.update(user).set({ playtomicRating: invite.invitedRating }).where(eq(user.id, invitedUser.id))
    }
  }

  await db.update(teamInvites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(teamInvites.id, invite.id))
  await markPlayerAsActiveTeamMember(invitedUser.id)
  await cancelOtherPendingInvites(invite.email, invite.id)

  await db.insert(notifications).values({
    userId: invitedUser.id,
    type: "team_invite",
    title: "You joined a team",
    body: `You have joined ${team.name}.`,
    scope: "direct",
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/my-team")

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
  revalidatePath("/dashboard/my-team")

  return { ok: true, teamName: team?.name ?? "the team" }
}

// Legacy compatibility hook.
// Pending invites are no longer auto-accepted on registration; players must
// explicitly accept one invitation from the invite flow.
export async function resolvePendingInvites(email: string, playerId: string) {
  const normalized = email.trim().toLowerCase()
  const pending = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.email, normalized), eq(teamInvites.status, "pending")))

  void playerId // preserved for call-site compatibility; acceptance now requires explicit invite action.
  return pending.length
}

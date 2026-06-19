"use server"

import { db } from "@/lib/db"
import {
  players,
  teamMembers,
  teamPairings,
  teamInvites,
  fixtureUnavailable,
  feeNotes,
  teams,
  notifications,
  payments,
  user,
  userMeta,
  account,
  session,
} from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { splitVatInclusive } from "@/lib/constants"
import { getPlayerFee } from "@/lib/queries"
import { getManageablePlayerIds, getScopedTeamIdSet } from "@/lib/queries-dashboard"
import { getAccessContext } from "@/lib/access"
import { recomputeTeamStats } from "@/lib/engine/team-stats"

export async function updateProfile(_prev: unknown, formData: FormData) {
  const me = await getCurrentUser()
  if (!me?.playerId) return { error: "Not authorised" }

  const firstName = String(formData.get("firstName") ?? "").trim()
  const lastName = String(formData.get("lastName") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const bio = String(formData.get("bio") ?? "").slice(0, 500)
  const city = String(formData.get("city") ?? "")
  const playtomicUrl = String(formData.get("playtomicUrl") ?? "")
  const lookingForTeam = formData.get("lookingForTeam") === "on"

  if (!firstName || !lastName) return { error: "First and last name are required." }

  // Preferred clubs: "anyClub" checkbox + repeated club id fields.
  const anyClub = formData.get("anyClub") === "on"
  const preferredClubIds = anyClub
    ? []
    : (formData.getAll("preferredClubIds") as string[]).map((v) => Number(v)).filter((n) => Number.isFinite(n))

  await db
    .update(players)
    .set({
      firstName,
      lastName,
      bio,
      city,
      playtomicUrl: playtomicUrl || null,
      preferredClubIds,
      anyClub,
      lookingForTeam,
      availability: lookingForTeam ? "available" : "unavailable",
      updatedAt: new Date(),
    })
    .where(eq(user.id, me.isPlayer))

  // Keep the auth display name in sync with the player's name.
  await db.update(user).set({ name: `${firstName} ${lastName}`, updatedAt: new Date() }).where(eq(user.id, me.id))

  // Contact number lives on userMeta; upsert it.
  const [meta] = await db.select().from(userMeta).where(eq(userMeta.userId, me.id)).limit(1)
  if (meta) {
    await db.update(userMeta).set({ phone: phone || null, updatedAt: new Date() }).where(eq(userMeta.userId, me.id))
  } else {
    await db.insert(userMeta).values({ userId: me.id, phone: phone || null })
  }

  revalidatePath("/dashboard/profile")
  revalidatePath("/dashboard")
  revalidatePath("/marketplace")
  return { success: "Profile updated." }
}

export async function respondToInvite(membershipId: number, accept: boolean) {
  const me = await getCurrentUser()
  if (!me?.playerId) return { error: "Not authorised" }

  const [m] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.id, membershipId), eq(teamMembers.playerId, me.isPlayer)))
    .limit(1)
  if (!m || m.status !== "invited") return { error: "Invitation not found." }

  await db
    .update(teamMembers)
    .set({ status: accept ? "active" : "declined", updatedAt: new Date() })
    .where(eq(teamMembers.id, membershipId))

  if (accept) {
    await db
      .update(players)
      .set({ availability: "on_team", lookingForTeam: false, updatedAt: new Date() })
      .where(eq(user.id, me.isPlayer))

    const [team] = await db.select().from(teams).where(eq(teams.id, m.teamId)).limit(1)
    if (team?.captainUserId) {
      await db.insert(notifications).values({
        userId: team.captainUserId,
        type: "invite_accepted",
        title: "Invitation accepted",
        body: `${me.name} has joined ${team.name}.`,
        scope: "direct",
      })
    }
  }

  revalidatePath("/dashboard")
  return { success: accept ? "You joined the team." : "Invitation declined." }
}

// Mock payment of a player's individual team fee. No real gateway: this
// creates (or updates) an individual payment row and marks it paid.
export async function payTeamFee(teamId: number) {
  const me = await getCurrentUser()
  if (!me?.playerId) return { error: "Not authorised" }

  // Player must actually belong to this team.
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, me.isPlayer), eq(teamMembers.status, "active")))
    .limit(1)
  if (!member) return { error: "You are not an active member of this team." }

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return { error: "Team not found." }
  if (team.clubPaysFees) return { error: "Your club covers this team's fees." }

  const { amount, vatAmount } = splitVatInclusive(await getPlayerFee(team.seasonId))

  const [existing] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.playerId, me.isPlayer), eq(payments.type, "individual")))
    .limit(1)

  if (existing) {
    if (existing.status === "paid") return { success: "This fee is already paid." }
    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date(), provider: "mock" })
      .where(eq(payments.id, existing.id))
  } else {
    await db.insert(payments).values({
      type: "individual",
      payerUserId: me.id,
      playerId: me.isPlayer,
      teamId,
      seasonId: team.seasonId ?? null,
      amount,
      vatAmount,
      currency: "ZAR",
      status: "paid",
      provider: "mock",
      invoiceNumber: `PPL-INV-${Date.now()}`,
      reference: `TEAMFEE-${teamId}-P${me.isPlayer}`,
      description: `Individual team fee — ${team.name}`,
      paidAt: new Date(),
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  return { success: `Payment received for ${team.name}.` }
}

export async function leaveTeam(membershipId: number) {
  const me = await getCurrentUser()
  if (!me?.playerId) return { error: "Not authorised" }
  await db
    .update(teamMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(teamMembers.id, membershipId), eq(teamMembers.playerId, me.isPlayer)))
  revalidatePath("/dashboard")
  return { success: "You left the team." }
}

/**
 * Admin-only inline update of a player's Playtomic rating and League Index from
 * the Player Management dashboard. Players cannot change these themselves.
 */
export async function adminUpdatePlayerRatings(input: {
  playerId: number
  playtomicRating: number | null
  currentLi: number
  playtomicUrl?: string | null
}) {
  const me = await getCurrentUser()
  const allowed = ["super_admin", "org_admin", "captain"]
  if (!me || !allowed.includes(me.role)) return { ok: false, error: "Not authorised" }

  if (input.currentLi < 0 || input.currentLi > 7) return { ok: false, error: "League Index must be between 0 and 7." }
  if (input.playtomicRating != null && (input.playtomicRating < 0 || input.playtomicRating > 7)) {
    return { ok: false, error: "Playtomic rating must be between 0 and 7." }
  }

  const [existing] = await db.select().from(user).where(eq(user.id, input.playerId)).limit(1)
  if (!existing) return { ok: false, error: "Player not found." }

  // Non-league admins may only edit players within their own scope (assigned
  // teams + teams homed at assigned clubs). Verify the actor is allowed here.
  const access = await getAccessContext(me)
  if (!access.can("player_management")) return { ok: false, error: "Not authorised" }
  if (!access.isLeagueAdmin) {
    const scopedIds = await getManageablePlayerIds(access)
    if (!scopedIds.has(input.playerId)) return { ok: false, error: "This player is not in your scope." }
  }

  const url = input.playtomicUrl === undefined ? undefined : input.playtomicUrl?.trim() || null

  await db
    .update(players)
    .set({
      currentLi: input.currentLi,
      highestLi: Math.max(existing.highestLi ?? 0, input.currentLi),
      liDate: new Date(),
      playtomicRating: input.playtomicRating,
      ...(url !== undefined ? { playtomicUrl: url } : {}),
      updatedAt: new Date(),
    })
    .where(eq(user.id, input.playerId))

  revalidatePath("/admin/players")
  revalidatePath("/dashboard")
  revalidatePath("/marketplace")
  return { ok: true }
}

/**
 * Full player edit from Player Management — profile fields plus team membership.
 * Authorised purely through the access context's `player_management` permission
 * and player scope, so club/team managers (whose DB role is still "player") can
 * edit every player on a team within their scope, while league admins can edit
 * anyone. Set `removeFromTeamId` to take the player off one of their teams.
 */
export async function adminUpdatePlayer(input: {
  playerId: number
  firstName?: string
  lastName?: string
  phone?: string | null
  gender?: "male" | "female"
  playtomicRating?: number | null
  currentLi?: number
  playtomicUrl?: string | null
  removeFromTeamId?: number | null
}) {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: "Not authorised" }

  const access = await getAccessContext(me)
  if (!access.can("player_management")) return { ok: false, error: "Not authorised" }

  const [existing] = await db.select().from(user).where(eq(user.id, input.playerId)).limit(1)
  if (!existing) return { ok: false, error: "Player not found." }

  // Scope check: non-league admins may only edit players inside their scope.
  if (!access.isLeagueAdmin) {
    const scopedIds = await getManageablePlayerIds(access)
    if (!scopedIds.has(input.playerId)) return { ok: false, error: "This player is not in your scope." }
  }

  // Validate numeric ranges when provided.
  if (input.currentLi != null && (input.currentLi < 0 || input.currentLi > 7)) {
    return { ok: false, error: "League Index must be between 0 and 7." }
  }
  if (input.playtomicRating != null && (input.playtomicRating < 0 || input.playtomicRating > 7)) {
    return { ok: false, error: "Playtomic rating must be between 0 and 7." }
  }

  const firstName = input.firstName?.trim()
  const lastName = input.lastName?.trim()
  if (input.firstName !== undefined && !firstName) return { ok: false, error: "First name is required." }
  if (input.lastName !== undefined && !lastName) return { ok: false, error: "Last name is required." }

  // Build the profile patch from only the fields that were supplied.
  const patch: Partial<typeof players.$inferSelect> = { updatedAt: new Date() }
  if (firstName !== undefined) patch.firstName = firstName
  if (lastName !== undefined) patch.lastName = lastName
  if (input.gender !== undefined) patch.gender = input.gender
  if (input.playtomicUrl !== undefined) patch.playtomicUrl = input.playtomicUrl?.trim() || null
  if (input.playtomicRating !== undefined) patch.playtomicRating = input.playtomicRating
  if (input.currentLi !== undefined) {
    patch.currentLi = input.currentLi
    patch.highestLi = Math.max(existing.highestLi ?? 0, input.currentLi)
    patch.liDate = new Date()
  }

  await db.update(players).set(patch).where(eq(user.id, input.playerId))

  // Keep the auth display name in sync when the name changed.
  if (firstName !== undefined || lastName !== undefined) {
    const fullName = `${firstName ?? existing.firstName} ${lastName ?? existing.lastName}`.trim()
    await db.update(user).set({ name: fullName, updatedAt: new Date() }).where(eq(user.id, existing.userId))
  }

  // Contact number lives on userMeta; upsert when supplied.
  if (input.phone !== undefined) {
    const phone = input.phone?.trim() || null
    const [meta] = await db.select({ id: userMeta.id }).from(userMeta).where(eq(userMeta.userId, existing.userId)).limit(1)
    if (meta) {
      await db.update(userMeta).set({ phone, updatedAt: new Date() }).where(eq(userMeta.userId, existing.userId))
    } else {
      await db.insert(userMeta).values({ userId: existing.userId, role: "player", phone })
    }
  }

  // Remove the player from one of their teams, if requested and in scope.
  if (input.removeFromTeamId != null) {
    const scopedTeams = await getScopedTeamIdSet(access)
    if (scopedTeams !== null && !scopedTeams.has(input.removeFromTeamId)) {
      return { ok: false, error: "That team is not in your scope." }
    }
    await db
      .update(teamMembers)
      .set({ status: "removed", updatedAt: new Date() })
      .where(and(eq(teamMembers.teamId, input.removeFromTeamId), eq(teamMembers.playerId, input.playerId)))

    // If the player now has no active team, flip them back to looking-for-team.
    const stillActive = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.playerId, input.playerId), eq(teamMembers.status, "active")))
      .limit(1)
    if (stillActive.length === 0) {
      await db
        .update(players)
        .set({ availability: "available", lookingForTeam: true, updatedAt: new Date() })
        .where(eq(user.id, input.playerId))
    }
    await recomputeTeamStats(input.removeFromTeamId)
  }

  revalidatePath("/admin/players")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/captain")
  revalidatePath("/dashboard/org")
  revalidatePath("/marketplace")
  return { ok: true }
}

/**
 * Create a minimal player profile for an existing user account that doesn't
 * have one yet (e.g. an admin account, or someone who never onboarded). Only
 * league admins may do this. The profile seeds from the account's display name
 * so the user immediately becomes a manageable, assignable player everywhere.
 */
export async function adminCreatePlayerProfile(input: {
  userId: string
  firstName?: string
  lastName?: string
  gender?: "male" | "female"
}) {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: "Not authorised" }

  const access = await getAccessContext(me)
  if (!access.isLeagueAdmin) return { ok: false, error: "Only league admins can create player profiles." }

  const [account] = await db.select().from(user).where(eq(user.id, input.userId)).limit(1)
  if (!account) return { ok: false, error: "User account not found." }

  // Guard against duplicates — one profile per user.
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.userId)).limit(1)
  if (existing) return { ok: false, error: "This user already has a player profile.", playerId: existing.id }

  const [nameFirst, ...nameRest] = (account.name ?? "").trim().split(/\s+/)
  const firstName = (input.firstName?.trim() || nameFirst || "Player").trim()
  const lastName = (input.lastName?.trim() || nameRest.join(" ") || "").trim()

  const [created] = await db
    .insert(players)
    .values({
      userId: input.userId,
      firstName,
      lastName,
      gender: input.gender ?? "male",
      province: "Gauteng",
      city: null,
      currentLi: 0,
      highestLi: 0,
      liDate: new Date(),
      currentTpr: 1000,
      highestTpr: 1000,
      playtomicUrl: null,
      preferredFormats: [],
      preferredClubIds: [],
      anyClub: true,
      lookingForTeam: false,
      availability: "unavailable",
      updatedAt: new Date(),
    })
    .returning({ id: user.id })

  // Ensure a userMeta row exists so contact details can be edited later.
  const [meta] = await db.select({ id: userMeta.id }).from(userMeta).where(eq(userMeta.userId, input.userId)).limit(1)
  if (!meta) await db.insert(userMeta).values({ userId: input.userId, role: "player" })

  revalidatePath("/admin/players")
  revalidatePath("/dashboard")
  return { ok: true, playerId: created.id }
}

/**
 * Permanently delete a user and every trace of them: player profile, roster
 * memberships, pairing slots, fixture-unavailability rows, fee notes, payments,
 * notifications, and the Better Auth account/session/user rows. League/super
 * admins only. Demo accounts (@demo.sapl.co.za) can never be deleted, and the
 * actor cannot delete themselves. Returns the count of removed users.
 *
 * Pass `userId` to delete one account, or `all: true` to wipe every non-demo,
 * non-admin user — used for starting a season with a clean sheet.
 */
export async function adminDeleteUsers(input: { userId?: string; all?: boolean }) {
  const me = await getCurrentUser()
  if (!me || me.role !== "super_admin") {
    return { ok: false, error: "Not authorised" }
  }

  // Resolve the target accounts.
  let accounts: { id: string; email: string }[]
  if (input.all) {
    accounts = await db.select({ id: user.id, email: user.email }).from(user)
  } else if (input.userId) {
    accounts = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
  } else {
    return { ok: false, error: "Nothing to delete." }
  }

  // Never delete demo accounts or the acting admin.
  const targets = accounts.filter(
    (a) => !a.email.toLowerCase().endsWith("@demo.sapl.co.za") && a.id !== me.id,
  )
  if (targets.length === 0) return { ok: false, error: "No deletable users matched." }

  const userIds = targets.map((t) => t.id)

  // Map user ids -> player ids so we can clean player-scoped tables.
  const playerRows = await db
    .select({ id: user.id, userId: user.id })
    .from(user)
    .where(inArray(user.id, userIds))
  const playerIds = playerRows.map((p) => p.id)
  const affectedTeamIds = new Set<number>()

  if (playerIds.length > 0) {
    // Track teams these players were on so we can refresh roster counts after.
    const memberRows = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(inArray(teamMembers.playerId, playerIds))
    memberRows.forEach((m) => affectedTeamIds.add(m.teamId))

    await db.delete(teamMembers).where(inArray(teamMembers.playerId, playerIds))
    await db.delete(teamPairings).where(inArray(teamPairings.playerId, playerIds))
    await db.delete(fixtureUnavailable).where(inArray(fixtureUnavailable.playerId, playerIds))
    await db.delete(feeNotes).where(inArray(feeNotes.playerId, playerIds))
    await db.delete(payments).where(inArray(payments.playerId, playerIds))
    await db.delete(players).where(inArray(user.id, playerIds))
  }

  // User-scoped rows.
  await db.delete(payments).where(inArray(payments.payerUserId, userIds))
  await db.delete(notifications).where(inArray(notifications.userId, userIds))
  await db.delete(teamInvites).where(inArray(teamInvites.invitedByUserId, userIds))
  await db.delete(userMeta).where(inArray(userMeta.userId, userIds))

  // Better Auth rows (no cascade in this schema's public tables).
  await db.delete(session).where(inArray(session.userId, userIds))
  await db.delete(account).where(inArray(account.userId, userIds))
  await db.delete(user).where(inArray(user.id, userIds))

  // Recompute team aggregates for any team that lost members.
  for (const teamId of affectedTeamIds) {
    try {
      await recomputeTeamStats(teamId)
    } catch {
      // Non-fatal: stats will be recomputed on the next roster mutation.
    }
  }

  revalidatePath("/admin/players")
  revalidatePath("/dashboard")
  revalidatePath("/marketplace")
  return { ok: true, deleted: targets.length }
}

// ---------------------------------------------------------------------------
// Change own password
// ---------------------------------------------------------------------------

export async function changeOwnPassword(_prev: unknown, formData: FormData) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authenticated" }

  const current = (formData.get("currentPassword") as string | null)?.trim() ?? ""
  const next = (formData.get("newPassword") as string | null)?.trim() ?? ""
  const confirm = (formData.get("confirmPassword") as string | null)?.trim() ?? ""

  if (!current || !next || !confirm) return { error: "All fields are required." }
  if (next.length < 8) return { error: "New password must be at least 8 characters." }
  if (next !== confirm) return { error: "New passwords do not match." }

  try {
    const { auth } = await import("@/lib/auth")
    const ctx = await auth.$context

    // Verify the current password against the stored hash
    const [acct] = await db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, me.id), eq(account.providerId, "credential")))
      .limit(1)

    if (!acct?.password) return { error: "No password account found. Use Forgot Password to set one." }

    const valid = await ctx.password.verify({ hash: acct.password, password: current })
    if (!valid) return { error: "Current password is incorrect." }

    const hashed = await ctx.password.hash(next)
    await ctx.internalAdapter.updatePassword(me.id, hashed)

    return { success: "Password updated successfully." }
  } catch (err) {
    console.error("[changeOwnPassword]", err)
    return { error: "Failed to update password. Please try again." }
  }
}

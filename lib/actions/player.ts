"use server"

import { db } from "@/lib/db"
import { players, teamMembers, teams, notifications, payments } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { splitVatInclusive } from "@/lib/constants"
import { getPlayerFee } from "@/lib/queries"

export async function updateProfile(_prev: unknown, formData: FormData) {
  const me = await getCurrentUser()
  if (!me?.playerId) return { error: "Not authorised" }

  const canEditRatings = me.role === "league_admin" || me.role === "super_admin"

  const bio = String(formData.get("bio") ?? "").slice(0, 500)
  const city = String(formData.get("city") ?? "")
  const playtomicUrl = String(formData.get("playtomicUrl") ?? "")
  const lookingForTeam = formData.get("lookingForTeam") === "on"

  // Preferred clubs: "anyClub" checkbox + repeated club id fields.
  const anyClub = formData.get("anyClub") === "on"
  const preferredClubIds = anyClub
    ? []
    : (formData.getAll("preferredClubIds") as string[]).map((v) => Number(v)).filter((n) => Number.isFinite(n))

  const [existing] = await db.select().from(players).where(eq(players.id, me.playerId)).limit(1)

  // Ratings (LI + Playtomic rating) are league-managed: only admins may change them.
  const ratingUpdate: { currentLi?: number; highestLi?: number; liDate?: Date; playtomicRating?: number | null } = {}
  if (canEditRatings) {
    const currentLi = Number(formData.get("currentLi") ?? existing?.currentLi ?? 0)
    if (currentLi < 0 || currentLi > 7) return { error: "League Index must be between 0 and 7." }
    const rawRating = formData.get("playtomicRating")
    const playtomicRating = rawRating === null || String(rawRating).trim() === "" ? null : Number(rawRating)
    if (playtomicRating != null && (playtomicRating < 0 || playtomicRating > 7)) {
      return { error: "Playtomic rating must be between 0 and 7." }
    }
    ratingUpdate.currentLi = currentLi
    ratingUpdate.highestLi = Math.max(existing?.highestLi ?? 0, currentLi)
    ratingUpdate.liDate = new Date()
    ratingUpdate.playtomicRating = playtomicRating
  }

  await db
    .update(players)
    .set({
      bio,
      city,
      playtomicUrl: playtomicUrl || null,
      preferredClubIds,
      anyClub,
      lookingForTeam,
      availability: lookingForTeam ? "available" : "unavailable",
      updatedAt: new Date(),
      ...ratingUpdate,
    })
    .where(eq(players.id, me.playerId))

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
    .where(and(eq(teamMembers.id, membershipId), eq(teamMembers.playerId, me.playerId)))
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
      .where(eq(players.id, me.playerId))

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
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, me.playerId), eq(teamMembers.status, "active")))
    .limit(1)
  if (!member) return { error: "You are not an active member of this team." }

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return { error: "Team not found." }
  if (team.clubPaysFees) return { error: "Your club covers this team's fees." }

  const { amount, vatAmount } = splitVatInclusive(await getPlayerFee(team.seasonId))

  const [existing] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.playerId, me.playerId), eq(payments.type, "individual")))
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
      playerId: me.playerId,
      teamId,
      seasonId: team.seasonId ?? null,
      amount,
      vatAmount,
      currency: "ZAR",
      status: "paid",
      provider: "mock",
      invoiceNumber: `PPL-INV-${Date.now()}`,
      reference: `TEAMFEE-${teamId}-P${me.playerId}`,
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
    .where(and(eq(teamMembers.id, membershipId), eq(teamMembers.playerId, me.playerId)))
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
}) {
  const me = await getCurrentUser()
  if (me?.role !== "league_admin" && me?.role !== "super_admin") return { ok: false, error: "Not authorised" }

  if (input.currentLi < 0 || input.currentLi > 7) return { ok: false, error: "League Index must be between 0 and 7." }
  if (input.playtomicRating != null && (input.playtomicRating < 0 || input.playtomicRating > 7)) {
    return { ok: false, error: "Playtomic rating must be between 0 and 7." }
  }

  const [existing] = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1)
  if (!existing) return { ok: false, error: "Player not found." }

  await db
    .update(players)
    .set({
      currentLi: input.currentLi,
      highestLi: Math.max(existing.highestLi ?? 0, input.currentLi),
      liDate: new Date(),
      playtomicRating: input.playtomicRating,
      updatedAt: new Date(),
    })
    .where(eq(players.id, input.playerId))

  revalidatePath("/admin/players")
  revalidatePath("/dashboard")
  revalidatePath("/marketplace")
  return { ok: true }
}

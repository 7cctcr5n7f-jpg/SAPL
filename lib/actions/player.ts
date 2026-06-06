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

  const bio = String(formData.get("bio") ?? "").slice(0, 500)
  const city = String(formData.get("city") ?? "")
  const playtomicUrl = String(formData.get("playtomicUrl") ?? "")
  const currentLi = Number(formData.get("currentLi") ?? 0)
  const preferredCategory = String(formData.get("preferredCategory") ?? "")
  const lookingForTeam = formData.get("lookingForTeam") === "on"

  // Formats: subset of ["mixed", "standard"] sent as repeated form fields.
  const preferredFormats = (formData.getAll("preferredFormats") as string[]).filter((f) =>
    ["mixed", "standard"].includes(f),
  )
  // Preferred clubs: "anyClub" checkbox + repeated club id fields.
  const anyClub = formData.get("anyClub") === "on"
  const preferredClubIds = anyClub
    ? []
    : (formData.getAll("preferredClubIds") as string[]).map((v) => Number(v)).filter((n) => Number.isFinite(n))

  if (currentLi < 0 || currentLi > 7) return { error: "League Index must be between 0 and 7." }

  const [existing] = await db.select().from(players).where(eq(players.id, me.playerId)).limit(1)
  const highestLi = Math.max(existing?.highestLi ?? 0, currentLi)

  await db
    .update(players)
    .set({
      bio,
      city,
      playtomicUrl: playtomicUrl || null,
      currentLi,
      highestLi,
      liDate: new Date(),
      preferredCategory: preferredCategory || null,
      preferredFormats,
      preferredClubIds,
      anyClub,
      lookingForTeam,
      availability: lookingForTeam ? "available" : "unavailable",
      updatedAt: new Date(),
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

  revalidatePath("/dashboard/teams")
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

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/teams")
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
  revalidatePath("/dashboard/teams")
  return { success: "You left the team." }
}

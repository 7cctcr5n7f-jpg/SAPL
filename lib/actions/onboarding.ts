"use server"

import { db } from "@/lib/db"
import { players, userMeta } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { resolvePendingInvites } from "@/lib/actions/pairings"

export type OnboardingState = { error?: string; success?: boolean }

export async function createPlayerProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser()

  const firstName = String(formData.get("firstName") ?? "").trim()
  const lastName = String(formData.get("lastName") ?? "").trim()
  const gender = String(formData.get("gender") ?? "male")
  const playtomicUrl = String(formData.get("playtomicUrl") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const lookingForTeam = formData.get("lookingForTeam") === "on"

  // League Index, province, city and preferred formats are no longer collected
  // here — players can't set their own LI. These default and are managed later
  // by a league admin under Player Management.
  const li = 0
  const province = "Gauteng"
  const city = ""
  const preferredFormats: string[] = []
  const anyClub = formData.get("anyClub") === "on"
  const preferredClubIds = anyClub
    ? []
    : (formData.getAll("preferredClubIds") as string[]).map((v) => Number(v)).filter((n) => Number.isFinite(n))

  if (!firstName || !lastName) return { error: "First and last name are required." }

  // Ensure user_meta exists (default role: player)
  const [existingMeta] = await db.select().from(userMeta).where(eq(userMeta.userId, user.id)).limit(1)
  if (existingMeta) {
    await db.update(userMeta).set({ phone, updatedAt: new Date() }).where(eq(userMeta.userId, user.id))
  } else {
    await db.insert(userMeta).values({ userId: user.id, role: "player", phone })
  }

  // Upsert player profile scoped to this user
  const [existing] = await db.select().from(players).where(eq(players.userId, user.id)).limit(1)
  const values = {
    firstName,
    lastName,
    gender,
    province,
    city: city || null,
    currentLi: li,
    highestLi: li,
    liDate: new Date(),
    currentTpr: 1000,
    highestTpr: 1000,
    playtomicUrl: playtomicUrl || null,
    preferredFormats,
    preferredClubIds,
    anyClub,
    lookingForTeam,
    availability: lookingForTeam ? ("available" as const) : ("unavailable" as const),
    updatedAt: new Date(),
  }

  let playerId: number
  if (existing) {
    await db.update(players).set(values).where(eq(players.userId, user.id))
    playerId = existing.id
  } else {
    const [created] = await db.insert(players).values({ userId: user.id, ...values }).returning({ id: players.id })
    playerId = created.id
  }

  // Auto-join any teams that invited this email address.
  try {
    await resolvePendingInvites(user.email, playerId)
  } catch (err) {
    console.log("[v0] resolvePendingInvites failed:", err)
  }

  revalidatePath("/dashboard")
  return { success: true }
}

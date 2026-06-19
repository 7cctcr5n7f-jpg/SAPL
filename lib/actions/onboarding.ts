"use server"

import { db } from "@/lib/db"
import { user, userMeta } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { resolvePendingInvites } from "@/lib/actions/pairings"

export type OnboardingState = { error?: string; success?: boolean }

export async function createPlayerProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const currentUser = await requireUser()

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
  const [existingMeta] = await db.select().from(userMeta).where(eq(userMeta.userId, currentUser.id)).limit(1)
  if (existingMeta) {
    await db.update(userMeta).set({ phone, updatedAt: new Date() }).where(eq(userMeta.userId, currentUser.id))
  } else {
    await db.insert(userMeta).values({ userId: currentUser.id, role: "player", phone })
  }

  // Update user profile with player data
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
    isPlayer: true,
    updatedAt: new Date(),
  }

  await db.update(user).set(values).where(eq(user.id, currentUser.id))

  // Auto-join any teams that invited this email address.
  try {
    await resolvePendingInvites(currentUser.email, currentUser.id)
  } catch (err) {
    console.log("[v0] resolvePendingInvites failed:", err)
  }

  revalidatePath("/dashboard")
  return { success: true }
}

"use server"

import { db } from "@/lib/db"
import { sponsors, settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"

// League sponsor management is restricted to league/super admins.
async function requireLeagueAdmin() {
  return requireRole(["league_admin", "super_admin"])
}

function revalidateSponsorSurfaces() {
  revalidatePath("/admin/sponsors")
  revalidatePath("/sponsors")
  revalidatePath("/")
  revalidatePath("/league-centre")
}

export async function upsertLeagueSponsor(formData: FormData) {
  await requireLeagueAdmin()
  const id = formData.get("id") ? Number(formData.get("id")) : null
  const name = String(formData.get("name") ?? "").trim()
  const level = String(formData.get("level") ?? "Partner")
  const website = String(formData.get("website") ?? "").trim() || null
  const description = String(formData.get("description") ?? "").trim() || null
  const tagline = String(formData.get("tagline") ?? "").trim() || null
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null
  const mainSponsor = formData.get("mainSponsor") === "on" || formData.get("mainSponsor") === "true"
  if (!name) return { error: "Sponsor name is required" }

  // Only one main sponsor at a time — clear the flag elsewhere when this one is set.
  if (mainSponsor) {
    await db.update(sponsors).set({ mainSponsor: false })
  }

  if (id) {
    await db
      .update(sponsors)
      .set({ name, level, website, description, tagline, logoUrl, mainSponsor })
      .where(eq(sponsors.id, id))
  } else {
    await db
      .insert(sponsors)
      .values({ name, level, website, description, tagline, logoUrl, mainSponsor, tier: "league", active: true })
  }
  revalidateSponsorSurfaces()
  return { success: true }
}

export async function removeLeagueSponsor(formData: FormData) {
  await requireLeagueAdmin()
  const id = Number(formData.get("id"))
  await db.delete(sponsors).where(eq(sponsors.id, id))
  revalidateSponsorSurfaces()
  return { success: true }
}

export async function toggleLeagueSponsorActive(id: number, active: boolean) {
  await requireLeagueAdmin()
  await db.update(sponsors).set({ active }).where(eq(sponsors.id, id))
  revalidateSponsorSurfaces()
  return { success: true }
}

export async function updatePrizePool(formData: FormData) {
  await requireLeagueAdmin()
  const value = String(formData.get("prizePool") ?? "").trim()
  const label = String(formData.get("prizePoolLabel") ?? "").trim() || "Total Prize Pool"

  await db
    .insert(settings)
    .values({ key: "prize_pool", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
  await db
    .insert(settings)
    .values({ key: "prize_pool_label", value: label })
    .onConflictDoUpdate({ target: settings.key, set: { value: label, updatedAt: new Date() } })

  revalidateSponsorSurfaces()
  return { success: true }
}

"use server"

import { db } from "@/lib/db"
import { sponsors } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"

// League sponsor management is restricted to league/super admins.
async function requireLeagueAdmin() {
  return requireRole(["league_admin", "super_admin"])
}

export async function upsertLeagueSponsor(formData: FormData) {
  await requireLeagueAdmin()
  const id = formData.get("id") ? Number(formData.get("id")) : null
  const name = String(formData.get("name") ?? "").trim()
  const level = String(formData.get("level") ?? "Partner")
  const website = String(formData.get("website") ?? "").trim() || null
  const description = String(formData.get("description") ?? "").trim() || null
  if (!name) return { error: "Sponsor name is required" }

  if (id) {
    await db.update(sponsors).set({ name, level, website, description }).where(eq(sponsors.id, id))
  } else {
    await db.insert(sponsors).values({ name, level, website, description, tier: "league", active: true })
  }
  revalidatePath("/admin/sponsors")
  revalidatePath("/sponsors")
  return { success: true }
}

export async function removeLeagueSponsor(formData: FormData) {
  await requireLeagueAdmin()
  const id = Number(formData.get("id"))
  await db.delete(sponsors).where(eq(sponsors.id, id))
  revalidatePath("/admin/sponsors")
  revalidatePath("/sponsors")
  return { success: true }
}

export async function toggleLeagueSponsorActive(id: number, active: boolean) {
  await requireLeagueAdmin()
  await db.update(sponsors).set({ active }).where(eq(sponsors.id, id))
  revalidatePath("/admin/sponsors")
  revalidatePath("/sponsors")
  return { success: true }
}

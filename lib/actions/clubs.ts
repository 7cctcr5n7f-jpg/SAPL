"use server"

import { db } from "@/lib/db"
import { clubs, organisations, teams, userMeta } from "@/lib/db/schema"
import { and, asc, eq, ne } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { clampHostingCapacity } from "@/lib/constants"
import { reconcileClubTeams } from "@/lib/club-teams"

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Venue management is a league-admin task. Organisations are no longer surfaced
// in the UI, so we only require an admin (or, for an existing venue, its org owner).
async function requireClubManager(organisationId?: number) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  if (user.role === "league_admin" || user.role === "super_admin" || user.realRole === "super_admin") {
    return user
  }
  const [meta] = await db.select().from(userMeta).where(eq(userMeta.userId, user.id)).limit(1)
  if (meta?.role === "league_admin") return user
  if (organisationId) {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, organisationId)).limit(1)
    if (org?.ownerUserId === user.id) return user
  }
  throw new Error("Not authorised to manage venues")
}

// Every club row still needs an owning organisation FK in the database even
// though it is no longer chosen in the UI. Fall back to the first organisation.
async function defaultOrganisationId(): Promise<number> {
  const [org] = await db.select({ id: organisations.id }).from(organisations).orderBy(asc(organisations.id)).limit(1)
  if (!org) throw new Error("No organisation exists to own this venue")
  return org.id
}

async function ensureUniqueSlug(base: string, ignoreId?: number) {
  let slug = base || "venue"
  let n = 1
  while (true) {
    const rows = await db
      .select({ id: clubs.id })
      .from(clubs)
      .where(ignoreId ? and(eq(clubs.slug, slug), ne(clubs.id, ignoreId)) : eq(clubs.slug, slug))
      .limit(1)
    if (!rows.length) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

type ClubInput = {
  id?: number
  name: string
  description?: string
  address?: string
  saplRegion?: string
  courts: number
  hostingCapacity?: number
  hostsThursday: boolean
  teamsEntering: number
  logoUrl?: string
  playtomicUrl?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export async function saveClub(input: ClubInput) {
  // For an existing venue, scope the permission check to its current org owner.
  let existingOrgId: number | undefined
  if (input.id) {
    const [existing] = await db.select({ organisationId: clubs.organisationId }).from(clubs).where(eq(clubs.id, input.id)).limit(1)
    existingOrgId = existing?.organisationId
  }
  try {
    await requireClubManager(existingOrgId)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Venue name is required" }

  const courts = Math.max(0, Math.floor(input.courts || 0))
  // SAPL: capacity is auto-derived from courts (one fixture = 4 courts, two
  // slots a night). Venue managers may LOWER it below the court count but never
  // raise it above — `clampHostingCapacity` enforces [0, courts].
  const hostingCapacity = clampHostingCapacity(courts, input.hostingCapacity)

  const saplRegion = input.saplRegion || null
  const teamsEntering = Math.max(0, Math.floor(input.teamsEntering || 0))
  const hostsThursday = !!input.hostsThursday

  const values = {
    name,
    description: input.description?.trim() || null,
    address: input.address?.trim() || null,
    saplRegion,
    courts,
    hostingCapacity,
    hostsThursday,
    teamsEntering,
    logoUrl: input.logoUrl?.trim() || null,
    playtomicUrl: input.playtomicUrl?.trim() || null,
    contactName: input.contactName?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    updatedAt: new Date(),
  }

  let clubId: number
  if (input.id) {
    const slug = await ensureUniqueSlug(slugify(name), input.id)
    await db.update(clubs).set({ ...values, slug }).where(eq(clubs.id, input.id))
    clubId = input.id
  } else {
    const organisationId = existingOrgId ?? (await defaultOrganisationId())
    const slug = await ensureUniqueSlug(slugify(name))
    const [created] = await db
      .insert(clubs)
      .values({ organisationId, slug, ...values })
      .returning({ id: clubs.id })
    clubId = created.id
  }

  // Reconcile the venue's entered teams against `teamsEntering`. This creates
  // unassigned A/B teams when the count goes up and removes the extras (B
  // first) when it goes down — on both create and edit, from the admin portal
  // or the club owner's own venue management.
  await reconcileClubTeams(clubId)

  revalidatePath("/admin/clubs")
  revalidatePath("/clubs")
  revalidatePath("/dashboard/org")
  revalidatePath("/admin")
  return { ok: true }
}

export async function deleteClub(id: number) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, id)).limit(1)
  if (!club) return { ok: false, error: "Venue not found" }
  try {
    await requireClubManager(club.organisationId)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  // Detach any teams that used this venue so we never orphan a homeClubId.
  await db.update(teams).set({ homeClubId: null }).where(eq(teams.homeClubId, id))
  await db.delete(clubs).where(eq(clubs.id, id))
  revalidatePath("/admin/clubs")
  revalidatePath("/clubs")
  return { ok: true }
}

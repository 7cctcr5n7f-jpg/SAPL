import { db } from "@/lib/db"
import { clubs, organisations, teams } from "@/lib/db/schema"
import { asc, eq, inArray } from "drizzle-orm"

export type ClubRow = {
  id: number
  organisationId: number
  orgName: string
  name: string
  slug: string | null
  description: string | null
  address: string | null
  saplRegion: string | null
  courts: number
  hostingCapacity: number
  hostsThursday: boolean
  teamsEntering: number
  logoUrl: string | null
  playtomicUrl: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  ownerUserId: string | null
  // Derived hosting usage. When the venue does not host on Thursdays it cannot
  // host fixtures, so `hosts` is false and used/remaining are not meaningful.
  hosts: boolean
  used: number
  remaining: number
}

/**
 * Returns every club/venue with its organisation name and derived hosting usage.
 * `used` = number of teams whose home venue is this club. `remaining` =
 * hostingCapacity - used (clamped at 0).
 */
export async function getClubsWithUsage(organisationId?: number): Promise<ClubRow[]> {
  const baseRows = organisationId
    ? await db
        .select({
          id: clubs.id,
          organisationId: clubs.organisationId,
          orgName: organisations.name,
          name: clubs.name,
          slug: clubs.slug,
          description: clubs.description,
          address: clubs.address,
          saplRegion: clubs.saplRegion,
          courts: clubs.courts,
          hostingCapacity: clubs.hostingCapacity,
          hostsThursday: clubs.hostsThursday,
          teamsEntering: clubs.teamsEntering,
          logoUrl: clubs.logoUrl,
          playtomicUrl: clubs.playtomicUrl,
          contactName: clubs.contactName,
          contactEmail: clubs.contactEmail,
          contactPhone: clubs.contactPhone,
          ownerUserId: clubs.ownerUserId,
        })
        .from(clubs)
        .leftJoin(organisations, eq(clubs.organisationId, organisations.id))
        .where(eq(clubs.organisationId, organisationId))
        .orderBy(asc(clubs.name))
    : await db
        .select({
          id: clubs.id,
          organisationId: clubs.organisationId,
          orgName: organisations.name,
          name: clubs.name,
          slug: clubs.slug,
          description: clubs.description,
          address: clubs.address,
          saplRegion: clubs.saplRegion,
          courts: clubs.courts,
          hostingCapacity: clubs.hostingCapacity,
          hostsThursday: clubs.hostsThursday,
          teamsEntering: clubs.teamsEntering,
          logoUrl: clubs.logoUrl,
          playtomicUrl: clubs.playtomicUrl,
          contactName: clubs.contactName,
          contactEmail: clubs.contactEmail,
          contactPhone: clubs.contactPhone,
          ownerUserId: clubs.ownerUserId,
        })
        .from(clubs)
        .leftJoin(organisations, eq(clubs.organisationId, organisations.id))
        .orderBy(asc(clubs.name))

  const ids = baseRows.map((c) => c.id)
  const usageMap = new Map<number, number>()
  if (ids.length) {
    const teamRows = await db
      .select({ homeClubId: teams.homeClubId })
      .from(teams)
      .where(inArray(teams.homeClubId, ids))
    for (const t of teamRows) {
      if (t.homeClubId == null) continue
      usageMap.set(t.homeClubId, (usageMap.get(t.homeClubId) ?? 0) + 1)
    }
  }

  return baseRows.map((c) => {
    // Teams homed here already include the venue's own entered teams (created
    // with this club as their home). A venue entering teams therefore consumes
    // its own hosting slots — guarantee that by taking the larger of the two.
    const homed = usageMap.get(c.id) ?? 0
    const used = Math.max(homed, c.teamsEntering ?? 0)
    return {
      ...c,
      orgName: c.orgName ?? "—",
      hosts: c.hostsThursday,
      used,
      remaining: Math.max(0, c.hostingCapacity - used),
    }
  })
}

/** Organisations available as the parent for a new venue. */
export async function getOrganisationOptions() {
  return db
    .select({ id: organisations.id, name: organisations.name })
    .from(organisations)
    .orderBy(asc(organisations.name))
}

export async function getClubBySlug(slug: string) {
  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1)
  return club ?? null
}

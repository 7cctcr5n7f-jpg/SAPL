import { db } from "@/lib/db"
import { clubs, organisations, teams, players } from "@/lib/db/schema"
import { asc, eq, inArray } from "drizzle-orm"

export type ClubTeamBlock = {
  teamId: number
  name: string
  captainUserId: string | null
  captainName: string | null
  divisionId: number | null
}

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
  courtSlots: string[]
  hostingCapacity: number
  hostsThursday: boolean
  teamsEntering: number
  publicSlots: number
  logoUrl: string | null
  playtomicUrl: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  ownerUserId: string | null
  // The venue's own entered teams (Club Team blocks homed here), in creation
  // order, each with its assigned captain (if any).
  clubTeams: ClubTeamBlock[]
  // Derived hosting usage. When the venue does not host on Thursdays it cannot
  // host fixtures, so `hosts` is false and used/remaining are not meaningful.
  hosts: boolean
  used: number
  remaining: number
}

const clubColumns = {
  id: clubs.id,
  organisationId: clubs.organisationId,
  orgName: organisations.name,
  name: clubs.name,
  slug: clubs.slug,
  description: clubs.description,
  address: clubs.address,
  saplRegion: clubs.saplRegion,
  courts: clubs.courts,
  courtSlots: clubs.courtSlots,
  hostingCapacity: clubs.hostingCapacity,
  hostsThursday: clubs.hostsThursday,
  teamsEntering: clubs.teamsEntering,
  publicSlots: clubs.publicSlots,
  logoUrl: clubs.logoUrl,
  playtomicUrl: clubs.playtomicUrl,
  contactName: clubs.contactName,
  contactEmail: clubs.contactEmail,
  contactPhone: clubs.contactPhone,
  ownerUserId: clubs.ownerUserId,
}

/**
 * Returns every club/venue with its organisation name and derived hosting usage.
 * `used` = number of teams whose home venue is this club. `remaining` =
 * hostingCapacity - used (clamped at 0).
 */
export async function getClubsWithUsage(organisationId?: number): Promise<ClubRow[]> {
  const baseRows = organisationId
    ? await db
        .select(clubColumns)
        .from(clubs)
        .leftJoin(organisations, eq(clubs.organisationId, organisations.id))
        .where(eq(clubs.organisationId, organisationId))
        .orderBy(asc(clubs.name))
    : await db
        .select(clubColumns)
        .from(clubs)
        .leftJoin(organisations, eq(clubs.organisationId, organisations.id))
        .orderBy(asc(clubs.name))

  const ids = baseRows.map((c) => c.id)
  const usageMap = new Map<number, number>()
  // venueId -> ordered list of its own Club Team blocks
  const clubTeamsMap = new Map<number, ClubTeamBlock[]>()
  if (ids.length) {
    const teamRows = await db
      .select({
        id: teams.id,
        name: teams.name,
        homeClubId: teams.homeClubId,
        teamType: teams.teamType,
        captainUserId: teams.captainUserId,
        divisionId: teams.divisionId,
      })
      .from(teams)
      .where(inArray(teams.homeClubId, ids))
      .orderBy(asc(teams.id))

    // Resolve captain display names in one pass.
    const captainIds = Array.from(
      new Set(teamRows.map((t) => t.captainUserId).filter((v): v is string => !!v)),
    )
    const captainName = new Map<string, string>()
    if (captainIds.length) {
      const pRows = await db
        .select({ userId: players.userId, firstName: players.firstName, lastName: players.lastName })
        .from(players)
        .where(inArray(players.userId, captainIds))
      for (const p of pRows) captainName.set(p.userId, `${p.firstName} ${p.lastName}`.trim())
    }

    for (const t of teamRows) {
      if (t.homeClubId == null) continue
      usageMap.set(t.homeClubId, (usageMap.get(t.homeClubId) ?? 0) + 1)
      if (t.teamType === "Club Team") {
        const list = clubTeamsMap.get(t.homeClubId) ?? []
        list.push({
          teamId: t.id,
          name: t.name,
          captainUserId: t.captainUserId ?? null,
          captainName: t.captainUserId ? (captainName.get(t.captainUserId) ?? null) : null,
          divisionId: t.divisionId ?? null,
        })
        clubTeamsMap.set(t.homeClubId, list)
      }
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
      courtSlots: Array.isArray(c.courtSlots) ? c.courtSlots : [],
      clubTeams: clubTeamsMap.get(c.id) ?? [],
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

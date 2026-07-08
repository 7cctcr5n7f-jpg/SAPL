import { db } from "@/lib/db"
import { clubs, organisations, teams, user as user, teamMembers } from "@/lib/db/schema"
import { asc, eq, inArray, sql, and } from "drizzle-orm"

export type PlayerOption = {
  id: number
  name: string
  currentLi: number
  lookingForTeam: boolean
  /** Id of the team this player is on an active roster of, or null if free. */
  activeTeamId: number | null
}

/** Lightweight player list for captain pickers (only players with an account). */
export async function getPlayerOptions(): Promise<PlayerOption[]> {
  const rows = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      currentLi: user.currentLi,
      lookingForTeam: user.lookingForTeam,
      userId: user.id,
    })
    .from(user)
    .where(sql`${user.id} is not null`)
    .orderBy(asc(user.firstName), asc(user.lastName))
    .limit(2000)

  // Map each player to the team they're actively rostered on (if any), so the
  // captain picker can offer only genuinely available players plus the team's
  // own current captain.
  const activeMembers = await db
    .select({ playerId: teamMembers.playerId, teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.status, "active"))
  const activeTeamByPlayer = new Map<number, number>()
  for (const m of activeMembers) {
    if (!activeTeamByPlayer.has(m.playerId)) activeTeamByPlayer.set(m.playerId, m.teamId)
  }

  return rows.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    currentLi: p.currentLi ?? 0,
    lookingForTeam: !!p.lookingForTeam,
    activeTeamId: activeTeamByPlayer.get(p.id) ?? null,
  }))
}

export type ClubTeamBlock = {
  teamId: number
  name: string
  captainUserId: string | null
  captainName: string | null
  ownerEmail: string | null
  ownerName: string | null
  ownerPhone: string | null
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
  slotTimeslots: string[]
  hostTimeslots: string[]
  hostingCapacity: number
  hostsThursday: boolean
  teamsEntering: number
  publicSlots: number
  logoUrl: string | null
  playtomicUrl: string | null
  contactName: string | null
  contactEmail: string | null
  contactEmail2: string | null
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
  // How many of this venue's PUBLIC slots are still open for an external team
  // to claim as its home venue (publicSlots - public teams already homed here).
  publicRemaining: number
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
  slotTimeslots: clubs.slotTimeslots,
  hostTimeslots: clubs.hostTimeslots,
  hostingCapacity: clubs.hostingCapacity,
  hostsThursday: clubs.hostsThursday,
  teamsEntering: clubs.teamsEntering,
  publicSlots: clubs.publicSlots,
  logoUrl: clubs.logoUrl,
  playtomicUrl: clubs.playtomicUrl,
  contactName: clubs.contactName,
  contactEmail: clubs.contactEmail,
  contactEmail2: clubs.contactEmail2,
  contactPhone: clubs.contactPhone,
  ownerUserId: clubs.ownerUserId,
}

/**
 * Returns every club/venue with its organisation name and derived hosting usage.
 * `used` = number of teams whose home venue is this club. `remaining` =
 * hostingCapacity - used (clamped at 0).
 *
 * @param organisationId   Optionally restrict to a single organisation.
 * @param restrictClubIds  When provided (non-null), only these club ids are
 *                         returned — used to scope club admins to their assigned
 *                         clubs. An empty array returns no clubs.
 */
export async function getClubsWithUsage(
  organisationId?: number,
  restrictClubIds?: number[] | null,
): Promise<ClubRow[]> {
  if (restrictClubIds != null && restrictClubIds.length === 0) return []

  const conditions = []
  if (organisationId) conditions.push(eq(clubs.organisationId, organisationId))
  if (restrictClubIds != null) conditions.push(inArray(clubs.id, restrictClubIds))

  const baseRows = await db
    .select(clubColumns)
    .from(clubs)
    .leftJoin(organisations, eq(clubs.organisationId, organisations.id))
    .where(conditions.length ? and(...conditions) : undefined)
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
        ownerEmail: teams.ownerEmail,
        ownerName: teams.ownerName,
        ownerPhone: teams.ownerPhone,
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
        .select({ userId: user.id, firstName: user.firstName, lastName: user.lastName })
        .from(user)
        .where(inArray(user.id, captainIds))
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
          ownerEmail: t.ownerEmail ?? null,
          ownerName: t.ownerName ?? null,
          ownerPhone: t.ownerPhone ?? null,
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
    // Public teams homed here = total homed minus the venue's own entered teams.
    const publicUsed = Math.max(0, homed - (c.teamsEntering ?? 0))
    return {
      ...c,
      orgName: c.orgName ?? "—",
      courtSlots: Array.isArray(c.courtSlots) ? c.courtSlots : [],
      slotTimeslots: Array.isArray(c.slotTimeslots) ? c.slotTimeslots : [],
      hostTimeslots: Array.isArray(c.hostTimeslots) ? c.hostTimeslots : [],
      clubTeams: clubTeamsMap.get(c.id) ?? [],
      hosts: c.hostsThursday,
      used,
      remaining: Math.max(0, c.hostingCapacity - used),
      publicRemaining: Math.max(0, (c.publicSlots ?? 0) - publicUsed),
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
  const [club] = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, slug)).limit(1)
  return club ?? null
}

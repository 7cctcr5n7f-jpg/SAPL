"use server"

import { db } from "@/lib/db"
import { clubs, organisations, teams, teamMembers, user as user, userMeta } from "@/lib/db/schema"
import { and, asc, eq, ne } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { revalidatePath } from "next/cache"
import { normaliseCourtSlots, deriveSlotCounts, normaliseSlotTimeslots, deriveHostTimeslots, type CourtSlotMode } from "@/lib/constants"
import { reconcileClubTeams } from "@/lib/club-teams"
import { isSeasonLocked } from "@/lib/season-lock"

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Venue management authority. League/super admins may manage any venue. A club
// manager assigned to a specific venue — via the venue's contact email (auto)
// or a manual Members & Roles assignment — may manage that venue. For an
// existing venue we authorise on the clubId (the contact-email assignment),
// falling back to org ownership; for a brand-new venue (no clubId yet) only
// league admins or the requested owner org may create it.
async function requireClubManager(opts: { clubId?: number; organisationId?: number }) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")

  const ctx = await getAccessContext(user)
  if (ctx.isLeagueAdmin) return user

  // Club manager scoped to this exact venue (contact-email or manual assignment).
  if (opts.clubId != null && ctx.can("club_management") && ctx.canManageClub(opts.clubId)) {
    return user
  }

  // Fall back to organisation ownership (legacy org-owner dashboards / venue creation).
  if (opts.organisationId != null) {
    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, opts.organisationId))
      .limit(1)
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
  // For a NEW venue created from a club-owner dashboard, the organisation it
  // belongs to. Ignored for existing venues and falls back to the default org.
  organisationId?: number
  name: string
  description?: string
  address?: string
  saplRegion?: string
  courts: number
  // Ordered per-court mode list. Length should match `courts`; it is normalised
  // server-side so capacity/teams/public counts can never disagree with it.
  courtSlots: (CourtSlotMode | string)[]
  // Per-court hosting time choice aligned to courtSlots ("17:00"|"18:30"|"both"
  // for hosting courts). Normalised server-side; venues with <4 courts are
  // forced to "both".
  slotTimeslots?: (string | null)[]
  logoUrl?: string
  playtomicUrl?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export async function saveClub(input: ClubInput) {
  // Scope the permission check to the venue's org: its current owner for an
  // existing venue, or the requested owner org for a new one.
  let existingOrgId: number | undefined
  if (input.id) {
    const [existing] = await db.select({ organisationId: clubs.organisationId }).from(clubs).where(eq(clubs.id, input.id)).limit(1)
    existingOrgId = existing?.organisationId
  } else if (input.organisationId) {
    existingOrgId = input.organisationId
  }
  try {
    await requireClubManager({ clubId: input.id, organisationId: existingOrgId })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Venue name is required" }

  const courts = Math.max(0, Math.floor(input.courts || 0))
  // SAPL: each court is a slot set to team / public / no-host. Capacity, the
  // teams-entering count and the public-slot count are all DERIVED from the
  // slot list so they can never disagree. One team/public slot per court means
  // capacity is naturally bounded by the court count.
  const slots = normaliseCourtSlots(courts, input.courtSlots)
  const { teamsEntering, publicSlots, hostingCapacity, hostsThursday } = deriveSlotCounts(slots)
  // Hosting times per slot (forced to "both" under 4 courts), plus the venue's
  // derived union of league-night slots it will host.
  const slotTimeslots = normaliseSlotTimeslots(courts, slots, input.slotTimeslots)
  const hostTimeslots = deriveHostTimeslots(slotTimeslots)

  const saplRegion = input.saplRegion || null

  const values = {
    name,
    description: input.description?.trim() || null,
    address: input.address?.trim() || null,
    saplRegion,
    courts,
    courtSlots: slots,
    slotTimeslots,
    hostTimeslots,
    hostingCapacity,
    hostsThursday,
    teamsEntering,
    publicSlots,
    logoUrl: input.logoUrl?.trim() || null,
    playtomicUrl: input.playtomicUrl?.trim() || null,
    contactName: input.contactName?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    updatedAt: new Date(),
  }

  let clubId: number
  if (input.id) {
    // When a season is active, a venue's hosting configuration (court count,
    // per-court slot modes / own-team / public-slot, and slot times) is frozen.
    // Other details (name, contacts, logo) may still change.
    if (await isSeasonLocked()) {
      const [current] = await db
        .select({ courts: clubs.courts, courtSlots: clubs.courtSlots, slotTimeslots: clubs.slotTimeslots })
        .from(clubs)
        .where(eq(clubs.id, input.id))
        .limit(1)
      const changedSlots =
        current &&
        (current.courts !== courts ||
          JSON.stringify(current.courtSlots ?? []) !== JSON.stringify(slots) ||
          JSON.stringify(current.slotTimeslots ?? []) !== JSON.stringify(slotTimeslots))
      if (changedSlots) {
        return {
          ok: false,
          error: "The season has started — court slots, own teams and public slots are locked.",
        }
      }
    }
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
    await requireClubManager({ clubId: club.id, organisationId: club.organisationId })
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

/**
 * Assign (or clear) the captain of one of a venue's entered "Club Team" blocks.
 * `teamId` must be a Club Team homed at `clubId`. Passing `playerId = null`
 * removes the current captain. The chosen player can be ANY existing player —
 * they're added to the team roster as captain and promoted to the captain role.
 */
export async function setClubTeamCaptain(input: {
  clubId: number
  teamId: number
  playerId: string | null
}) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, input.clubId)).limit(1)
  if (!club) return { ok: false, error: "Venue not found" }
  try {
    await requireClubManager({ clubId: club.id, organisationId: club.organisationId })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const [team] = await db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1)
  if (!team || team.homeClubId !== input.clubId || team.teamType !== "Club Team") {
    return { ok: false, error: "Team does not belong to this venue" }
  }

  // Clear the captain: demote the previous roster captain to a normal member.
  if (input.playerId == null) {
    if (team.captainUserId) {
      const [prev] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.role, "captain")))
        .limit(1)
      if (prev) await db.update(teamMembers).set({ role: "player" }).where(eq(teamMembers.id, prev.id))
    }
    await db.update(teams).set({ captainUserId: null, updatedAt: new Date() }).where(eq(teams.id, team.id))
    revalidatePath("/admin/clubs")
    revalidatePath("/dashboard/org")
    return { ok: true }
  }

  const [player] = await db.select().from(user).where(eq(user.id, input.playerId)).limit(1)
  if (!player) return { ok: false, error: "Player not found" }

  await db.update(teams).set({ captainUserId: player.id, updatedAt: new Date() }).where(eq(teams.id, team.id))
  // Only elevate to "captain" if the user is currently a plain player (or has no
  // meta row yet). Never downgrade a super_admin / org_admin who
  // happens to also be assigned as team captain.
  const [existingMeta] = await db
    .select({ role: userMeta.role })
    .from(userMeta)
    .where(eq(userMeta.userId, player.id))
    .limit(1)
  const adminRoles = ["super_admin", "org_admin"]
  if (!existingMeta) {
    await db.insert(userMeta).values({ userId: player.id, role: "captain" })
  } else if (!adminRoles.includes(existingMeta.role ?? "")) {
    await db.update(userMeta).set({ role: "captain" }).where(eq(userMeta.userId, player.id))
  }

  // Ensure the captain is on the roster.
  const [m] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerId, input.playerId)))
    .limit(1)
  if (!m) {
    await db.insert(teamMembers).values({ teamId: team.id, playerId: input.playerId, role: "captain", status: "active" })
  } else {
    await db.update(teamMembers).set({ role: "captain", status: "active" }).where(eq(teamMembers.id, m.id))
  }

  revalidatePath("/admin/clubs")
  revalidatePath("/dashboard/org")
  revalidatePath("/admin/placement")
  return { ok: true }
}

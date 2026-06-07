"use server"

import { db } from "@/lib/db"
import {
  teams,
  organisations,
  players,
  teamMembers,
  userMeta,
  clubs,
  teamPairings,
  teamInvites,
  fixtureUnavailable,
  standings,
  teamEntries,
  payments,
  fixtures,
} from "@/lib/db/schema"
import { eq, and, ne, sql } from "drizzle-orm"
import { isSeasonLocked } from "@/lib/season-lock"

/**
 * Guard a home-venue assignment against the club's hosting capacity. Returns an
 * error string when the venue is full (and the team isn't already homed there),
 * otherwise null. `excludeTeamId` keeps a team's own existing slot from counting
 * against it when it stays put.
 */
async function checkVenueCapacity(clubId: number, excludeTeamId?: number): Promise<string | null> {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1)
  if (!club) return "Venue not found"
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teams)
    .where(
      excludeTeamId
        ? and(eq(teams.homeClubId, clubId), ne(teams.id, excludeTeamId))
        : eq(teams.homeClubId, clubId),
    )
  const used = Math.max(count ?? 0, club.teamsEntering ?? 0)
  if (used >= club.hostingCapacity) {
    return `${club.name} is at hosting capacity (${club.hostingCapacity}). Choose another venue.`
  }
  return null
}
import { getCurrentUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { notify } from "@/lib/notify"
import { recomputeTeamStats } from "@/lib/engine/team-stats"

async function requireOrgOwner(orgId: number) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1)
  if (!org) throw new Error("Organisation not found")
  if (org.ownerUserId !== user.id) {
    // allow league admins and the main (super) admin
    const [meta] = await db.select().from(userMeta).where(eq(userMeta.userId, user.id)).limit(1)
    if (meta?.role !== "league_admin" && meta?.role !== "super_admin") {
      throw new Error("Not authorised for this organisation")
    }
  }
  return { user, org }
}

export async function createTeam(formData: FormData) {
  const orgId = Number(formData.get("orgId"))
  await requireOrgOwner(orgId)
  const name = String(formData.get("name") ?? "").trim()
  const divisionId = formData.get("divisionId") ? Number(formData.get("divisionId")) : null
  const teamType = String(formData.get("teamType") ?? "Club Team").trim() || "Club Team"
  const homeClubId = formData.get("homeClubId") ? Number(formData.get("homeClubId")) : null
  if (!name) return { ok: false, error: "Team name is required" }

  // Derive region from the chosen home club so the team is board-ready.
  let regionId: number | null = null
  let saplRegion: string | null = null
  if (homeClubId) {
    const capacityError = await checkVenueCapacity(homeClubId)
    if (capacityError) return { ok: false, error: capacityError }
    const [club] = await db.select().from(clubs).where(eq(clubs.id, homeClubId)).limit(1)
    if (club) {
      regionId = club.regionId ?? null
      saplRegion = club.saplRegion ?? null
    }
  }

  await db.insert(teams).values({
    name,
    organisationId: orgId,
    divisionId,
    teamType,
    homeClubId,
    regionId,
    saplRegion,
    tpr: 1000,
    status: "active",
  })
  revalidatePath("/dashboard/org")
  revalidatePath("/admin/placement")
  return { ok: true }
}

export async function updateTeamRegistration(input: {
  teamId: number
  name?: string
  teamType?: string
  homeClubId?: number | null
  managerPlayerId?: number | null
  clubPaysFees?: boolean
}) {
  const [team] = await db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1)
  if (!team?.organisationId) return { ok: false, error: "Team not found" }
  await requireOrgOwner(team.organisationId)

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  // Team name and home venue are frozen once a season is active.
  if ((input.name !== undefined || input.homeClubId !== undefined) && (await isSeasonLocked())) {
    return { ok: false, error: "The season has started — team name and home venue are locked." }
  }
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { ok: false, error: "Team name is required" }
    patch.name = name
  }
  if (input.teamType) patch.teamType = input.teamType
  if (input.clubPaysFees !== undefined) patch.clubPaysFees = input.clubPaysFees
  if (input.homeClubId !== undefined) {
    patch.homeClubId = input.homeClubId
    if (input.homeClubId && input.homeClubId !== team.homeClubId) {
      const capacityError = await checkVenueCapacity(input.homeClubId, input.teamId)
      if (capacityError) return { ok: false, error: capacityError }
    }
    if (input.homeClubId) {
      const [club] = await db.select().from(clubs).where(eq(clubs.id, input.homeClubId)).limit(1)
      if (club) {
        patch.regionId = club.regionId ?? null
        patch.saplRegion = club.saplRegion ?? null
      }
    }
  }
  if (input.managerPlayerId !== undefined) {
    if (input.managerPlayerId) {
      const [p] = await db.select().from(players).where(eq(players.id, input.managerPlayerId)).limit(1)
      patch.managerUserId = p?.userId ?? null
    } else {
      patch.managerUserId = null
    }
  }

  await db.update(teams).set(patch).where(eq(teams.id, input.teamId))
  await recomputeTeamStats(input.teamId)
  revalidatePath("/dashboard/org")
  revalidatePath("/dashboard/captain")
  revalidatePath("/admin/placement")
  return { ok: true }
}

export async function assignCaptain(formData: FormData) {
  const teamId = Number(formData.get("teamId"))
  const playerId = Number(formData.get("playerId"))
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team?.organisationId) return { ok: false, error: "Team not found" }
  await requireOrgOwner(team.organisationId)

  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
  if (!player?.userId) return { ok: false, error: "Player has no linked account" }

  await db.update(teams).set({ captainUserId: player.userId }).where(eq(teams.id, teamId))
  // promote role
  await db.update(userMeta).set({ role: "captain" }).where(eq(userMeta.userId, player.userId))
  // ensure roster membership
  const [m] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, playerId)))
    .limit(1)
  if (!m) {
    await db.insert(teamMembers).values({ teamId, playerId, role: "captain", status: "active" })
  } else {
    await db.update(teamMembers).set({ role: "captain", status: "active" }).where(eq(teamMembers.id, m.id))
  }

  await notify({
    userId: player.userId,
    scope: "user",
    type: "captain_assigned",
    title: "You are now a team captain",
    body: `You have been made captain of ${team.name}.`,
  })

  await recomputeTeamStats(teamId)
  revalidatePath("/dashboard/org")
  revalidatePath("/admin/placement")
  return { ok: true }
}

export async function setTeamClubPaysFees(teamId: number, clubPaysFees: boolean) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team?.organisationId) return { error: "Team not found" }
  try {
    await requireOrgOwner(team.organisationId)
  } catch {
    return { error: "You cannot manage this team." }
  }
  await db.update(teams).set({ clubPaysFees, updatedAt: new Date() }).where(eq(teams.id, teamId))
  revalidatePath("/dashboard/org")
  revalidatePath("/dashboard/captain")
  return { success: true }
}

/**
 * Permanently delete a team and all its dependent rows (roster, pairings,
 * invites, availability, standings, season entries, payments). Fixtures keep
 * their slot but lose the team reference so the schedule stays intact.
 */
export async function deleteTeam(teamId: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team?.organisationId) return { ok: false, error: "Team not found" }
  try {
    await requireOrgOwner(team.organisationId)
  } catch {
    return { ok: false, error: "You cannot manage this team." }
  }

  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
  await db.delete(teamPairings).where(eq(teamPairings.teamId, teamId))
  await db.delete(teamInvites).where(eq(teamInvites.teamId, teamId))
  await db.delete(fixtureUnavailable).where(eq(fixtureUnavailable.teamId, teamId))
  await db.delete(standings).where(eq(standings.teamId, teamId))
  await db.delete(teamEntries).where(eq(teamEntries.teamId, teamId))
  await db.delete(payments).where(eq(payments.teamId, teamId))
  // Detach from any generated fixtures rather than deleting the slot.
  await db.update(fixtures).set({ homeTeamId: null }).where(eq(fixtures.homeTeamId, teamId))
  await db.update(fixtures).set({ awayTeamId: null }).where(eq(fixtures.awayTeamId, teamId))
  await db.delete(teams).where(eq(teams.id, teamId))

  revalidatePath("/dashboard/org")
  revalidatePath("/admin/placement")
  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}


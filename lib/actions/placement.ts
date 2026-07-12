"use server"

import { db } from "@/lib/db"
import {
  teams,
  divisions,
  teamEntries,
  teamMembers,
  teamPairings,
  teamInvites,
  standings,
  tprHistory,
  fixtureUnavailable,
  fixtures,
  matches,
  results,
} from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { getTeamRoster, type RosterEntry } from "@/lib/queries-placement"
import { syncDivisionFixtures } from "@/lib/fixtures-sync"
import { TEAM_TYPES, normalizeTeamType } from "@/lib/constants"
import { isSeasonLocked } from "@/lib/season-lock"
import { syncTeamLifecycleStatus } from "@/lib/engine/team-stats"

export async function fetchTeamRoster(teamId: number): Promise<RosterEntry[]> {
  await requireRole(["super_admin"])
  return getTeamRoster(teamId)
}

/**
 * Admin-only: set a team's type (Club / Business / Private) from the Placement
 * Board roster panel.
 */
export async function adminSetTeamType(teamId: number, teamType: string) {
  await requireRole(["super_admin"])
  const normalized = normalizeTeamType(teamType)
  if (!TEAM_TYPES.includes(normalized as (typeof TEAM_TYPES)[number])) {
    return { ok: false, error: "Invalid team type" }
  }
  await db.update(teams).set({ teamType: normalized, updatedAt: new Date() }).where(eq(teams.id, teamId))
  revalidatePath("/admin")
  revalidatePath("/dashboard/my-team")
  return { ok: true }
}

/**
 * Admin-only: permanently delete a team. Removes the team's roster, pairings,
 * invites, season entries, standings and TPR history, and detaches it from any
 * fixtures/matches/results so the schedule stays intact (slots become open).
 */
export async function adminDeleteTeam(teamId: number) {
  await requireRole(["super_admin"])
  if (await isSeasonLocked()) {
    return { ok: false, error: "The league is locked — teams cannot be deleted." }
  }

  // Child rows that require a team (notNull FK) — remove them.
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
  await db.delete(teamPairings).where(eq(teamPairings.teamId, teamId))
  await db.delete(teamInvites).where(eq(teamInvites.teamId, teamId))
  await db.delete(teamEntries).where(eq(teamEntries.teamId, teamId))
  await db.delete(standings).where(eq(standings.teamId, teamId))
  await db.delete(tprHistory).where(eq(tprHistory.teamId, teamId))
  await db.delete(fixtureUnavailable).where(eq(fixtureUnavailable.teamId, teamId))

  // Nullable references — detach so fixtures/results survive without the team.
  await db
    .update(fixtures)
    .set({ homeTeamId: null })
    .where(eq(fixtures.homeTeamId, teamId))
  await db
    .update(fixtures)
    .set({ awayTeamId: null })
    .where(eq(fixtures.awayTeamId, teamId))
  await db
    .update(fixtures)
    .set({ winnerTeamId: null })
    .where(eq(fixtures.winnerTeamId, teamId))
  await db.update(matches).set({ winnerTeamId: null }).where(eq(matches.winnerTeamId, teamId))
  await db.update(results).set({ winnerTeamId: null }).where(eq(results.winnerTeamId, teamId))

  await db.delete(teams).where(eq(teams.id, teamId))

  revalidatePath("/admin")
  revalidatePath("/dashboard/my-team")
  return { ok: true }
}

export type PlacementItem = {
  teamId: number
  divisionId: number | null // null = unassigned
  slot: number | null // 1-based slot within division
  sortOrder: number
}

/**
 * Persist a single team's placement after a drag-and-drop. Auto-saved (no Save
 * button). We upsert the team's season entry and keep teams.divisionId in sync so
 * downstream fixtures/standings reflect the seeded division immediately.
 */
export async function saveTeamPlacement(input: {
  seasonId: number
  teamId: number
  divisionId: number | null
  slot: number | null
  sortOrder: number
}) {
  await requireRole(["super_admin"])
  if (await isSeasonLocked()) {
    return { ok: false, error: "The league is locked — teams cannot be moved between divisions." }
  }
  const { seasonId, teamId, divisionId, slot, sortOrder } = input

  let regionId: number | null = null
  if (divisionId) {
    const [d] = await db.select({ id: divisions.id, seasonId: divisions.seasonId, regionId: divisions.regionId }).from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!d || d.seasonId !== seasonId) return { ok: false, error: "Invalid division for season" }
    regionId = d.regionId ?? null
  }

  const [existing] = await db
    .select({ id: teamEntries.id, divisionId: teamEntries.divisionId, teamId: teamEntries.teamId, seasonId: teamEntries.seasonId })
    .from(teamEntries)
    .where(and(eq(teamEntries.teamId, teamId), eq(teamEntries.seasonId, seasonId)))
    .limit(1)

  const status = divisionId ? "assigned" : "unassigned"

  if (existing) {
    await db
      .update(teamEntries)
      .set({ divisionId, regionId, slot, sortOrder, status, updatedAt: new Date() })
      .where(eq(teamEntries.id, existing.id))
  } else {
    await db.insert(teamEntries).values({
      seasonId,
      teamId,
      divisionId,
      regionId,
      slot,
      sortOrder,
      status,
    })
  }

  // Keep the live team record aligned with its seeded placement.
  await db
    .update(teams)
    .set({ divisionId, seasonId, regionId: regionId ?? undefined })
    .where(eq(teams.id, teamId))
  await syncTeamLifecycleStatus(teamId)

  // Re-link template fixtures (and venues) for the affected division(s).
  if (divisionId) await syncDivisionFixtures(divisionId)
  if (existing?.divisionId && existing.divisionId !== divisionId) {
    await syncDivisionFixtures(existing.divisionId)
  }

  revalidatePath("/admin")
  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

/**
 * Re-sequence slot/sortOrder for every team in a division column. Called after a
 * drop so positions stay 1..N contiguous. `orderedTeamIds` is the new order.
 */
export async function reindexDivisionColumn(input: {
  seasonId: number
  divisionId: number | null
  orderedTeamIds: number[]
}) {
  await requireRole(["super_admin"])
  if (await isSeasonLocked()) {
    return { ok: false, error: "The league is locked — teams cannot be moved between divisions." }
  }
  const { seasonId, divisionId, orderedTeamIds } = input

  let regionId: number | null = null
  if (divisionId) {
    const [d] = await db.select({ id: divisions.id, seasonId: divisions.seasonId, regionId: divisions.regionId }).from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!d || d.seasonId !== seasonId) return { ok: false, error: "Invalid division" }
    regionId = d.regionId ?? null
  }

  const status = divisionId ? "assigned" : "unassigned"

  for (let i = 0; i < orderedTeamIds.length; i++) {
    const teamId = orderedTeamIds[i]
    const slot = divisionId ? i + 1 : null
    const [existing] = await db
      .select({ id: teamEntries.id, divisionId: teamEntries.divisionId })
      .from(teamEntries)
      .where(and(eq(teamEntries.teamId, teamId), eq(teamEntries.seasonId, seasonId)))
      .limit(1)
    if (existing) {
      await db
        .update(teamEntries)
        .set({ divisionId, regionId, slot, sortOrder: i, status, updatedAt: new Date() })
        .where(eq(teamEntries.id, existing.id))
    } else {
      await db.insert(teamEntries).values({ seasonId, teamId, divisionId, regionId, slot, sortOrder: i, status })
    }
    await db
      .update(teams)
      .set({ divisionId, seasonId, regionId: regionId ?? undefined })
      .where(eq(teams.id, teamId))
    await syncTeamLifecycleStatus(teamId)
  }

  // Re-link this division's template fixtures to the new slot order + venues.
  if (divisionId) await syncDivisionFixtures(divisionId)

  revalidatePath("/admin")
  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

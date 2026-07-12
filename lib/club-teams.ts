import { db } from "@/lib/db"
import { clubs, teams, teamMembers, teamEntries, regions } from "@/lib/db/schema"
import { and, asc, eq } from "drizzle-orm"

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function regionIdForName(name: string | null): Promise<number | null> {
  if (!name) return null
  const [r] = await db.select({ id: regions.id }).from(regions).where(eq(regions.name, name)).limit(1)
  return r?.id ?? null
}

function teamName(base: string, index: number, total: number) {
  // 1 team -> "<Club>"; 2+ teams -> "<Club> A", "<Club> B", ...
  return total <= 1 ? base : `${base} ${String.fromCharCode(65 + index)}`
}

/**
 * Make a venue's "Club Team" entries match the number of teams it declared it
 * will enter (`clubs.teamsEntering`).
 *
 * - Increasing the count creates new unassigned teams (no division/entry) so
 *   they show up in the season's placement board even with no players yet.
 * - Decreasing the count removes the extra teams, always taking the most recent
 *   first (B before A). Teams that already have an active roster member or have
 *   been placed into a division/entry are never auto-deleted — real data wins.
 * - Auto-named teams are re-lettered so a 2+ entry always reads A, B, C…;
 *   teams the owner has renamed are left untouched.
 *
 * Idempotent: safe to call on every club save and on season creation.
 */
export async function reconcileClubTeams(clubId: number) {
  const [club] = await db
    .select({
      id: clubs.id,
      organisationId: clubs.organisationId,
      name: clubs.name,
      teamsEntering: clubs.teamsEntering,
      regionId: clubs.regionId,
      saplRegion: clubs.saplRegion,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
  if (!club) return

  const base = club.name.trim()
  const desired = Math.max(0, Math.floor(club.teamsEntering ?? 0))
  const regionId = club.regionId ?? (await regionIdForName(club.saplRegion))

  // Club teams that belong to this venue, in creation order (A first, B next…).
  const existing = await db
    .select()
    .from(teams)
    .where(and(eq(teams.homeClubId, clubId), eq(teams.teamType, "Club Team")))
    .orderBy(asc(teams.id))

  const current = existing.length

  if (desired > current) {
    const rows = []
    for (let i = current; i < desired; i++) {
      rows.push({
        organisationId: club.organisationId,
        name: teamName(base, i, desired),
        teamType: "Club Team",
        homeClubId: clubId,
        saplRegion: club.saplRegion ?? null,
        regionId,
        status: "draft" as const,
      })
    }
    if (rows.length) await db.insert(teams).values(rows)
  } else if (desired < current) {
    // Remove from the end — B (and beyond) before A.
    let toRemove = current - desired
    for (let i = existing.length - 1; i >= 0 && toRemove > 0; i--) {
      const t = existing[i]
      const [entry] = await db
        .select({ id: teamEntries.id })
        .from(teamEntries)
        .where(eq(teamEntries.teamId, t.id))
        .limit(1)
      // Keep teams that have been placed into a division or have a season entry
      // (real competition data). A captain/roster on an un-placed club team is
      // part of club management, so deselecting "enter a team" removes the team
      // and its captain assignment as the venue intends.
      if (entry || t.divisionId) continue
      // Clean up roster rows first so we never orphan team_members.
      await db.delete(teamMembers).where(eq(teamMembers.teamId, t.id))
      await db.delete(teams).where(eq(teams.id, t.id))
      toRemove--
    }
  }

  // Re-letter the auto-named club teams so the A/B/C sequence stays correct.
  const autoRe = new RegExp(`^${escapeRegex(base)}( [A-Z])?$`)
  const finalTeams = await db
    .select()
    .from(teams)
    .where(and(eq(teams.homeClubId, clubId), eq(teams.teamType, "Club Team")))
    .orderBy(asc(teams.id))
  const autoTeams = finalTeams.filter((t) => autoRe.test(t.name))
  for (let i = 0; i < autoTeams.length; i++) {
    const want = teamName(base, i, autoTeams.length)
    if (autoTeams[i].name !== want) {
      await db.update(teams).set({ name: want, updatedAt: new Date() }).where(eq(teams.id, autoTeams[i].id))
    }
  }
}

import { db } from "@/lib/db"
import { fixtures, teams, teamEntries, divisions, clubs } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"

/**
 * Re-link a division's slot-based template fixtures to the teams currently
 * placed in each slot, and default each fixture's venue to the home team's home
 * club. Only scheduled fixtures are touched so completed/disputed results are
 * never disturbed. The per-fixture Playtomic link is left untouched (it is set
 * manually by clubs/admins).
 */
export async function syncDivisionFixtures(divisionId: number) {
  const [div] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
  if (!div) return

  // slot -> teamId for teams assigned to this division in its season.
  const entries = await db
    .select({ teamId: teamEntries.teamId, slot: teamEntries.slot })
    .from(teamEntries)
    .where(
      and(
        eq(teamEntries.seasonId, div.seasonId),
        eq(teamEntries.divisionId, divisionId),
        eq(teamEntries.status, "assigned"),
      ),
    )
  const slotToTeam = new Map<number, number>()
  for (const e of entries) if (e.slot) slotToTeam.set(e.slot, e.teamId)

  // Resolve each placed team's home club (the default fixture venue).
  const teamIds = [...slotToTeam.values()]
  const teamRows = teamIds.length
    ? await db.select({ id: teams.id, homeClubId: teams.homeClubId }).from(teams).where(inArray(teams.id, teamIds))
    : []
  const homeClubByTeam = new Map(teamRows.map((t) => [t.id, t.homeClubId]))
  const clubIds = teamRows.map((t) => t.homeClubId).filter((x): x is number => x != null)
  const clubRows = clubIds.length
    ? await db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(inArray(clubs.id, clubIds))
    : []
  const clubNameById = new Map(clubRows.map((c) => [c.id, c.name]))

  const divFixtures = await db
    .select()
    .from(fixtures)
    .where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.status, "scheduled")))

  for (const f of divFixtures) {
    const homeTeamId = f.homeSlot ? (slotToTeam.get(f.homeSlot) ?? null) : f.homeTeamId
    const awayTeamId = f.awaySlot ? (slotToTeam.get(f.awaySlot) ?? null) : f.awayTeamId
    const homeClubId = homeTeamId ? (homeClubByTeam.get(homeTeamId) ?? null) : null
    const venue = homeClubId ? (clubNameById.get(homeClubId) ?? null) : null
    await db
      .update(fixtures)
      .set({ homeTeamId, awayTeamId, venueClubId: homeClubId, venue, updatedAt: new Date() })
      .where(eq(fixtures.id, f.id))
  }
}

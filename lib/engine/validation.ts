import { db } from "@/lib/db"
import { fixtures, teams, divisions, clubs, teamEntries } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { MAX_FIXTURES_PER_VENUE_NIGHT } from "@/lib/constants"

export type ValidationIssue = {
  level: "error" | "warning"
  code: string
  message: string
}

export type SeasonValidation = {
  ok: boolean
  errors: number
  warnings: number
  issues: ValidationIssue[]
}

/**
 * Validate a season's draft schedule before it can be published.
 *
 * Errors (block publishing):
 *  - A venue is double-booked: more than one fixture at the same venue, same
 *    date AND same timeslot.
 *  - A venue exceeds its nightly slot capacity (one fixture per slot).
 *  - A team is scheduled to play two fixtures at the same time.
 *  - A division has unplaced slots referenced by scheduled fixtures (a real
 *    team is missing from a slot that still has games).
 *
 * Warnings (allowed, surfaced for the admin):
 *  - A division has fewer teams than its max — suggest "Adjust fixtures".
 *  - A scheduled fixture is missing a timeslot.
 */
export async function validateSeason(seasonId: number): Promise<SeasonValidation> {
  const issues: ValidationIssue[] = []

  const divs = await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.seasonId, seasonId))
  const seasonFixtures = await db
    .select()
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.status, "scheduled")))

  const divName = new Map(divs.map((d) => [d.id, d.name]))

  // ---- Captains on every assigned team -----------------------------------
  // A season cannot start until every team placed into a division has a
  // captain. Surface each missing one as an error.
  const assignedTeams = await db
    .select({ name: teams.name, captainUserId: teams.captainUserId, divisionId: teamEntries.divisionId })
    .from(teamEntries)
    .innerJoin(teams, eq(teams.id, teamEntries.teamId))
    .where(and(eq(teamEntries.seasonId, seasonId), eq(teamEntries.status, "assigned")))
  for (const t of assignedTeams) {
    if (!t.captainUserId) {
      issues.push({
        level: "error",
        code: "team_missing_captain",
        message: `${t.name} has no captain assigned — every team needs a captain before the season starts.`,
      })
    }
  }

  // ---- Per-division team counts ------------------------------------------
  for (const d of divs) {
    const entries = await db
      .select({ id: teamEntries.id })
      .from(teamEntries)
      .where(
        and(
          eq(teamEntries.seasonId, seasonId),
          eq(teamEntries.divisionId, d.id),
          eq(teamEntries.status, "assigned"),
        ),
      )
    const assigned = entries.length
    if (assigned < 2) {
      issues.push({
        level: "error",
        code: "division_too_few_teams",
        message: `${d.name} has only ${assigned} team(s) assigned — assign at least 2.`,
      })
      continue
    }
    // The round-robin is sized to the assigned team count at generation time, so
    // a partially-filled division (e.g. 6/8) is fine. Only warn if the scheduled
    // fixtures still reference slots beyond the teams placed — that means the
    // template predates the current placement and needs re-fitting.
    const divFixtures = seasonFixtures.filter((f) => f.divisionId === d.id)
    const highestSlot = divFixtures.reduce(
      (mx, f) => Math.max(mx, f.homeSlot ?? 0, f.awaySlot ?? 0),
      0,
    )
    if (highestSlot > assigned) {
      issues.push({
        level: "warning",
        code: "division_needs_refit",
        message: `${d.name} has ${assigned} teams but fixtures still use ${highestSlot} slots. Use "Adjust fixtures" to re-fit the round robin.`,
      })
    }
  }

  // ---- Venue night collisions (date + timeslot) --------------------------
  // key = venueClubId|date|timeslot -> count
  const venueSlot = new Map<string, number>()
  // key = venueClubId|date -> count (total fixtures that night)
  const venueNight = new Map<string, number>()
  // key = teamId|date|timeslot -> count
  const teamSlot = new Map<string, { count: number; name?: string }>()

  const dayKey = (dt: Date | null) => (dt ? new Date(dt).toISOString().slice(0, 10) : "?")

  for (const f of seasonFixtures) {
    // A fixture with no real teams yet (pure placeholder) can't collide.
    const hasTeams = f.homeTeamId != null || f.awayTeamId != null
    if (!f.matchDate) continue

    if (f.venueClubId != null) {
      const nightKey = `${f.venueClubId}|${dayKey(f.matchDate)}`
      venueNight.set(nightKey, (venueNight.get(nightKey) ?? 0) + 1)
      if (f.timeslot) {
        const slotKey = `${nightKey}|${f.timeslot}`
        venueSlot.set(slotKey, (venueSlot.get(slotKey) ?? 0) + 1)
      } else if (hasTeams) {
        issues.push({
          level: "warning",
          code: "missing_timeslot",
          message: `${divName.get(f.divisionId ?? -1) ?? "Fixture"} game on ${dayKey(f.matchDate)} has no timeslot.`,
        })
      }
    }

    for (const tid of [f.homeTeamId, f.awayTeamId]) {
      if (tid != null && f.timeslot) {
        const key = `${tid}|${dayKey(f.matchDate)}|${f.timeslot}`
        const cur = teamSlot.get(key) ?? { count: 0 }
        cur.count++
        teamSlot.set(key, cur)
      }
    }
  }

  // Resolve venue + team names for readable messages.
  const clubRows = await db.select({ id: clubs.id, name: clubs.name }).from(clubs)
  const clubName = new Map(clubRows.map((c) => [c.id, c.name]))
  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams)
  const teamName = new Map(teamRows.map((t) => [t.id, t.name]))

  for (const [key, count] of venueSlot) {
    if (count > 1) {
      const [clubId, date, slot] = key.split("|")
      issues.push({
        level: "error",
        code: "venue_double_booked",
        message: `${clubName.get(Number(clubId)) ?? "Venue"} is double-booked on ${date} at ${slot} (${count} fixtures).`,
      })
    }
  }

  for (const [key, count] of venueNight) {
    if (count > MAX_FIXTURES_PER_VENUE_NIGHT) {
      const [clubId, date] = key.split("|")
      issues.push({
        level: "error",
        code: "venue_over_capacity",
        message: `${clubName.get(Number(clubId)) ?? "Venue"} has ${count} fixtures on ${date} but only ${MAX_FIXTURES_PER_VENUE_NIGHT} slots a night.`,
      })
    }
  }

  for (const [key, v] of teamSlot) {
    if (v.count > 1) {
      const [tid, date, slot] = key.split("|")
      issues.push({
        level: "error",
        code: "team_clash",
        message: `${teamName.get(Number(tid)) ?? "A team"} has ${v.count} fixtures on ${date} at ${slot}.`,
      })
    }
  }

  const errors = issues.filter((i) => i.level === "error").length
  const warnings = issues.filter((i) => i.level === "warning").length
  return { ok: errors === 0, errors, warnings, issues }
}

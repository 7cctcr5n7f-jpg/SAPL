import { db } from "@/lib/db"
import { fixtures, teams, divisions, clubs, teamEntries } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { CATEGORY_RULES } from "@/lib/constants"
import { DRAFT_FIXTURE_STATUS } from "@/lib/fixture-status"

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

function issue(level: "error" | "warning", code: string, message: string): ValidationIssue {
  return { level, code, message }
}

function teamPairKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function dateKey(value: Date | string | null) {
  if (!value) return "unknown-date"
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "unknown-date" : date.toISOString().slice(0, 10)
}

function slotOccupancy(
  fixture: {
    id: number
    timeslot: string | null
    courtAssignments: Record<string, { court: string | null; time: string | null }> | null
  },
) {
  const counts = new Map<string, number>()
  const assignments = fixture.courtAssignments ?? {}
  const categories = CATEGORY_RULES.map((category) => category.name)

  for (const category of categories) {
    const time = assignments[category]?.time ?? fixture.timeslot
    if (!time) continue
    counts.set(time, (counts.get(time) ?? 0) + 1)
  }

  return counts
}

export async function validateSeason(seasonId: number): Promise<SeasonValidation> {
  const issues: ValidationIssue[] = []

  const seasonDivisions = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      level: divisions.level,
    })
    .from(divisions)
    .where(eq(divisions.seasonId, seasonId))

  const divisionIds = seasonDivisions.map((division) => division.id)
  const editableStatuses = [DRAFT_FIXTURE_STATUS, "scheduled", "completed", "disputed"]

  const seasonFixtures = divisionIds.length
    ? await db
        .select({
          id: fixtures.id,
          divisionId: fixtures.divisionId,
          week: fixtures.week,
          matchDate: fixtures.matchDate,
          homeTeamId: fixtures.homeTeamId,
          awayTeamId: fixtures.awayTeamId,
          homeSlot: fixtures.homeSlot,
          awaySlot: fixtures.awaySlot,
          venueClubId: fixtures.venueClubId,
          venue: fixtures.venue,
          timeslot: fixtures.timeslot,
          status: fixtures.status,
          courtAssignments: fixtures.courtAssignments,
        })
        .from(fixtures)
        .where(and(eq(fixtures.seasonId, seasonId), inArray(fixtures.status, editableStatuses)))
    : []

  const assignedTeams = divisionIds.length
    ? await db
        .select({
          divisionId: teamEntries.divisionId,
          teamId: teamEntries.teamId,
          slot: teamEntries.slot,
          teamName: teams.name,
        })
        .from(teamEntries)
        .innerJoin(teams, eq(teams.id, teamEntries.teamId))
        .where(and(eq(teamEntries.seasonId, seasonId), eq(teamEntries.status, "assigned"), inArray(teamEntries.divisionId, divisionIds)))
    : []

  const clubRows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      courts: clubs.courts,
      hostTimeslots: clubs.hostTimeslots,
    })
    .from(clubs)
  const clubById = new Map(clubRows.map((club) => [club.id, club]))
  const teamNameById = new Map(assignedTeams.map((team) => [team.teamId, team.teamName]))

  for (const division of seasonDivisions) {
    const teamsInDivision = assignedTeams
      .filter((team) => team.divisionId === division.id)
      .sort((a, b) => (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER) || a.teamName.localeCompare(b.teamName))
    const fixturesInDivision = seasonFixtures.filter((fixture) => fixture.divisionId === division.id)

    if (teamsInDivision.length < 2) {
      issues.push(issue("error", "division_too_few_teams", `${division.name} has ${teamsInDivision.length} team(s). Assign at least 2 teams before publishing fixtures.`))
      continue
    }

    const expectedPerTeam = teamsInDivision.length - 1
    const expectedFixtures = (teamsInDivision.length * expectedPerTeam) / 2
    const fixtureCounts = new Map<number, number>()
    const homeCounts = new Map<number, number>()
    const awayCounts = new Map<number, number>()
    const pairCounts = new Map<string, number>()
    const sequences = new Map<number, { week: number; side: "H" | "A" }[]>()

    for (const fixture of fixturesInDivision) {
      if (fixture.homeTeamId == null || fixture.awayTeamId == null) {
        issues.push(issue("error", "fixture_missing_team", `${division.name} has a fixture with a missing home or away team.`))
        continue
      }

      fixtureCounts.set(fixture.homeTeamId, (fixtureCounts.get(fixture.homeTeamId) ?? 0) + 1)
      fixtureCounts.set(fixture.awayTeamId, (fixtureCounts.get(fixture.awayTeamId) ?? 0) + 1)
      homeCounts.set(fixture.homeTeamId, (homeCounts.get(fixture.homeTeamId) ?? 0) + 1)
      awayCounts.set(fixture.awayTeamId, (awayCounts.get(fixture.awayTeamId) ?? 0) + 1)
      pairCounts.set(teamPairKey(fixture.homeTeamId, fixture.awayTeamId), (pairCounts.get(teamPairKey(fixture.homeTeamId, fixture.awayTeamId)) ?? 0) + 1)
      sequences.set(fixture.homeTeamId, [...(sequences.get(fixture.homeTeamId) ?? []), { week: fixture.week, side: "H" }])
      sequences.set(fixture.awayTeamId, [...(sequences.get(fixture.awayTeamId) ?? []), { week: fixture.week, side: "A" }])
    }

    if (fixturesInDivision.length !== expectedFixtures) {
      const level = fixturesInDivision.length < expectedFixtures ? "error" : "warning"
      issues.push(
        issue(
          level,
          fixturesInDivision.length < expectedFixtures ? "missing_fixtures" : "extra_fixtures",
          `${division.name} should have ${expectedFixtures} fixtures for ${teamsInDivision.length} teams, but has ${fixturesInDivision.length}.`,
        ),
      )
    }

    for (const team of teamsInDivision) {
      const played = fixtureCounts.get(team.teamId) ?? 0
      if (played !== expectedPerTeam) {
        issues.push(issue("error", "team_fixture_count", `${team.teamName} should have ${expectedPerTeam} fixtures in ${division.name}, but has ${played}.`))
      }

      const home = homeCounts.get(team.teamId) ?? 0
      const away = awayCounts.get(team.teamId) ?? 0
      if (Math.abs(home - away) > 1) {
        issues.push(issue("error", "home_away_balance", `${team.teamName} is unbalanced in ${division.name}: ${home} home / ${away} away.`))
      }

      const sequence = [...(sequences.get(team.teamId) ?? [])].sort((a, b) => a.week - b.week)
      let streak = 1
      for (let index = 1; index < sequence.length; index++) {
        if (sequence[index].side === sequence[index - 1].side) {
          streak += 1
          if (streak >= 3) {
            issues.push(issue("warning", "home_away_streak", `${team.teamName} has ${streak} consecutive ${sequence[index].side === "H" ? "home" : "away"} fixtures in ${division.name}.`))
            break
          }
        } else {
          streak = 1
        }
      }
    }

    const expectedPairs = new Set<string>()
    for (let i = 0; i < teamsInDivision.length; i++) {
      for (let j = i + 1; j < teamsInDivision.length; j++) {
        expectedPairs.add(teamPairKey(teamsInDivision[i].teamId, teamsInDivision[j].teamId))
      }
    }

    for (const pair of expectedPairs) {
      const count = pairCounts.get(pair) ?? 0
      if (count === 0) {
        const [a, b] = pair.split(":").map(Number)
        issues.push(issue("error", "missing_pairing", `${teamNameById.get(a) ?? "Team"} vs ${teamNameById.get(b) ?? "Team"} is missing from ${division.name}.`))
      } else if (count > 1) {
        const [a, b] = pair.split(":").map(Number)
        issues.push(issue("error", "duplicate_pairing", `${teamNameById.get(a) ?? "Team"} vs ${teamNameById.get(b) ?? "Team"} appears ${count} times in ${division.name}.`))
      }
    }
  }

  const teamWeekCounts = new Map<string, number>()
  const venueSlotCourtCounts = new Map<string, number>()

  for (const fixture of seasonFixtures) {
    if (fixture.homeTeamId != null) {
      const key = `${fixture.homeTeamId}:${fixture.week}`
      teamWeekCounts.set(key, (teamWeekCounts.get(key) ?? 0) + 1)
    }
    if (fixture.awayTeamId != null) {
      const key = `${fixture.awayTeamId}:${fixture.week}`
      teamWeekCounts.set(key, (teamWeekCounts.get(key) ?? 0) + 1)
    }

    if (!fixture.matchDate) {
      issues.push(issue("error", "missing_date", `Fixture ${fixture.id} has no date.`))
    }
    if (!fixture.venueClubId) {
      issues.push(issue("error", "missing_venue", `Fixture ${fixture.id} has no venue assigned.`))
      continue
    }

    const venue = clubById.get(fixture.venueClubId)
    if (!venue) {
      issues.push(issue("error", "unknown_venue", `Fixture ${fixture.id} points at an unknown venue.`))
      continue
    }

    const occupied = slotOccupancy(fixture)
    if (occupied.size === 0) {
      issues.push(issue("error", "missing_timeslot", `${venue.name} fixture ${fixture.id} has no timeslot or court schedule.`))
      continue
    }

    const offeredSlots = Array.isArray(venue.hostTimeslots) ? venue.hostTimeslots : []
    for (const [timeslot, courtCount] of occupied.entries()) {
      if (!offeredSlots.includes(timeslot)) {
        issues.push(issue("error", "venue_unavailable_slot", `${venue.name} cannot host fixture ${fixture.id} at ${timeslot}.`))
      }
      const key = `${fixture.venueClubId}|${dateKey(fixture.matchDate)}|${timeslot}`
      venueSlotCourtCounts.set(key, (venueSlotCourtCounts.get(key) ?? 0) + courtCount)
    }
  }

  for (const [key, count] of teamWeekCounts.entries()) {
    if (count <= 1) continue
    const [teamId, week] = key.split(":")
    issues.push(issue("error", "team_twice_in_week", `${teamNameById.get(Number(teamId)) ?? "A team"} plays ${count} fixtures in week ${week}.`))
  }

  for (const [key, count] of venueSlotCourtCounts.entries()) {
    const [clubId, date, timeslot] = key.split("|")
    const venue = clubById.get(Number(clubId))
    const courts = venue?.courts ?? 0
    if (count > courts) {
      issues.push(issue("error", "venue_overbooked", `${venue?.name ?? "Venue"} is overbooked on ${date} at ${timeslot}: ${count} court allocations for ${courts} courts.`))
    }
  }

  const deduped: ValidationIssue[] = []
  const seen = new Set<string>()
  for (const item of issues) {
    const key = `${item.level}:${item.code}:${item.message}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  const errors = deduped.filter((item) => item.level === "error").length
  const warnings = deduped.filter((item) => item.level === "warning").length
  return {
    ok: errors === 0,
    errors,
    warnings,
    issues: deduped,
  }
}

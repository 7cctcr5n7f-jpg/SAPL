"use server"

import { db } from "@/lib/db"
import {
  fixtures,
  teams,
  divisions,
  seasons,
  standings,
  disputes,
  playoffs,
  userMeta,
  teamEntries,
  clubs,
  regions,
} from "@/lib/db/schema"
import { eq, and, asc, inArray } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { reconcileClubTeams } from "@/lib/club-teams"
import {
  generateRegionalFinals,
  buildDivisionPlayoffTemplates,
  computeDivisionPlayoffQualifiers,
} from "@/lib/engine/playoffs"
import { nextThursday, planSeason } from "@/lib/engine/season"
import { validateSeason } from "@/lib/engine/validation"
import {
  REGIONAL_FINALS_GAP_DAYS,
  DIVISIONS,
  TEAMS_PER_DIVISION,
  TSHWANE_REGIONS,
} from "@/lib/constants"
import { notify } from "@/lib/notify"
import { isSeasonLocked, seasonLockedResult } from "@/lib/season-lock"
import { syncTeamLifecycleStatus } from "@/lib/engine/team-stats"
import { DRAFT_FIXTURE_STATUS } from "@/lib/fixture-status"

const MS_PER_DAY = 24 * 60 * 60 * 1000

function slugifyRegion(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseRegionNames(raw: string) {
  const seen = new Set<string>()
  const names: string[] = []
  for (const part of raw.split(/[\n,]+/)) {
    const name = part.trim().replace(/\s+/g, " ")
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  if (user.realRole !== "super_admin") {
    throw new Error("Super admin access required")
  }
  return user
}

async function syncSeasonTeamLifecycle(seasonId: number) {
  const seasonTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.seasonId, seasonId))
  for (const team of seasonTeams) await syncTeamLifecycleStatus(team.id)
}

async function loadSeasonFixtureInputs(seasonId: number, divisionId?: number) {
  const seasonDivisions = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      level: divisions.level,
      maxTeams: divisions.maxTeams,
    })
    .from(divisions)
    .where(divisionId != null ? and(eq(divisions.seasonId, seasonId), eq(divisions.id, divisionId)) : eq(divisions.seasonId, seasonId))
    .orderBy(asc(divisions.level), asc(divisions.id))

  const seasonEntries = await db
    .select({
      divisionId: teamEntries.divisionId,
      teamId: teamEntries.teamId,
      slot: teamEntries.slot,
      sortOrder: teamEntries.sortOrder,
      homeClubId: teams.homeClubId,
    })
    .from(teamEntries)
    .innerJoin(teams, eq(teams.id, teamEntries.teamId))
    .where(
      divisionId != null
        ? and(eq(teamEntries.seasonId, seasonId), eq(teamEntries.divisionId, divisionId), eq(teamEntries.status, "assigned"))
        : and(eq(teamEntries.seasonId, seasonId), eq(teamEntries.status, "assigned")),
    )

  const hostClubs = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      courts: clubs.courts,
      hostsThursday: clubs.hostsThursday,
      hostingCapacity: clubs.hostingCapacity,
      hostTimeslots: clubs.hostTimeslots,
    })
    .from(clubs)
    .orderBy(asc(clubs.name))

  return {
    divisions: seasonDivisions,
    entries: seasonEntries,
    clubs: hostClubs.map((club) => ({
      id: club.id,
      name: club.name,
      courts: club.courts ?? 0,
      hostsThursday: club.hostsThursday ?? false,
      hostingCapacity: club.hostingCapacity ?? 0,
      hostTimeslots: Array.isArray(club.hostTimeslots) ? club.hostTimeslots.filter((slot): slot is "17:00" | "18:30" => slot === "17:00" || slot === "18:30") : [],
    })),
  }
}

// ---- Fixture generation ---------------------------------------------------

export async function generateFixtures(formData: FormData) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const divisionId = Number(formData.get("divisionId"))
  const [division] = await db
    .select({ id: divisions.id, seasonId: divisions.seasonId, name: divisions.name })
    .from(divisions)
    .where(eq(divisions.id, divisionId))
    .limit(1)
  if (!division) return { ok: false, error: "Division not found" }
  const [existing] = await db
    .select({ id: fixtures.id, status: fixtures.status })
    .from(fixtures)
    .where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.seasonId, division.seasonId)))
    .limit(1)
  if (existing) {
    return { ok: false, error: "Fixtures were already generated for this division and cannot be regenerated." }
  }

  const [season] = await db
    .select({ id: seasons.id, startDate: seasons.startDate })
    .from(seasons)
    .where(eq(seasons.id, division.seasonId))
    .limit(1)
  if (!season) return { ok: false, error: "Season not found" }

  const inputs = await loadSeasonFixtureInputs(division.seasonId, divisionId)
  const divisionEntries = inputs.entries
    .filter((entry) => entry.divisionId === divisionId)
    .sort((a, b) => (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER) || a.sortOrder - b.sortOrder)
  if (divisionEntries.length < 2) return { ok: false, error: "Need at least 2 teams in the division" }
  if (divisionEntries.some((entry) => entry.slot == null)) return { ok: false, error: "Every team in the division needs a placement slot before fixtures can be generated." }

  const planned = planSeason({
    startDate: season.startDate ? new Date(season.startDate) : new Date(),
    divisions: [
      {
        id: divisionId,
        teamSlots: divisionEntries.map((entry) => ({
          id: entry.teamId,
          slot: entry.slot as number,
          homeClubId: entry.homeClubId ?? null,
        })),
      },
    ],
    clubs: inputs.clubs,
  })

  await db.delete(fixtures).where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.seasonId, division.seasonId), eq(fixtures.status, DRAFT_FIXTURE_STATUS)))

  if (planned.length > 0) {
    await db.insert(fixtures).values(
      planned.map((fixture) => ({
        seasonId: division.seasonId,
        divisionId,
        week: fixture.week,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeSlot: fixture.homeSlot,
        awaySlot: fixture.awaySlot,
        matchDate: fixture.matchDate,
        timeslot: fixture.timeslot,
        venueClubId: fixture.venueClubId,
        venue: fixture.venue,
        courtAssignments: fixture.courtAssignments,
        status: DRAFT_FIXTURE_STATUS,
      })),
    )
  }

  await db.update(seasons).set({ status: "fixtures_generated", weeks: divisionEntries.length - 1 }).where(eq(seasons.id, division.seasonId))
  await syncSeasonTeamLifecycle(division.seasonId)
  revalidatePath("/admin")
  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
  return { ok: true, count: planned.length }
}

/**
 * Generate a complete season's draft fixture schedule.
 *
 * Uses the placed teams in every division, builds a balanced round robin, and
 * stores draft fixtures that only league admins can see until published.
 */
export async function generateSeason(formData: FormData) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const seasonId = Number(formData.get("seasonId"))
  const forceRegenerate = formData.get("force") === "1"
  const [season] = await db
    .select({
      id: seasons.id,
      startDate: seasons.startDate,
      regionalFinalsDate: seasons.regionalFinalsDate,
      regionalFinalsVenueClubId: seasons.regionalFinalsVenueClubId,
      mastersDate: seasons.mastersDate,
      mastersVenueClubId: seasons.mastersVenueClubId,
    })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1)
  if (!season) return { ok: false, error: "Season not found" }
  const existingSeasonFixtures = await db
    .select({ id: fixtures.id, status: fixtures.status, published: fixtures.published })
    .from(fixtures)
    .where(eq(fixtures.seasonId, seasonId))
  if (existingSeasonFixtures.length > 0) {
    if (!forceRegenerate) {
      return { ok: false, error: "Fixtures already exist for this season. Use redo fixture generation to replace the current draft." }
    }

    const protectedFixtures = existingSeasonFixtures.filter(
      (fixture) => fixture.published || (fixture.status !== DRAFT_FIXTURE_STATUS && fixture.status !== "scheduled"),
    )
    if (protectedFixtures.length > 0) {
      return { ok: false, error: "Only unpublished draft fixtures can be regenerated. Unpublish the season first if fixtures are already live." }
    }

    await db
      .delete(fixtures)
      .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.published, false), inArray(fixtures.status, [DRAFT_FIXTURE_STATUS, "scheduled"])))
  }

  const inputs = await loadSeasonFixtureInputs(seasonId)
  if (inputs.divisions.length === 0) return { ok: false, error: "No divisions configured for this season" }

  const divisionPlans = inputs.divisions.map((division) => {
    const teamsInDivision = inputs.entries
      .filter((entry) => entry.divisionId === division.id)
      .sort((a, b) => (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER) || a.sortOrder - b.sortOrder)
    return { division, teamsInDivision }
  })

  const emptyDivisions = divisionPlans.filter((plan) => plan.teamsInDivision.length === 0).map((plan) => plan.division.name)
  if (emptyDivisions.length > 0) {
    return {
      ok: false,
      error: `Every division needs teams before fixtures can be generated. Empty: ${emptyDivisions.slice(0, 4).join(", ")}${emptyDivisions.length > 4 ? ` and ${emptyDivisions.length - 4} more` : ""}.`,
    }
  }

  const shortDivisions = divisionPlans.filter((plan) => plan.teamsInDivision.length < 2).map((plan) => `${plan.division.name} (${plan.teamsInDivision.length})`)
  if (shortDivisions.length > 0) {
    return {
      ok: false,
      error: `Each division needs at least 2 teams. Fix: ${shortDivisions.slice(0, 4).join(", ")}${shortDivisions.length > 4 ? ` and ${shortDivisions.length - 4} more` : ""}.`,
    }
  }

  const missingSlots = divisionPlans
    .filter((plan) => plan.teamsInDivision.some((entry) => entry.slot == null))
    .map((plan) => plan.division.name)
  if (missingSlots.length > 0) {
    return { ok: false, error: `Every assigned team needs a placement slot before fixture generation. Fix: ${missingSlots.join(", ")}.` }
  }

  const planned = planSeason({
    startDate: season.startDate ? new Date(season.startDate) : new Date(),
    divisions: divisionPlans.map((plan) => ({
      id: plan.division.id,
      teamSlots: plan.teamsInDivision.map((entry) => ({
        id: entry.teamId,
        slot: entry.slot as number,
        homeClubId: entry.homeClubId ?? null,
      })),
    })),
    clubs: inputs.clubs,
  })

  const firstNight = nextThursday(season.startDate ? new Date(season.startDate) : new Date())
  let lastRoundDate = firstNight
  let maxWeek = 0
  for (const fixture of planned) {
    if (fixture.matchDate > lastRoundDate) lastRoundDate = fixture.matchDate
    if (fixture.week > maxWeek) maxWeek = fixture.week
  }

  if (planned.length > 0) {
    await db.insert(fixtures).values(
      planned.map((fixture) => ({
        seasonId,
        divisionId: fixture.divisionId,
        week: fixture.week,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeSlot: fixture.homeSlot,
        awaySlot: fixture.awaySlot,
        matchDate: fixture.matchDate,
        timeslot: fixture.timeslot,
        venueClubId: fixture.venueClubId,
        venue: fixture.venue,
        courtAssignments: fixture.courtAssignments,
        status: DRAFT_FIXTURE_STATUS,
      })),
    )
  }

  await syncSeasonTeamLifecycle(seasonId)

  // ---- Playoff placeholders -----------------------------------------------
  // Wipe any previously generated (un-played) playoff rows for this season.
  await db.delete(playoffs).where(and(eq(playoffs.seasonId, seasonId), eq(playoffs.status, "scheduled")))

  // Regional Finals: 9 days after the last league round (or the chosen date).
  const quarterFinalsDate = season.regionalFinalsDate
    ? new Date(season.regionalFinalsDate)
    : new Date(lastRoundDate.getTime() + REGIONAL_FINALS_GAP_DAYS * MS_PER_DAY)
  const finalsSunday = new Date(
    (season.mastersDate ? new Date(season.mastersDate) : new Date(quarterFinalsDate.getTime() + MS_PER_DAY)).getTime(),
  )
  finalsSunday.setHours(quarterFinalsDate.getHours(), quarterFinalsDate.getMinutes(), 0, 0)

  const generatedDivisions = divisionPlans.map((plan) => plan.division)
  const divisionsByLevel = new Map<number, typeof generatedDivisions>()
  for (const division of generatedDivisions) {
    const bucket = divisionsByLevel.get(division.level) ?? []
    bucket.push(division)
    divisionsByLevel.set(division.level, bucket)
  }
  for (const levelDivisions of divisionsByLevel.values()) {
    const ordered = [...levelDivisions].sort((a, b) => a.id - b.id)
    const anchor = ordered[0]
    const templates = buildDivisionPlayoffTemplates({
      divisionId: anchor.id,
      divisionName: anchor.name,
    })
    await db.insert(playoffs).values(
      templates.map((t) => ({
        seasonId,
        type: t.type,
        round: t.round,
        divisionId: t.divisionId,
        regionId: t.regionId,
        bracketPosition: t.bracketPosition,
        homeSeed: t.homeSeed,
        awaySeed: t.awaySeed,
        homeSourceBracket: t.homeSourceBracket,
        awaySourceBracket: t.awaySourceBracket,
        homeLabel: t.homeLabel,
        awayLabel: t.awayLabel,
        matchDate: t.round === "quarter_final" ? quarterFinalsDate : finalsSunday,
        venueClubId: season.regionalFinalsVenueClubId ?? season.mastersVenueClubId ?? null,
        status: "scheduled" as const,
      })),
    )
  }

  // Fixture generation is a one-time phase transition.
  // Store the auto-calculated week count so the UI can display it correctly.
  await db
    .update(seasons)
    .set({ status: "fixtures_generated", weeks: maxWeek > 0 ? maxWeek : undefined })
    .where(eq(seasons.id, seasonId))
  await syncSeasonTeamLifecycle(seasonId)

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  revalidatePath("/admin")
  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
  revalidatePath("/fixtures")
  return { ok: true, count: planned.length, divisions: divisionPlans.length }
}

/**
 * Rebuild a single division's draft fixture schedule from the teams currently
 * placed into that division. Completed/disputed results are preserved.
 */
export async function adjustDivisionFixtures(formData: FormData) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const divisionId = Number(formData.get("divisionId"))
  const [division] = await db
    .select({ id: divisions.id, seasonId: divisions.seasonId })
    .from(divisions)
    .where(eq(divisions.id, divisionId))
    .limit(1)
  if (!division) return { ok: false, error: "Division not found" }

  const [season] = await db
    .select({ id: seasons.id, startDate: seasons.startDate })
    .from(seasons)
    .where(eq(seasons.id, division.seasonId))
    .limit(1)
  if (!season) return { ok: false, error: "Season not found" }

  const inputs = await loadSeasonFixtureInputs(division.seasonId, divisionId)
  const entries = inputs.entries
    .filter((entry) => entry.divisionId === divisionId)
    .sort((a, b) => (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER) || a.sortOrder - b.sortOrder)
  if (entries.length < 2) return { ok: false, error: "Assign at least 2 teams before adjusting fixtures." }
  if (entries.some((entry) => entry.slot == null)) return { ok: false, error: "Every assigned team needs a placement slot before adjusting fixtures." }

  await db.delete(fixtures).where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.seasonId, division.seasonId), eq(fixtures.status, DRAFT_FIXTURE_STATUS)))

  const planned = planSeason({
    startDate: season.startDate ? new Date(season.startDate) : new Date(),
    divisions: [
      {
        id: divisionId,
        teamSlots: entries.map((entry) => ({
          id: entry.teamId,
          slot: entry.slot as number,
          homeClubId: entry.homeClubId ?? null,
        })),
      },
    ],
    clubs: inputs.clubs,
  })

  if (planned.length > 0) {
    await db.insert(fixtures).values(
      planned.map((fixture) => ({
        seasonId: division.seasonId,
        divisionId,
        week: fixture.week,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeSlot: fixture.homeSlot,
        awaySlot: fixture.awaySlot,
        matchDate: fixture.matchDate,
        timeslot: fixture.timeslot,
        venueClubId: fixture.venueClubId,
        venue: fixture.venue,
        courtAssignments: fixture.courtAssignments,
        status: DRAFT_FIXTURE_STATUS,
      })),
    )
  }

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  revalidatePath("/dashboard/fixtures")
  revalidatePath("/league-centre")
  revalidatePath("/fixtures")
  return { ok: true, teams: entries.length, rounds: entries.length - 1, fixtures: planned.length }
}

// ---- Playoffs -------------------------------------------------------------

export async function generatePlayoffs(formData: FormData) {
  await requireAdmin()
  const divisionId = Number(formData.get("divisionId"))
  const [division] = await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.id, divisionId)).limit(1)
  if (!division) return { ok: false, error: "Division not found" }

  const table = await db
    .select()
    .from(standings)
    .where(eq(standings.divisionId, divisionId))
    .orderBy(asc(standings.rank))
  if (table.length < 4) return { ok: false, error: "Need a completed table with at least 4 teams" }

  const top4 = table.slice(0, 4).map((s) => ({ rank: s.rank, teamId: s.teamId }))
  const pairings = generateRegionalFinals(top4)

  // clear previous regional finals for this season/division
  await db
    .delete(playoffs)
    .where(and(eq(playoffs.seasonId, division.seasonId), eq(playoffs.type, "regional_final"), eq(playoffs.divisionId, divisionId)))

  for (const p of pairings) {
    await db.insert(playoffs).values({
      seasonId: division.seasonId,
      type: "regional_final",
      round: p.round === "Final" ? "final" : "semi_final",
      divisionId,
      homeTeamId: p.homeTeamId,
      awayTeamId: p.awayTeamId,
      bracketPosition: p.bracketPosition,
      status: "scheduled",
    })
  }

  revalidatePath("/admin")
  return { ok: true }
}

/**
 * Resolve every placeholder playoff slot for a season into a real team using the
 * current league standings:
 *  - Division playoff quarter-finals: seed N -> the qualifier seeded N across
 *    all regions of that division level.
 *  - Semi-finals / final: fed by completed prior rounds using source brackets.
 * Re-runnable: it overwrites slots so brackets stay in sync as results land.
 */
export async function pullPlayoffTeams(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }

  const rows = await db
    .select({
      id: playoffs.id,
      type: playoffs.type,
      round: playoffs.round,
      divisionId: playoffs.divisionId,
      homeTeamId: playoffs.homeTeamId,
      awayTeamId: playoffs.awayTeamId,
      homeSeed: playoffs.homeSeed,
      awaySeed: playoffs.awaySeed,
      homeRegionId: playoffs.homeRegionId,
      awayRegionId: playoffs.awayRegionId,
      homeSourceBracket: playoffs.homeSourceBracket,
      awaySourceBracket: playoffs.awaySourceBracket,
      bracketPosition: playoffs.bracketPosition,
      winnerTeamId: playoffs.winnerTeamId,
    })
    .from(playoffs)
    .where(eq(playoffs.seasonId, seasonId))
  if (rows.length === 0) return { ok: false, error: "No playoff fixtures to populate. Generate the season first." }

  // Standings by division, ranked.
  const seasonDivisions = await db
    .select({ id: divisions.id, name: divisions.name, level: divisions.level, regionId: divisions.regionId })
    .from(divisions)
    .where(eq(divisions.seasonId, seasonId))
  const divIds = seasonDivisions.map((d) => d.id)
  const allStandings = divIds.length
    ? await db
        .select({
          divisionId: standings.divisionId,
          teamId: standings.teamId,
          rank: standings.rank,
          points: standings.points,
          wins: standings.wins,
          setsWon: standings.setsWon,
          pointsDiff: standings.pointsDiff,
        })
        .from(standings)
        .where(inArray(standings.divisionId, divIds))
        .orderBy(asc(standings.divisionId), asc(standings.rank))
    : []
  const divisionById = new Map(seasonDivisions.map((d) => [d.id, d]))
  const qualifiersByAnchorDivision = new Map<number, Map<number, number>>()
  const levelGroups = new Map<number, typeof seasonDivisions>()
  for (const division of seasonDivisions) {
    const bucket = levelGroups.get(division.level) ?? []
    bucket.push(division)
    levelGroups.set(division.level, bucket)
  }
  for (const levelDivisions of levelGroups.values()) {
    const ordered = [...levelDivisions].sort((a, b) => a.id - b.id)
    const anchor = ordered[0]
    const qualifiers = computeDivisionPlayoffQualifiers(
      allStandings
        .filter((row) => ordered.some((division) => division.id === row.divisionId))
        .map((row) => {
          const division = divisionById.get(row.divisionId)
          return {
            divisionId: row.divisionId,
            divisionLevel: division?.level ?? 0,
            divisionName: division?.name ?? "Division",
            regionId: division?.regionId ?? null,
            regionName: null,
            teamId: row.teamId,
            rank: row.rank,
            points: row.points,
            wins: row.wins,
            setsWon: row.setsWon,
            pointsDiff: row.pointsDiff,
          }
        }),
    )
    qualifiersByAnchorDivision.set(anchor.id, new Map(qualifiers.map((q) => [q.seed, q.teamId])))
  }

  let filled = 0
  // First pass: quarter-finals resolve directly from live qualification seeds.
  for (const p of rows) {
    if (p.round !== "quarter_final") continue
    let home = p.homeTeamId
    let away = p.awayTeamId
    if (p.type === "regional_final" && p.divisionId != null) {
      const qualifiers = qualifiersByAnchorDivision.get(p.divisionId) ?? new Map<number, number>()
      if (p.homeSeed != null) home = qualifiers.get(p.homeSeed) ?? null
      if (p.awaySeed != null) away = qualifiers.get(p.awaySeed) ?? null
    }
    if (home !== p.homeTeamId || away !== p.awayTeamId) {
      await db.update(playoffs).set({ homeTeamId: home, awayTeamId: away }).where(eq(playoffs.id, p.id))
      filled++
    }
  }

  // Refresh after the semi update so finals can read semi winners.
  const refreshed = await db
    .select({
      id: playoffs.id,
      type: playoffs.type,
      round: playoffs.round,
      divisionId: playoffs.divisionId,
      bracketPosition: playoffs.bracketPosition,
      winnerTeamId: playoffs.winnerTeamId,
    })
    .from(playoffs)
    .where(eq(playoffs.seasonId, seasonId))
  const winnerByBracket = (type: string, divisionId: number | null, bracket: number) => {
    const match = refreshed.find(
      (x) =>
        x.type === type &&
        x.bracketPosition === bracket &&
        (divisionId == null || x.divisionId === divisionId),
    )
    return match?.winnerTeamId ?? null
  }

  // Second pass: semis and finals fed by completed prior rounds.
  for (const p of rows) {
    if (p.round === "quarter_final") continue
    let home = p.homeTeamId
    let away = p.awayTeamId
    if (p.homeSourceBracket != null) home = winnerByBracket(p.type, p.divisionId, p.homeSourceBracket)
    if (p.awaySourceBracket != null) away = winnerByBracket(p.type, p.divisionId, p.awaySourceBracket)
    if (home !== p.homeTeamId || away !== p.awayTeamId) {
      await db.update(playoffs).set({ homeTeamId: home, awayTeamId: away }).where(eq(playoffs.id, p.id))
      filled++
    }
  }

  revalidatePath("/admin")
  return { ok: true, filled }
}

/**
 * Set the date / timeslot / court (venue) for a single playoff fixture. Used by
 * the playoffs dashboard so admins can schedule each bracket game.
 */
export async function setPlayoffSchedule(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get("playoffId"))
  if (!id) return { ok: false, error: "Playoff id required" }

  const dateStr = String(formData.get("matchDate") ?? "").trim()
  const timeslot = String(formData.get("timeslot") ?? "").trim() || null
  const venueRaw = String(formData.get("venueClubId") ?? "").trim()
  const venueClubId = venueRaw ? Number(venueRaw) : null

  let venue: string | null = null
  if (venueClubId) {
    const [club] = await db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, venueClubId)).limit(1)
    venue = club?.name ?? null
  }

  await db
    .update(playoffs)
    .set({ matchDate: dateStr ? new Date(dateStr) : null, timeslot, venueClubId, venue })
    .where(eq(playoffs.id, id))

  revalidatePath("/admin")
  return { ok: true }
}

// ---- Disputes -------------------------------------------------------------

export async function resolveDispute(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("disputeId"))
  const status = String(formData.get("status") ?? "resolved") as "resolved" | "rejected"
  const resolution = String(formData.get("resolution") ?? "")
  const penalty = String(formData.get("penalty") ?? "") || null

  const [dispute] = await db
    .select({ id: disputes.id, fixtureId: disputes.fixtureId, raisedByUserId: disputes.raisedByUserId })
    .from(disputes)
    .where(eq(disputes.id, id))
    .limit(1)
  if (!dispute) return { ok: false, error: "Dispute not found" }

  await db
    .update(disputes)
    .set({ status, resolution, penalty, resolvedByUserId: admin.id, resolvedAt: new Date() })
    .where(eq(disputes.id, id))

  // clear fixture disputed flag if resolved
  if (dispute.fixtureId && status === "resolved") {
    await db.update(fixtures).set({ status: "scheduled" }).where(
      and(eq(fixtures.id, dispute.fixtureId), eq(fixtures.status, "disputed")),
    )
    const [fx] = await db
      .select({ homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId })
      .from(fixtures)
      .where(eq(fixtures.id, dispute.fixtureId))
      .limit(1)
    if (fx?.homeTeamId != null) await syncTeamLifecycleStatus(fx.homeTeamId)
    if (fx?.awayTeamId != null) await syncTeamLifecycleStatus(fx.awayTeamId)
  }

  await notify({
    userId: dispute.raisedByUserId,
    scope: "direct",
    type: "dispute_update",
    title: `Dispute ${status}`,
    body: resolution || `Your dispute has been ${status}.`,
  })

  revalidatePath("/admin")
  return { ok: true }
}

// ---- Season / Division config --------------------------------------------

export async function createSeason(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") ?? "").trim()
  const startStr = String(formData.get("startDate") ?? "").trim()
  const regionNamesRaw = String(formData.get("regionNames") ?? "").trim()
  const makeCurrent = formData.get("makeCurrent") === "on" || formData.get("makeCurrent") === "true"
  const feeRaw = Number(formData.get("playerFee") ?? 500)
  const playerFee = Number.isFinite(feeRaw) && feeRaw >= 0 ? Math.round(feeRaw) : 500
  // Max teams per division — the only division setting chosen up front. The
  // full region x division grid is seeded automatically so teams can be dragged
  // straight in; unused divisions are pruned later at fixture generation.
  const maxRaw = Number(formData.get("maxTeams") ?? TEAMS_PER_DIVISION)
  const maxTeams = Number.isFinite(maxRaw) && maxRaw >= 2 ? Math.min(16, Math.round(maxRaw)) : TEAMS_PER_DIVISION
  if (!name) return { ok: false, error: "Season name required" }

  const startDate = startStr ? new Date(startStr) : null
  // weeks will be auto-calculated when fixtures are generated; store 0 as placeholder
  const endDate = null
  const existingRegions = await db.select({ id: regions.id, name: regions.name }).from(regions).orderBy(asc(regions.id))
  const fallbackRegionNames = existingRegions.length > 0 ? existingRegions.map((r) => r.name) : [...TSHWANE_REGIONS]
  const regionNames = parseRegionNames(regionNamesRaw || fallbackRegionNames.join("\n"))
  if (regionNames.length === 0) return { ok: false, error: "Add at least one region" }

  // Optional playoff scheduling captured at creation (used by Generate Season).
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v ? Number(v) : null
  }
  const date = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v ? new Date(v) : null
  }

  if (makeCurrent) {
    await db.update(seasons).set({ isCurrent: false })
  }
  const [created] = await db
    .insert(seasons)
    .values({
      name,
      weeks: 0, // will be auto-calculated when fixtures are generated
      startDate,
      endDate,
      status: "registration_open",
      isCurrent: makeCurrent,
      playerFee,
      regionalFinalsVenueClubId: num("regionalFinalsVenueClubId"),
      regionalFinalsDate: date("regionalFinalsDate"),
      mastersVenueClubId: num("mastersVenueClubId"),
      mastersDate: date("mastersDate"),
    })
    .returning({ id: seasons.id })

  const existingRegionByName = new Map(existingRegions.map((r) => [r.name.trim().toLowerCase(), r]))
  const seasonRegions: { id: number; name: string }[] = []
  for (const regionName of regionNames) {
    const existing = existingRegionByName.get(regionName.toLowerCase())
    if (existing) {
      seasonRegions.push(existing)
      continue
    }
    const [inserted] = await db
      .insert(regions)
      .values({
        name: regionName,
        slug: slugifyRegion(regionName),
        province: "Gauteng",
        level: "region",
      })
      .returning({ id: regions.id, name: regions.name })
    existingRegionByName.set(regionName.toLowerCase(), inserted)
    seasonRegions.push(inserted)
  }

  // Seed only the chosen season regions so admins can run 3-region or custom
  // conference setups without inheriting the full legacy region list.
  const divisionRows = seasonRegions.flatMap((r) =>
    DIVISIONS.map((d) => ({
      seasonId: created.id,
      name: d.name,
      level: d.level,
      maxTeams,
      regionId: r.id,
    })),
  )
  if (divisionRows.length > 0) {
    await db.insert(divisions).values(divisionRows)
  }

  // Any venue that declared it will enter team(s) should automatically have
  // those teams ready as unassigned entries for the new season. Reconcile every
  // club so a "2 teams" venue gets its A and B teams even with no players yet.
  const allClubs = await db.select({ id: clubs.id }).from(clubs)
  for (const c of allClubs) await reconcileClubTeams(c.id)

  revalidatePath("/admin")
  return { ok: true, seasonId: created.id }
}

// ---- Season lifecycle: Registration Open -> Divisions Finalised -> Fixtures Generated -> League Locked ----

/** Run validation and return the full report (does not change status). */
export async function checkSeason(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const report = await validateSeason(seasonId)
  return { ok: true, report }
}

/**
 * Validate the season and, when clean, mark it "divisions_finalised". Returns the report
 * either way so the UI can surface errors/warnings.
 */
export async function validateSeasonAction(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const report = await validateSeason(seasonId)
  revalidatePath("/admin")
  return { ok: report.ok, report, error: report.ok ? undefined : "Fix all validation errors before publishing fixtures." }
}

/**
 * Start a fixtures-generated season (status -> "league_locked"). Makes fixtures live to players
 * and LOCKS editing of team names, home venues and club court-slot settings.
 * Gated on:
 *  - a clean validation (no errors), re-run defensively, and
 *  - every assigned team having a captain.
 */
export async function publishSeasonAction(formData: FormData) {
  const admin = await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const report = await validateSeason(seasonId)
  if (!report.ok) {
    return { ok: false, report, error: "Season still has validation errors." }
  }

  const editableFixtures = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.published, false)))
  const fixtureIds = editableFixtures.map((fixture) => fixture.id)
  if (fixtureIds.length === 0) return { ok: false, report, error: "No draft fixtures found to publish." }

  await db
    .update(fixtures)
    .set({
      status: "scheduled",
      published: true,
      publishedAt: new Date(),
      publishedByUserId: admin.id,
      updatedByUserId: admin.id,
      updatedAt: new Date(),
    })
    .where(inArray(fixtures.id, fixtureIds))

  await db.update(seasons).set({ status: "league_locked" }).where(eq(seasons.id, seasonId))
  await syncSeasonTeamLifecycle(seasonId)
  revalidatePath("/admin")
  revalidatePath("/admin/clubs")
  revalidatePath("/fixtures")
  revalidatePath("/league-centre")
  revalidatePath("/dashboard/fixtures")
  return { ok: true, report }
}

/**
 * Move published fixtures back to draft visibility so admins can keep editing
 * the schedule inside League Management without exposing it to clubs/players.
 */
export async function unlockSeasonAction(formData: FormData) {
  const admin = await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const editableFixtures = await db
    .select({ id: fixtures.id, status: fixtures.status })
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.published, true)))
  const editableIds = editableFixtures
    .filter((fixture) => fixture.status !== "completed" && fixture.status !== "disputed")
    .map((fixture) => fixture.id)
  if (editableIds.length > 0) {
    await db
      .update(fixtures)
      .set({
        status: DRAFT_FIXTURE_STATUS,
        published: false,
        publishedAt: null,
        publishedByUserId: null,
        updatedByUserId: admin.id,
        updatedAt: new Date(),
      })
      .where(inArray(fixtures.id, editableIds))
  }
  await db.update(seasons).set({ status: "fixtures_generated" }).where(eq(seasons.id, seasonId))
  await syncSeasonTeamLifecycle(seasonId)
  revalidatePath("/admin")
  revalidatePath("/admin/clubs")
  revalidatePath("/fixtures")
  revalidatePath("/league-centre")
  revalidatePath("/dashboard/fixtures")
  return { ok: true }
}

/** Move a season back to draft for further editing. */
export async function revertSeasonToDraftAction(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  await db.update(seasons).set({ status: "registration_open" }).where(eq(seasons.id, seasonId))
  await syncSeasonTeamLifecycle(seasonId)
  revalidatePath("/admin")
  return { ok: true }
}

/**
 * Permanently delete a season and everything seeded under it: divisions, the
 * placement board entries, fixtures (and their disputes), standings and
 * playoffs. Live teams are detached from the season so they fall back to
 * "unassigned" rather than pointing at a deleted division.
 */
export async function deleteSeason(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const [season] = await db
    .select({ status: seasons.status })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1)
  if (!season) return { ok: false, error: "Season not found" }
  if (["league_locked", "active", "published"].includes(season.status)) return seasonLockedResult()

  // Disputes hang off fixtures, so clear them before the fixtures go.
  const fxRows = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.seasonId, seasonId))
  if (fxRows.length > 0) {
    await db.delete(disputes).where(inArray(disputes.fixtureId, fxRows.map((f) => f.id)))
  }

  await db.delete(playoffs).where(eq(playoffs.seasonId, seasonId))
  await db.delete(standings).where(eq(standings.seasonId, seasonId))
  await db.delete(fixtures).where(eq(fixtures.seasonId, seasonId))
  await db.delete(teamEntries).where(eq(teamEntries.seasonId, seasonId))
  await db.delete(divisions).where(eq(divisions.seasonId, seasonId))

  // Detach any live team still pointing at this season.
  const detachedTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.seasonId, seasonId))
  await db.update(teams).set({ divisionId: null, seasonId: null }).where(eq(teams.seasonId, seasonId))
  for (const team of detachedTeams) await syncTeamLifecycleStatus(team.id)

  await db.delete(seasons).where(eq(seasons.id, seasonId))

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  return { ok: true }
}

export async function createDivision(formData: FormData) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const seasonId = Number(formData.get("seasonId"))
  const name = String(formData.get("name") ?? "").trim()
  const level = Number(formData.get("level") ?? 4)
  const maxTeams = Number(formData.get("maxTeams") ?? 6)
  const regionId = formData.get("regionId") ? Number(formData.get("regionId")) : null
  if (!name) return { ok: false, error: "Division name required" }

  await db.insert(divisions).values({ seasonId, name, level, maxTeams, regionId })
  revalidatePath("/admin")
  return { ok: true }
}

/**
 * Reconcile every division for a season from the region x division matrix.
 * Ticked cells that don't exist yet are created; unticked cells that exist are
 * removed (unless they already have placed teams or fixtures, which are kept).
 */
export async function setSeasonDivisions(input: {
  seasonId: number
  cells: { regionId: number | null; name: string; level: number; maxTeams: number; active: boolean }[]
}) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const { seasonId } = input
  const existing = await db
    .select({ id: divisions.id, regionId: divisions.regionId, level: divisions.level, maxTeams: divisions.maxTeams })
    .from(divisions)
    .where(eq(divisions.seasonId, seasonId))
  const keyOf = (regionId: number | null, level: number) => `${regionId ?? "none"}:${level}`
  const existingByKey = new Map(existing.map((d) => [keyOf(d.regionId, d.level), d]))

  let created = 0
  let removed = 0
  let skipped = 0

  for (const cell of input.cells) {
    const ex = existingByKey.get(keyOf(cell.regionId, cell.level))
    if (cell.active && !ex) {
      await db.insert(divisions).values({
        seasonId,
        name: cell.name,
        level: cell.level,
        maxTeams: cell.maxTeams,
        regionId: cell.regionId,
      })
      created++
    } else if (cell.active && ex && ex.maxTeams !== cell.maxTeams) {
      await db.update(divisions).set({ maxTeams: cell.maxTeams }).where(eq(divisions.id, ex.id))
    } else if (!cell.active && ex) {
      const [entry] = await db.select({ id: teamEntries.id }).from(teamEntries).where(eq(teamEntries.divisionId, ex.id)).limit(1)
      const [fx] = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.divisionId, ex.id)).limit(1)
      if (entry || fx) {
        skipped++
        continue
      }
      await db.delete(divisions).where(eq(divisions.id, ex.id))
      removed++
    }
  }

  revalidatePath("/admin")
  return { ok: true, created, removed, skipped }
}

export async function setDivisionRegion(formData: FormData) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const divisionId = Number(formData.get("divisionId"))
  const regionId = formData.get("regionId") ? Number(formData.get("regionId")) : null
  await db.update(divisions).set({ regionId }).where(eq(divisions.id, divisionId))
  revalidatePath("/admin")
  return { ok: true }
}

// Assign a team to a division (and inherit the division's season + region).
export async function assignTeamToDivision(formData: FormData) {
  await requireAdmin()
  if (await isSeasonLocked()) return seasonLockedResult()
  const teamId = Number(formData.get("teamId"))
  const divisionId = formData.get("divisionId") ? Number(formData.get("divisionId")) : null

  if (divisionId === null) {
    await db.update(teams).set({ divisionId: null }).where(eq(teams.id, teamId))
    await syncTeamLifecycleStatus(teamId)
    revalidatePath("/admin")
    return { ok: true }
  }

  const [division] = await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.id, divisionId)).limit(1)
  if (!division) return { ok: false, error: "Division not found" }

  // Respect the division capacity.
  const current = await db.select({ id: teams.id }).from(teams).where(eq(teams.divisionId, divisionId))
  const alreadyIn = current.some((t) => t.id === teamId)
  if (!alreadyIn && current.length >= division.maxTeams) {
    return { ok: false, error: `${division.name} is full (${division.maxTeams} teams).` }
  }

  await db
    .update(teams)
    .set({ divisionId, seasonId: division.seasonId, regionId: division.regionId, updatedAt: new Date() })
    .where(eq(teams.id, teamId))
  await syncTeamLifecycleStatus(teamId)

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  return { ok: true }
}

export async function setCurrentSeason(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  const status = String(formData.get("status") ?? "")
  if (status) {
    await db.update(seasons).set({ status }).where(eq(seasons.id, seasonId))
  } else {
    await db.update(seasons).set({ isCurrent: false })
    await db.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, seasonId))
  }
  revalidatePath("/admin")
  return { ok: true }
}

// ---- Broadcasts -----------------------------------------------------------

export async function broadcastNotification(formData: FormData) {
  await requireAdmin()
  const title = String(formData.get("title") ?? "").trim()
  const body = String(formData.get("body") ?? "").trim()
  const audience = String(formData.get("audience") ?? "all") as "all" | "captains" | "org_admins"
  if (!title || !body) return { ok: false, error: "Title and message required" }

  // Resolve recipient user ids based on audience.
  let recipients: { userId: string }[]
  if (audience === "all") {
    recipients = await db.select({ userId: userMeta.userId }).from(userMeta)
  } else {
    const role = audience === "captains" ? "captain" : "org_admin"
    recipients = await db.select({ userId: userMeta.userId }).from(userMeta).where(eq(userMeta.role, role))
  }

  for (const r of recipients) {
    await notify({
      userId: r.userId,
      scope: "direct",
      type: "announcement",
      title,
      body,
    })
  }

  revalidatePath("/admin/broadcasts")
  revalidatePath("/dashboard/notifications")
  return { ok: true, count: recipients.length }
}

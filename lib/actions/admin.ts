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
  generateRoundRobin,
  generateRegionalFinals,
  buildRegionalFinalTemplates,
  buildMastersTemplates,
} from "@/lib/engine/playoffs"
import { nextThursday, balanceTimeslots } from "@/lib/engine/season"
import { syncDivisionFixtures } from "@/lib/fixtures-sync"
import { validateSeason } from "@/lib/engine/validation"
import { REGIONAL_FINALS_GAP_DAYS, TSHWANE_MASTERS_GAP_DAYS, DIVISIONS, TEAMS_PER_DIVISION } from "@/lib/constants"
import { notify } from "@/lib/notify"

const MS_PER_DAY = 24 * 60 * 60 * 1000

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  if (user.realRole !== "league_admin" && user.realRole !== "super_admin") {
    throw new Error("League admin access required")
  }
  return user
}

// ---- Fixture generation ---------------------------------------------------

export async function generateFixtures(formData: FormData) {
  await requireAdmin()
  const divisionId = Number(formData.get("divisionId"))
  const [division] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
  if (!division) return { ok: false, error: "Division not found" }

  const divTeams = await db.select().from(teams).where(eq(teams.divisionId, divisionId))
  if (divTeams.length < 2) return { ok: false, error: "Need at least 2 teams in the division" }

  // wipe scheduled fixtures for this division
  await db.delete(fixtures).where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.status, "scheduled")))

  const schedule = generateRoundRobin(divTeams.map((t) => t.id))
  const [season] = await db.select().from(seasons).where(eq(seasons.id, division.seasonId)).limit(1)
  const start = season?.startDate ? new Date(season.startDate) : new Date()

  for (const g of schedule) {
    const matchDate = new Date(start)
    matchDate.setDate(matchDate.getDate() + (g.week - 1) * 7)
    await db.insert(fixtures).values({
      seasonId: division.seasonId,
      divisionId,
      week: g.week,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      matchDate,
      status: "scheduled",
    })
  }

  revalidatePath("/admin/fixtures")
  revalidatePath("/fixtures")
  return { ok: true, count: schedule.length }
}

/**
 * Generate a complete season's fixture template.
 *
 * Builds a slot-based round-robin for every division (slots 1..maxTeams) so the
 * full schedule exists the moment a season is created — before any team is
 * placed. Each fixture stores the home/away slot numbers; as teams are dropped
 * into slots on the Placement Board the templates are linked to real teams and
 * their home-club venues (see `syncDivisionFixtures`). Idempotent: only wipes
 * this season's scheduled (not completed/disputed) fixtures.
 */
export async function generateSeason(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
  if (!season) return { ok: false, error: "Season not found" }

  const allDivs = await db
    .select()
    .from(divisions)
    .where(eq(divisions.seasonId, seasonId))
    .orderBy(asc(divisions.level), asc(divisions.id))
  if (allDivs.length === 0) return { ok: false, error: "No divisions configured for this season" }

  // Prune divisions (and therefore regions) with no assigned teams so unused
  // ones aren't part of the season. A division is kept if it has at least one
  // assigned team entry, or already-played (completed/disputed) fixtures.
  const assignedRows = await db
    .select({ divisionId: teamEntries.divisionId })
    .from(teamEntries)
    .where(and(eq(teamEntries.seasonId, seasonId), eq(teamEntries.status, "assigned")))
  const divisionsWithTeams = new Set(
    assignedRows.map((r) => r.divisionId).filter((x): x is number => x != null),
  )
  // Number of teams actually placed into each division. Used to size the
  // round-robin to the real squad count (6/7/8…) instead of always filling
  // every slot, so no fixtures are scheduled against empty placeholder slots.
  const assignedCountByDivision = new Map<number, number>()
  for (const r of assignedRows) {
    if (r.divisionId == null) continue
    assignedCountByDivision.set(r.divisionId, (assignedCountByDivision.get(r.divisionId) ?? 0) + 1)
  }

  const emptyDivIds: number[] = []
  for (const d of allDivs) {
    if (divisionsWithTeams.has(d.id)) continue
    const [played] = await db
      .select({ id: fixtures.id })
      .from(fixtures)
      .where(and(eq(fixtures.divisionId, d.id), inArray(fixtures.status, ["completed", "disputed"])))
      .limit(1)
    if (!played) emptyDivIds.push(d.id)
  }
  if (emptyDivIds.length > 0) {
    // Remove the empty divisions' scheduled fixtures, placement entries and the
    // divisions themselves. Regions become inactive automatically once they
    // have no remaining divisions in this season.
    await db
      .delete(fixtures)
      .where(and(inArray(fixtures.divisionId, emptyDivIds), eq(fixtures.status, "scheduled")))
    await db.delete(teamEntries).where(inArray(teamEntries.divisionId, emptyDivIds))
    await db.delete(divisions).where(inArray(divisions.id, emptyDivIds))
  }

  const divs = allDivs.filter((d) => !emptyDivIds.includes(d.id))
  if (divs.length === 0) {
    return { ok: false, error: "Assign teams to at least one division before generating fixtures." }
  }

  const firstNight = nextThursday(season.startDate ? new Date(season.startDate) : new Date())

  // Idempotent rebuild: remove only scheduled fixtures for this season.
  await db.delete(fixtures).where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.status, "scheduled")))

  let total = 0
  let lastRoundDate = firstNight
  for (const d of divs) {
    const maxTeams = d.maxTeams ?? 8
    if (maxTeams < 2) continue
    const slots = Array.from({ length: maxTeams }, (_, i) => i + 1)
    const rr = generateRoundRobin(slots)
    if (rr.length === 0) continue
    // Balance 17:00 / 18:30 fairly across each division slot for the season.
    const timeslots = balanceTimeslots(rr.map((g) => ({ homeSlot: g.homeTeamId, awaySlot: g.awayTeamId })))
    await db.insert(fixtures).values(
      rr.map((g, i) => {
        const matchDate = new Date(firstNight.getTime() + (g.week - 1) * 7 * MS_PER_DAY)
        if (matchDate > lastRoundDate) lastRoundDate = matchDate
        return {
          seasonId,
          divisionId: d.id,
          week: g.week,
          // g.home/awayTeamId here are slot numbers, not team ids.
          homeSlot: g.homeTeamId,
          awaySlot: g.awayTeamId,
          matchDate,
          timeslot: timeslots[i],
          status: "scheduled" as const,
        }
      }),
    )
    total += rr.length
  }

  // Link any teams already placed (and their venues) into the fresh template.
  for (const d of divs) await syncDivisionFixtures(d.id)

  // ---- Playoff + Tshwane Masters placeholders -----------------------------
  // Wipe any previously generated (un-played) playoff rows for this season.
  await db.delete(playoffs).where(and(eq(playoffs.seasonId, seasonId), eq(playoffs.status, "scheduled")))

  const allRegions = await db.select().from(regions)
  const regionNameById = new Map(allRegions.map((r) => [r.id, r.name]))
  const regionIdByName = new Map(allRegions.map((r) => [r.name, r.id]))

  // Regional Finals: 9 days after the last league round (or the chosen date).
  const regionalFinalsDate = season.regionalFinalsDate
    ? new Date(season.regionalFinalsDate)
    : new Date(lastRoundDate.getTime() + REGIONAL_FINALS_GAP_DAYS * MS_PER_DAY)

  for (const d of divs) {
    const regionLabel = d.regionId ? (regionNameById.get(d.regionId)?.replace("Tshwane ", "") ?? null) : null
    const templates = buildRegionalFinalTemplates({
      divisionId: d.id,
      divisionName: d.name,
      regionId: d.regionId ?? null,
      regionLabel,
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
        matchDate: regionalFinalsDate,
        venueClubId: season.regionalFinalsVenueClubId ?? null,
        status: "scheduled" as const,
      })),
    )
  }

  // Tshwane Masters: 7 days after the Regional Finals (or the chosen date).
  const mastersDate = season.mastersDate
    ? new Date(season.mastersDate)
    : new Date(regionalFinalsDate.getTime() + TSHWANE_MASTERS_GAP_DAYS * MS_PER_DAY)
  const mastersTemplates = buildMastersTemplates(regionIdByName)
  await db.insert(playoffs).values(
    mastersTemplates.map((t) => ({
      seasonId,
      type: t.type,
      round: t.round,
      bracketPosition: t.bracketPosition,
      homeRegionId: t.homeRegionId,
      awayRegionId: t.awayRegionId,
      homeSourceBracket: t.homeSourceBracket,
      awaySourceBracket: t.awaySourceBracket,
      homeLabel: t.homeLabel,
      awayLabel: t.awayLabel,
      matchDate: mastersDate,
      venueClubId: season.mastersVenueClubId ?? null,
      status: "scheduled" as const,
    })),
  )

  // Generation produces a Draft season; it must be validated before publishing.
  await db.update(seasons).set({ status: "draft" }).where(eq(seasons.id, seasonId))

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  revalidatePath("/admin")
  revalidatePath("/dashboard/fixtures")
  revalidatePath("/fixtures")
  return { ok: true, count: total, divisions: divs.length }
}

/**
 * Re-fit a single division's league fixtures to the number of teams currently
 * assigned to it. A division defaults to 8 slots; when fewer teams are placed
 * (e.g. 6 or 7) the admin can shrink the round-robin so there are no fixtures
 * against empty slots. Never grows beyond the division's maxTeams. Only
 * scheduled fixtures are rebuilt — completed/disputed results are preserved.
 */
export async function adjustDivisionFixtures(formData: FormData) {
  await requireAdmin()
  const divisionId = Number(formData.get("divisionId"))
  const [division] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
  if (!division) return { ok: false, error: "Division not found" }

  const [season] = await db.select().from(seasons).where(eq(seasons.id, division.seasonId)).limit(1)
  if (!season) return { ok: false, error: "Season not found" }

  // Count assigned teams (placed into a slot) for this division.
  const entries = await db
    .select({ id: teamEntries.id })
    .from(teamEntries)
    .where(
      and(
        eq(teamEntries.seasonId, division.seasonId),
        eq(teamEntries.divisionId, divisionId),
        eq(teamEntries.status, "assigned"),
      ),
    )
  const maxTeams = division.maxTeams ?? 8
  const assigned = entries.length
  const slotCount = Math.min(maxTeams, Math.max(2, assigned))
  if (assigned < 2) return { ok: false, error: "Assign at least 2 teams before adjusting fixtures." }

  // Rebuild only this division's scheduled fixtures.
  await db.delete(fixtures).where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.status, "scheduled")))

  const firstNight = nextThursday(season.startDate ? new Date(season.startDate) : new Date())
  const slots = Array.from({ length: slotCount }, (_, i) => i + 1)
  const rr = generateRoundRobin(slots)
  const timeslots = balanceTimeslots(rr.map((g) => ({ homeSlot: g.homeTeamId, awaySlot: g.awayTeamId })))
  if (rr.length > 0) {
    await db.insert(fixtures).values(
      rr.map((g, i) => ({
        seasonId: division.seasonId,
        divisionId,
        week: g.week,
        homeSlot: g.homeTeamId,
        awaySlot: g.awayTeamId,
        matchDate: new Date(firstNight.getTime() + (g.week - 1) * 7 * MS_PER_DAY),
        timeslot: timeslots[i],
        status: "scheduled" as const,
      })),
    )
  }

  // Re-link placed teams + venues into the rebuilt template.
  await syncDivisionFixtures(divisionId)

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  revalidatePath("/dashboard/fixtures")
  revalidatePath("/fixtures")
  return { ok: true, teams: assigned, rounds: slotCount - 1, fixtures: rr.length }
}

// ---- Playoffs -------------------------------------------------------------

export async function generatePlayoffs(formData: FormData) {
  await requireAdmin()
  const divisionId = Number(formData.get("divisionId"))
  const [division] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
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
 *  - Regional final semis: seed N -> the team ranked N in that division.
 *  - Tshwane Masters semis: region -> that region's champion (rank 1 of its
 *    Premier/level-1 division).
 *  - Finals: filled from the winners of their source-bracket semis once those
 *    are completed.
 * Re-runnable: it overwrites slots so brackets stay in sync as results land.
 */
export async function pullPlayoffTeams(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }

  const rows = await db.select().from(playoffs).where(eq(playoffs.seasonId, seasonId))
  if (rows.length === 0) return { ok: false, error: "No playoff fixtures to populate. Generate the season first." }

  // Standings by division, ranked.
  const seasonDivisions = await db.select().from(divisions).where(eq(divisions.seasonId, seasonId))
  const divIds = seasonDivisions.map((d) => d.id)
  const allStandings = divIds.length
    ? await db.select().from(standings).where(inArray(standings.divisionId, divIds)).orderBy(asc(standings.rank))
    : []
  const rankInDivision = (divisionId: number, rank: number) =>
    allStandings.find((s) => s.divisionId === divisionId && s.rank === rank)?.teamId ?? null

  // Region champion = rank 1 of that region's Premier (lowest level) division.
  const premierByRegion = new Map<number, number>() // regionId -> divisionId
  for (const d of seasonDivisions) {
    if (d.regionId == null) continue
    const cur = premierByRegion.get(d.regionId)
    const curLevel = cur ? (seasonDivisions.find((x) => x.id === cur)?.level ?? 99) : 99
    if (d.level < curLevel) premierByRegion.set(d.regionId, d.id)
  }
  const regionChampion = (regionId: number) => {
    const divId = premierByRegion.get(regionId)
    return divId ? rankInDivision(divId, 1) : null
  }

  let filled = 0
  // First pass: semis (seeds / regions resolve directly).
  for (const p of rows) {
    if (p.round !== "semi_final") continue
    let home = p.homeTeamId
    let away = p.awayTeamId
    if (p.type === "regional_final" && p.divisionId != null) {
      if (p.homeSeed != null) home = rankInDivision(p.divisionId, p.homeSeed)
      if (p.awaySeed != null) away = rankInDivision(p.divisionId, p.awaySeed)
    } else if (p.type === "tshwane_masters") {
      if (p.homeRegionId != null) home = regionChampion(p.homeRegionId)
      if (p.awayRegionId != null) away = regionChampion(p.awayRegionId)
    }
    if (home !== p.homeTeamId || away !== p.awayTeamId) {
      await db.update(playoffs).set({ homeTeamId: home, awayTeamId: away }).where(eq(playoffs.id, p.id))
      filled++
    }
  }

  // Refresh after the semi update so finals can read semi winners.
  const refreshed = await db.select().from(playoffs).where(eq(playoffs.seasonId, seasonId))
  const winnerByBracket = (type: string, divisionId: number | null, bracket: number) => {
    const semi = refreshed.find(
      (x) =>
        x.type === type &&
        x.round === "semi_final" &&
        x.bracketPosition === bracket &&
        (divisionId == null || x.divisionId === divisionId),
    )
    return semi?.winnerTeamId ?? null
  }

  // Second pass: finals fed by completed semis.
  for (const p of rows) {
    if (p.round !== "final") continue
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

  const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1)
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
  const weeks = Number(formData.get("weeks") ?? 7)
  const startStr = String(formData.get("startDate") ?? "").trim()
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
  const endDate = startDate ? new Date(startDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000) : null

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
      weeks,
      startDate,
      endDate,
      status: "setup",
      isCurrent: makeCurrent,
      playerFee,
      regionalFinalsVenueClubId: num("regionalFinalsVenueClubId"),
      regionalFinalsDate: date("regionalFinalsDate"),
      mastersVenueClubId: num("mastersVenueClubId"),
      mastersDate: date("mastersDate"),
    })
    .returning({ id: seasons.id })

  // Seed the standard grid: every region x every division level, at the chosen
  // max-teams. This gives the Placement Board all 4 regions x 4 divisions to
  // drag teams into immediately. Empty ones are removed when fixtures generate.
  const allRegions = await db.select({ id: regions.id }).from(regions)
  const divisionRows = allRegions.flatMap((r) =>
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

// ---- Season lifecycle: Draft -> Validated -> Published --------------------

/** Run validation and return the full report (does not change status). */
export async function checkSeason(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const report = await validateSeason(seasonId)
  return { ok: true, report }
}

/**
 * Validate the draft and, when clean, mark it "validated". Returns the report
 * either way so the UI can surface errors/warnings.
 */
export async function validateSeasonAction(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const report = await validateSeason(seasonId)
  if (report.ok) {
    await db.update(seasons).set({ status: "validated" }).where(eq(seasons.id, seasonId))
  }
  revalidatePath("/admin")
  return { ok: report.ok, report, error: report.ok ? undefined : "Fix all errors before validating." }
}

/**
 * Start a validated season (status -> "active"). Makes fixtures live to players
 * and LOCKS editing of team names, home venues and club court-slot settings.
 * Gated on:
 *  - a clean validation (no errors), re-run defensively, and
 *  - every assigned team having a captain.
 */
export async function publishSeasonAction(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  const report = await validateSeason(seasonId)
  if (!report.ok) {
    return { ok: false, report, error: "Season still has validation errors." }
  }

  // Every assigned team must have a captain before the season can start.
  const missing = await assignedTeamsMissingCaptain(seasonId)
  if (missing.length > 0) {
    const names = missing.slice(0, 5).join(", ")
    const more = missing.length > 5 ? ` and ${missing.length - 5} more` : ""
    return {
      ok: false,
      report,
      error: `Assign a captain to every team first. Missing: ${names}${more}.`,
    }
  }

  await db.update(seasons).set({ status: "active" }).where(eq(seasons.id, seasonId))
  revalidatePath("/admin")
  revalidatePath("/admin/clubs")
  revalidatePath("/fixtures")
  revalidatePath("/dashboard/fixtures")
  return { ok: true, report }
}

/** Teams assigned to a division in this season that have no captain yet. */
async function assignedTeamsMissingCaptain(seasonId: number): Promise<string[]> {
  const rows = await db
    .select({ name: teams.name, captainUserId: teams.captainUserId })
    .from(teamEntries)
    .innerJoin(teams, eq(teams.id, teamEntries.teamId))
    .where(and(eq(teamEntries.seasonId, seasonId), eq(teamEntries.status, "assigned")))
  return rows.filter((r) => !r.captainUserId).map((r) => r.name)
}

/**
 * Unlock an active season back to "validated" so admins can edit team names,
 * home venues and club slot allocation again. Fixtures are preserved.
 */
export async function unlockSeasonAction(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  await db.update(seasons).set({ status: "validated" }).where(eq(seasons.id, seasonId))
  revalidatePath("/admin")
  revalidatePath("/admin/clubs")
  return { ok: true }
}

/** Move a season back to draft for further editing. */
export async function revertSeasonToDraftAction(formData: FormData) {
  await requireAdmin()
  const seasonId = Number(formData.get("seasonId"))
  if (!seasonId) return { ok: false, error: "Season id required" }
  await db.update(seasons).set({ status: "draft" }).where(eq(seasons.id, seasonId))
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
  await db.update(teams).set({ divisionId: null, seasonId: null }).where(eq(teams.seasonId, seasonId))

  await db.delete(seasons).where(eq(seasons.id, seasonId))

  revalidatePath("/admin")
  revalidatePath("/admin/fixtures")
  return { ok: true }
}

export async function createDivision(formData: FormData) {
  await requireAdmin()
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
  const { seasonId } = input
  const existing = await db.select().from(divisions).where(eq(divisions.seasonId, seasonId))
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
  const divisionId = Number(formData.get("divisionId"))
  const regionId = formData.get("regionId") ? Number(formData.get("regionId")) : null
  await db.update(divisions).set({ regionId }).where(eq(divisions.id, divisionId))
  revalidatePath("/admin")
  return { ok: true }
}

// Assign a team to a division (and inherit the division's season + region).
export async function assignTeamToDivision(formData: FormData) {
  await requireAdmin()
  const teamId = Number(formData.get("teamId"))
  const divisionId = formData.get("divisionId") ? Number(formData.get("divisionId")) : null

  if (divisionId === null) {
    await db.update(teams).set({ divisionId: null }).where(eq(teams.id, teamId))
    revalidatePath("/admin")
    return { ok: true }
  }

  const [division] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
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

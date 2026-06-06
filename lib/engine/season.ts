/**
 * Season generation engine.
 *
 * Turns the Placement Board output (teams placed into divisions) into a full
 * set of round-robin fixtures across every division of a season, scheduling a
 * weekly match night (Thursday) and assigning a host venue per fixture while
 * respecting each club's hosting capacity and Thursday-hosting flag.
 *
 * Pure / deterministic: no DB access here so it can be unit-reasoned and tested.
 */

import { generateRoundRobin } from "@/lib/engine/playoffs"
import { FIXTURE_TIMESLOTS, type FixtureTimeslot } from "@/lib/constants"

export type PlannerTeam = {
  id: number
  homeClubId: number | null
}

export type PlannerClub = {
  id: number
  name: string
  hostsThursday: boolean
  hostingCapacity: number
}

export type PlannerDivision = {
  id: number
  teamIds: number[] // ordered by placement slot
}

export type PlannedFixture = {
  divisionId: number
  week: number
  homeTeamId: number
  awayTeamId: number
  matchDate: Date
  venueClubId: number | null
  venue: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Assign a league timeslot ("17:00" / "18:30") to each fixture so that every
 * division slot ends up with a fair mix of early and late games across the
 * season. Works on slot-based templates (before teams are placed) so the
 * balance survives whoever later fills each slot.
 *
 * Greedy: for each fixture, pick the slot that keeps the two participating
 * division slots closest to an even early/late split. Ties are broken randomly
 * so repeated generations don't always bias the same way.
 */
export function balanceTimeslots(
  fixtures: { homeSlot: number; awaySlot: number }[],
): FixtureTimeslot[] {
  const [EARLY, LATE] = FIXTURE_TIMESLOTS
  const tally = new Map<number, { early: number; late: number }>()
  const at = (slot: number) => {
    let t = tally.get(slot)
    if (!t) {
      t = { early: 0, late: 0 }
      tally.set(slot, t)
    }
    return t
  }

  return fixtures.map((f) => {
    const h = at(f.homeSlot)
    const a = at(f.awaySlot)
    // Imbalance (sum of |early-late| over both slots) for each candidate choice.
    const earlyImb = Math.abs(h.early + 1 - h.late) + Math.abs(a.early + 1 - a.late)
    const lateImb = Math.abs(h.early - (h.late + 1)) + Math.abs(a.early - (a.late + 1))
    let choice: FixtureTimeslot
    if (earlyImb < lateImb) choice = EARLY
    else if (lateImb < earlyImb) choice = LATE
    else choice = Math.random() < 0.5 ? EARLY : LATE
    if (choice === EARLY) {
      h.early++
      a.early++
    } else {
      h.late++
      a.late++
    }
    return choice
  })
}

/** Roll a date forward to the next Thursday (incl. the same day if already Thu). */
export function nextThursday(from: Date): Date {
  const d = new Date(from)
  d.setHours(19, 0, 0, 0) // league nights start 19:00
  const day = d.getDay() // 0 Sun ... 4 Thu
  const delta = (4 - day + 7) % 7
  d.setDate(d.getDate() + delta)
  return d
}

/**
 * Build the complete fixture plan for a season.
 *
 * Venue logic per week:
 *  - prefer the home team's own club (if that club hosts on Thursday & has spare capacity that week)
 *  - otherwise prefer the away team's club under the same rules
 *  - otherwise the least-loaded Thursday-hosting club with spare capacity
 *  - otherwise leave the venue unassigned (admin resolves manually)
 */
export function planSeason(args: {
  startDate: Date
  divisions: PlannerDivision[]
  teams: PlannerTeam[]
  clubs: PlannerClub[]
}): PlannedFixture[] {
  const { startDate, divisions, teams, clubs } = args
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const clubById = new Map(clubs.map((c) => [c.id, c]))
  const firstNight = nextThursday(startDate)

  // Clubs eligible to host (Thursday + positive capacity), ordered by capacity desc.
  const hostClubs = clubs
    .filter((c) => c.hostsThursday && c.hostingCapacity > 0)
    .sort((a, b) => b.hostingCapacity - a.hostingCapacity)

  // week -> clubId -> count of fixtures already hosted that week
  const usage = new Map<number, Map<number, number>>()
  const usedThisWeek = (week: number, clubId: number) => usage.get(week)?.get(clubId) ?? 0
  const capacityOf = (clubId: number) => clubById.get(clubId)?.hostingCapacity ?? 0
  const hostsThu = (clubId: number) => !!clubById.get(clubId)?.hostsThursday
  const bump = (week: number, clubId: number) => {
    let wk = usage.get(week)
    if (!wk) {
      wk = new Map()
      usage.set(week, wk)
    }
    wk.set(clubId, (wk.get(clubId) ?? 0) + 1)
  }

  function pickVenue(week: number, homeTeamId: number, awayTeamId: number): number | null {
    const homeClub = teamById.get(homeTeamId)?.homeClubId ?? null
    const awayClub = teamById.get(awayTeamId)?.homeClubId ?? null

    const candidatePreferred = [homeClub, awayClub].filter(
      (c): c is number => c != null && hostsThu(c) && usedThisWeek(week, c) < capacityOf(c),
    )
    if (candidatePreferred.length > 0) return candidatePreferred[0]

    // Fall back to the least-loaded eligible host club with spare capacity.
    let best: number | null = null
    let bestSpare = 0
    for (const c of hostClubs) {
      const spare = c.hostingCapacity - usedThisWeek(week, c.id)
      if (spare > bestSpare) {
        bestSpare = spare
        best = c.id
      }
    }
    return best
  }

  const planned: PlannedFixture[] = []

  for (const div of divisions) {
    if (div.teamIds.length < 2) continue
    const rr = generateRoundRobin(div.teamIds)
    for (const g of rr) {
      const matchDate = new Date(firstNight.getTime() + (g.week - 1) * 7 * MS_PER_DAY)
      const venueClubId = pickVenue(g.week, g.homeTeamId, g.awayTeamId)
      if (venueClubId != null) bump(g.week, venueClubId)
      planned.push({
        divisionId: div.id,
        week: g.week,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        matchDate,
        venueClubId,
        venue: venueClubId != null ? (clubById.get(venueClubId)?.name ?? null) : null,
      })
    }
  }

  return planned
}

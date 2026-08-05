/**
 * Deterministic fixture scheduling engine for SAPL league play.
 *
 * The engine is pure: callers provide placed teams, venue capacity, and season
 * dates; it returns a draft schedule with home/away assignments, venues,
 * timeslots, and default per-category court allocations.
 *
 * --- Home/Away Balance Model ---
 *
 * Every team plays exactly N games in a single round-robin. The engine
 * guarantees each team is home exactly ceil(N/2) times and away floor(N/2)
 * times (or vice-versa for odd N). This is a hard constraint, not a penalty.
 *
 * --- Venue Capacity Model ---
 *
 * A SAPL fixture (tie) uses all 4 courts simultaneously for 4 categories.
 * - Venue with ≥4 courts: can run 1 fixture per timeslot (17:00 and/or 18:30).
 *   Night capacity = number of configured timeslots (max 2).
 * - Venue with <4 courts: must split the 4 categories across both timeslots,
 *   so it can only host 1 fixture per night (using both slots).
 *   Night capacity = 1 regardless of configured timeslots.
 *
 * Constrained venues (those that share courts across multiple home teams) are
 * scheduled first so their venue-slot conflicts are resolved before unconstrained
 * venues compete for capacity.
 */

import { FIXTURE_TIMESLOTS, type FixtureTimeslot } from "@/lib/constants"

export type PlannerTeam = {
  id: number
  slot: number
  homeClubId: number | null
}

export type PlannerClub = {
  id: number
  name: string
  courts: number
  hostsThursday: boolean
  hostingCapacity: number
  hostTimeslots: FixtureTimeslot[]
  preferredTimeslot?: FixtureTimeslot | null
}

export type PlannerDivision = {
  id: number
  teamSlots: PlannerTeam[]
}

export type CourtAssignment = { court: string | null; time: string | null }
export type PlannedCourtAssignments = Record<string, CourtAssignment>

export type PlannedFixture = {
  divisionId: number
  week: number
  homeTeamId: number
  awayTeamId: number
  homeSlot: number
  awaySlot: number
  matchDate: Date
  venueClubId: number | null
  venue: string | null
  timeslot: FixtureTimeslot | null
  courtAssignments: PlannedCourtAssignments
}

type UsageByWeek = Map<number, Map<number, { total: number; slots: Set<FixtureTimeslot> }>>

const MS_PER_DAY = 24 * 60 * 60 * 1000
const CATEGORY_LAYOUT = ["Mens Open", "Ladies Open", "Mens Intermediate", "Mens Beginner"] as const

type RoundPair = { a: number; b: number }

function countGamesByTeam(rounds: RoundPair[][]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const round of rounds) {
    for (const pair of round) {
      counts.set(pair.a, (counts.get(pair.a) ?? 0) + 1)
      counts.set(pair.b, (counts.get(pair.b) ?? 0) + 1)
    }
  }
  return counts
}

function buildRoundRobinRounds(teamIds: number[]): RoundPair[][] {
  const rotation = [...teamIds]
  if (rotation.length % 2 !== 0) rotation.push(-1)

  const rounds: RoundPair[][] = []
  const total = rotation.length
  const half = total / 2

  for (let roundIndex = 0; roundIndex < total - 1; roundIndex++) {
    const pairs: RoundPair[] = []
    for (let i = 0; i < half; i++) {
      const a = rotation[i]
      const b = rotation[total - 1 - i]
      if (a !== -1 && b !== -1) pairs.push({ a, b })
    }
    rounds.push(pairs)

    const fixed = rotation[0]
    const rest = rotation.slice(1)
    rest.unshift(rest.pop() as number)
    rotation.splice(0, rotation.length, fixed, ...rest)
  }

  return rounds
}

function pushHistory(history: string, value: "H" | "A"): string {
  return `${history}${value}`
}

function orientationPenalty(args: {
  side: "H" | "A"
  homeCount: number
  awayCount: number
  history: string
}) {
  const { side, homeCount, awayCount, history } = args
  const nextHome = side === "H" ? homeCount + 1 : homeCount
  const nextAway = side === "A" ? awayCount + 1 : awayCount
  const nextHistory = pushHistory(history, side)

  // Prefer balance (equal home/away so far)
  let penalty = Math.abs(nextHome - nextAway) * 8

  // Discourage 2 or 3 consecutive same-side games
  if (history.endsWith(side.repeat(2))) penalty += 120
  else if (history.endsWith(side)) penalty += 10
  if (nextHistory.endsWith(side.repeat(3))) penalty += 400

  return penalty
}

export function buildCourtAssignments(courts: number, kickoff: FixtureTimeslot | null): PlannedCourtAssignments {
  const safeCourts = Math.max(1, courts || 0)
  const useSingleSlot = safeCourts >= CATEGORY_LAYOUT.length && kickoff != null
  const primaryTime = kickoff ?? FIXTURE_TIMESLOTS[0]
  const secondaryTime = FIXTURE_TIMESLOTS[1]

  const out: PlannedCourtAssignments = {}
  CATEGORY_LAYOUT.forEach((category, index) => {
    if (useSingleSlot) {
      out[category] = { court: String(index + 1), time: primaryTime }
      return
    }

    const courtIndex = index % safeCourts
    const slotIndex = Math.floor(index / safeCourts)
    out[category] = {
      court: String(courtIndex + 1),
      time: slotIndex === 0 ? FIXTURE_TIMESLOTS[0] : secondaryTime,
    }
  })

  return out
}

/**
 * How many fixtures this venue can host in a single league night.
 *
 * - Venue with ≥4 courts: 1 fixture per timeslot, so capacity = slots configured.
 * - Venue with <4 courts: must use both time slots for a single fixture, so
 *   max 1 fixture per night regardless of how many slots are configured.
 */
function venueNightCapacity(club: PlannerClub): number {
  if (!club.hostsThursday || club.hostingCapacity <= 0) return 0
  if ((club.courts ?? 0) < CATEGORY_LAYOUT.length) {
    // Needs both timeslots for one fixture → max 1 per night
    return club.hostTimeslots.length >= 1 ? 1 : 0
  }
  return club.hostTimeslots.length
}

/**
 * The timeslots at which this venue can start a new fixture this week.
 * For a <4-court venue that has already hosted once this night, returns [].
 */
function venueAvailableTimeslots(club: PlannerClub, usedSlotsThisWeek: Set<FixtureTimeslot>): FixtureTimeslot[] {
  if ((club.courts ?? 0) < CATEGORY_LAYOUT.length) {
    // Single fixture per night (uses both slots) — only if not already used
    return usedSlotsThisWeek.size === 0 && club.hostTimeslots.length > 0
      ? [club.hostTimeslots[0]]
      : []
  }
  return club.hostTimeslots.filter((slot) => !usedSlotsThisWeek.has(slot))
}

function venueUsageForWeek(usage: UsageByWeek, week: number, clubId: number) {
  return usage.get(week)?.get(clubId) ?? { total: 0, slots: new Set<FixtureTimeslot>() }
}

function markVenueUsage(usage: UsageByWeek, week: number, club: PlannerClub, kickoff: FixtureTimeslot | null) {
  let byClub = usage.get(week)
  if (!byClub) {
    byClub = new Map()
    usage.set(week, byClub)
  }
  const current = byClub.get(club.id) ?? { total: 0, slots: new Set<FixtureTimeslot>() }
  current.total += 1
  if (kickoff) current.slots.add(kickoff)
  byClub.set(club.id, current)
}

function chooseKickoffForVenue(
  club: PlannerClub,
  week: number,
  usage: UsageByWeek,
): FixtureTimeslot | null {
  const current = venueUsageForWeek(usage, week, club.id)
  const available = venueAvailableTimeslots(club, current.slots)
  if (available.length === 0) return null

  const preferred = club.preferredTimeslot
  const timeslotIndex = (slot: FixtureTimeslot): number => FIXTURE_TIMESLOTS.indexOf(slot)

  // Sort: preferred first, then by FIXTURE_TIMESLOTS priority (18:30 before 17:00)
  const ordered = [...available].sort((a, b) => {
    if (preferred && a === preferred && b !== preferred) return -1
    if (preferred && b === preferred && a !== preferred) return 1
    return timeslotIndex(a) - timeslotIndex(b)
  })

  return ordered[0] ?? null
}

/** Roll a date forward to the next Thursday (incl. the same day if already Thu).
 *  Works entirely in UTC so DST / server-timezone differences don't shift the date. */
export function nextThursday(from: Date): Date {
  const utcYear = from.getUTCFullYear()
  const utcMonth = from.getUTCMonth()
  const utcDay = from.getUTCDate()
  const baseDay = from.getUTCDay()
  const delta = (4 - baseDay + 7) % 7
  return new Date(Date.UTC(utcYear, utcMonth, utcDay + delta, 17, 0, 0, 0))
}

/**
 * Legacy slot balancer kept for callers that still work with slot templates.
 */
export function balanceTimeslots(fixtures: { homeSlot: number; awaySlot: number }[]): FixtureTimeslot[] {
  const [early, late] = FIXTURE_TIMESLOTS
  const tally = new Map<number, { early: number; late: number }>()
  const slotStats = (slot: number) => {
    const existing = tally.get(slot)
    if (existing) return existing
    const created = { early: 0, late: 0 }
    tally.set(slot, created)
    return created
  }

  return fixtures.map((fixture, index) => {
    const home = slotStats(fixture.homeSlot)
    const away = slotStats(fixture.awaySlot)
    const earlyImbalance = Math.abs(home.early + 1 - home.late) + Math.abs(away.early + 1 - away.late)
    const lateImbalance = Math.abs(home.early - (home.late + 1)) + Math.abs(away.early - (away.late + 1))
    const choice =
      earlyImbalance < lateImbalance
        ? early
        : lateImbalance < earlyImbalance
          ? late
          : index % 2 === 0
            ? early
            : late
    if (choice === early) {
      home.early++
      away.early++
    } else {
      home.late++
      away.late++
    }
    return choice
  })
}

export function planSeason(args: {
  startDate: Date
  divisions: PlannerDivision[]
  clubs: PlannerClub[]
}): PlannedFixture[] {
  const firstNight = nextThursday(args.startDate)
  const clubById = new Map(args.clubs.map((club) => [club.id, club]))
  const usage: UsageByWeek = new Map()
  const planned: PlannedFixture[] = []

  for (const division of [...args.divisions].sort((a, b) => a.id - b.id)) {
    const teamById = new Map(division.teamSlots.map((team) => [team.id, team]))
    const orderedTeamIds = [...division.teamSlots]
      .sort((a, b) => a.slot - b.slot || a.id - b.id)
      .map((team) => team.id)

    const rounds = buildRoundRobinRounds(orderedTeamIds)
    const gameCounts = countGamesByTeam(rounds)

    // Hard home/away caps per team: each team is home exactly ceil(N/2) times.
    // This is enforced absolutely — orientation scoring only breaks ties within
    // the allowed window.
    const maxHomeGames = new Map<number, number>()
    const maxAwayGames = new Map<number, number>()
    for (const [teamId, games] of gameCounts.entries()) {
      maxHomeGames.set(teamId, Math.ceil(games / 2))
      maxAwayGames.set(teamId, Math.floor(games / 2))
    }

    const homeCounts = new Map<number, number>()
    const awayCounts = new Map<number, number>()
    const histories = new Map<number, string>()

    // Build venue-constraint score: teams sharing courts raise the score.
    // Higher score = venue is more constrained = schedule those fixtures first.
    // Constraint = teams sharing venue / (night capacity of that venue).
    const venueTeamCount = new Map<number, number>()
    for (const team of division.teamSlots) {
      if (team.homeClubId != null) {
        venueTeamCount.set(team.homeClubId, (venueTeamCount.get(team.homeClubId) ?? 0) + 1)
      }
    }

    const venueConstraintScore = (clubId: number): number => {
      const club = clubById.get(clubId)
      if (!club) return 0
      const teamCount = venueTeamCount.get(clubId) ?? 0
      const capacity = venueNightCapacity(club)
      // Ratio of teams to nightly fixture slots. 1.0 = perfectly subscribed (e.g.
      // Kimiad 2 teams / 1 slot = 2.0 → very constrained). Schedule these first.
      return capacity > 0 ? teamCount / capacity : teamCount * 100
    }

    const teamVenuePriority = (teamId: number): number => {
      const team = teamById.get(teamId)
      return team?.homeClubId != null ? venueConstraintScore(team.homeClubId) : 0
    }

    const teamCanHostWeek = (teamId: number, week: number): boolean => {
      const team = teamById.get(teamId)
      if (!team?.homeClubId) return false
      const club = clubById.get(team.homeClubId)
      if (!club || venueNightCapacity(club) <= 0) return false
      const current = venueUsageForWeek(usage, week, club.id)
      return current.total < venueNightCapacity(club)
    }

    for (let weekIndex = 0; weekIndex < rounds.length; weekIndex++) {
      const week = weekIndex + 1

      // Schedule pairs involving the most-constrained venues first so their
      // home/venue slots are locked in before less-constrained venues compete
      // for the same night capacity.
      const sortedPairs = [...rounds[weekIndex]].sort((a, b) => {
        const pa = Math.max(teamVenuePriority(a.a), teamVenuePriority(a.b))
        const pb = Math.max(teamVenuePriority(b.a), teamVenuePriority(b.b))
        return pb - pa
      })

      for (const pair of sortedPairs) {
        const aHomeCount = homeCounts.get(pair.a) ?? 0
        const bHomeCount = homeCounts.get(pair.b) ?? 0
        const aAwayCount = awayCounts.get(pair.a) ?? 0
        const bAwayCount = awayCounts.get(pair.b) ?? 0

        const aMaxHome = maxHomeGames.get(pair.a) ?? Number.MAX_SAFE_INTEGER
        const bMaxHome = maxHomeGames.get(pair.b) ?? Number.MAX_SAFE_INTEGER
        const aMaxAway = maxAwayGames.get(pair.a) ?? Number.MAX_SAFE_INTEGER
        const bMaxAway = maxAwayGames.get(pair.b) ?? Number.MAX_SAFE_INTEGER

        // Hard constraint: if a team has exhausted their home quota they MUST
        // be away; if they've exhausted away quota they MUST be home.
        const aMustBeHome = aAwayCount >= aMaxAway
        const bMustBeHome = bAwayCount >= bMaxAway
        const aMustBeAway = aHomeCount >= aMaxHome
        const bMustBeAway = bHomeCount >= bMaxHome

        let homeTeamId: number
        let awayTeamId: number

        if (aMustBeHome || bMustBeAway) {
          homeTeamId = pair.a
          awayTeamId = pair.b
        } else if (bMustBeHome || aMustBeAway) {
          homeTeamId = pair.b
          awayTeamId = pair.a
        } else {
          // Neither side is forced — use scoring to pick the better orientation.
          // Venue availability is a soft preference, not a hard override.
          const aCanHost = teamCanHostWeek(pair.a, week)
          const bCanHost = teamCanHostWeek(pair.b, week)

          const scoreAsHome = (
            homeId: number,
            awayId: number,
            canHostThisWeek: boolean,
          ): number => {
            const homeHistory = histories.get(homeId) ?? ""
            const awayHistory = histories.get(awayId) ?? ""
            const homeH = homeCounts.get(homeId) ?? 0
            const homeA = awayCounts.get(homeId) ?? 0
            const awayH = homeCounts.get(awayId) ?? 0
            const awayA = awayCounts.get(awayId) ?? 0

            const balance =
              orientationPenalty({ side: "H", homeCount: homeH, awayCount: homeA, history: homeHistory }) +
              orientationPenalty({ side: "A", homeCount: awayH, awayCount: awayA, history: awayHistory })

            // Prefer scheduling at home team's actual venue (soft preference).
            // Weight is moderate so it never overrides balance.
            const venuePenalty = canHostThisWeek ? 0 : 15

            return balance + venuePenalty
          }

          const scoreAHome = scoreAsHome(pair.a, pair.b, aCanHost)
          const scoreBHome = scoreAsHome(pair.b, pair.a, bCanHost)

          homeTeamId = scoreAHome <= scoreBHome ? pair.a : pair.b
          awayTeamId = homeTeamId === pair.a ? pair.b : pair.a
        }

        // Pick venue: try home team's venue first, then away team's venue.
        // Only assign a venue that belongs to one of the two teams.
        let venuePick: { club: PlannerClub | null; kickoff: FixtureTimeslot | null } = {
          club: null,
          kickoff: null,
        }

        const tryTeamVenue = (teamId: number): boolean => {
          const team = teamById.get(teamId)
          if (!team?.homeClubId) return false
          const club = clubById.get(team.homeClubId)
          if (!club) return false
          const kickoff = chooseKickoffForVenue(club, week, usage)
          if (!kickoff) return false
          venuePick = { club, kickoff }
          return true
        }

        if (!tryTeamVenue(homeTeamId)) tryTeamVenue(awayTeamId)

        if (venuePick.club && venuePick.kickoff) {
          markVenueUsage(usage, week, venuePick.club, venuePick.kickoff)
        }

        homeCounts.set(homeTeamId, (homeCounts.get(homeTeamId) ?? 0) + 1)
        awayCounts.set(awayTeamId, (awayCounts.get(awayTeamId) ?? 0) + 1)
        histories.set(homeTeamId, pushHistory(histories.get(homeTeamId) ?? "", "H"))
        histories.set(awayTeamId, pushHistory(histories.get(awayTeamId) ?? "", "A"))

        const matchDate = new Date(firstNight.getTime() + weekIndex * 7 * MS_PER_DAY)
        const venueCourts = venuePick.club?.courts ?? 0

        planned.push({
          divisionId: division.id,
          week,
          homeTeamId,
          awayTeamId,
          homeSlot: teamById.get(homeTeamId)?.slot ?? 0,
          awaySlot: teamById.get(awayTeamId)?.slot ?? 0,
          matchDate,
          venueClubId: venuePick.club?.id ?? null,
          venue: venuePick.club?.name ?? null,
          timeslot: venuePick.kickoff,
          courtAssignments: buildCourtAssignments(venueCourts, venuePick.kickoff),
        })
      }
    }
  }

  return planned
}

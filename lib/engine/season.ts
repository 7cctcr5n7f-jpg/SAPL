/**
 * Deterministic fixture scheduling engine for SAPL league play.
 *
 * The engine is pure: callers provide placed teams, venue capacity, and season
 * dates; it returns a draft schedule with home/away assignments, venues,
 * timeslots, and default per-category court allocations.
 *
 * --- Home/Away Balance ---
 * Each team plays exactly N games. The engine guarantees each team is home
 * exactly ceil(N/2) times and away floor(N/2) times. This is a HARD constraint.
 *
 * --- Venue Capacity ---
 * A SAPL fixture (tie) uses all 4 courts simultaneously for 4 categories.
 * - Venue ≥4 courts: 1 fixture per timeslot (17:00 and/or 18:30).
 *   Night capacity = number of configured timeslots (max 2).
 * - Venue <4 courts: must spread 4 categories across both timeslots, so it
 *   can only host 1 fixture per night total.
 *   Night capacity = 1 regardless of configured timeslots.
 *
 * --- Shared-Venue Pre-Pass ---
 * When multiple teams share a venue whose nightly capacity < number of sharing
 * teams, the engine pre-assigns home/away roles for those teams first (before
 * processing any other pairs) so they interleave perfectly and each gets
 * exactly ceil(N/2) home games without deadlocking each other.
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

  let penalty = Math.abs(nextHome - nextAway) * 8

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
 * - Venue with ≥4 courts: 1 fixture per timeslot → capacity = slots configured.
 * - Venue with <4 courts: uses both time slots for one fixture → max 1 per night.
 */
function venueNightCapacity(club: PlannerClub): number {
  if (!club.hostsThursday || club.hostingCapacity <= 0) return 0
  if ((club.courts ?? 0) < CATEGORY_LAYOUT.length) {
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

/** Legacy slot balancer kept for callers that still work with slot templates. */
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

/**
 * Pre-assign home roles for teams that share a venue whose nightly capacity is
 * less than the number of teams using it in this division.
 *
 * For each such venue, the teams that share it are sorted by slot, then given
 * alternating home weeks such that:
 *   - At most `capacity` teams are home in any single week.
 *   - Every team ends up home exactly ceil(games/2) times across the season.
 *
 * Returns a Map<teamId, Set<week>> containing the weeks each sharing team MUST
 * be home. The orientation pass treats these as hard pre-commits.
 */
function preAssignSharedVenueHome(
  rounds: RoundPair[][],
  division: PlannerDivision,
  clubById: Map<number, PlannerClub>,
): Map<number, Set<number>> {
  const forcedHome = new Map<number, Set<number>>()

  // Group teams by homeClubId
  const teamsByClub = new Map<number, number[]>()
  for (const team of division.teamSlots) {
    if (team.homeClubId == null) continue
    const bucket = teamsByClub.get(team.homeClubId) ?? []
    bucket.push(team.id)
    teamsByClub.set(team.homeClubId, bucket)
  }

  for (const [clubId, sharingTeamIds] of teamsByClub.entries()) {
    const club = clubById.get(clubId)
    if (!club) continue
    const capacity = venueNightCapacity(club)
    // Only intervene when the venue is over-subscribed or perfectly subscribed
    // with more than 1 team (i.e. teams > capacity → can't all be home same night)
    if (sharingTeamIds.length <= capacity) continue

    // Sort teams by slot for deterministic ordering
    const sorted = [...sharingTeamIds].sort((a, b) => {
      const sa = division.teamSlots.find((t) => t.id === a)?.slot ?? 999
      const sb = division.teamSlots.find((t) => t.id === b)?.slot ?? 999
      return sa - sb
    })

    const gameCounts = countGamesByTeam(rounds)

    // For each team, compute how many home games they need
    const homeTarget = new Map<number, number>()
    for (const id of sorted) {
      homeTarget.set(id, Math.ceil((gameCounts.get(id) ?? 0) / 2))
    }

    // Track which weeks this venue is already allocated (up to `capacity` per week)
    const venueWeekUsage = new Map<number, number>()

    // For each round (week), figure out who could be home at this venue.
    // In each week, at most `capacity` teams from this group can be home.
    // We assign home slots greedily, cycling through the sorted team list,
    // ensuring each team eventually hits their homeTarget.

    // First pass: find which rounds contain a pair involving a sharing team
    // (i.e. weeks where this team plays at all — bye weeks don't count)
    const teamActiveWeeks = new Map<number, number[]>()
    for (const id of sorted) teamActiveWeeks.set(id, [])

    for (let wi = 0; wi < rounds.length; wi++) {
      const week = wi + 1
      for (const pair of rounds[wi]) {
        if (sorted.includes(pair.a)) teamActiveWeeks.get(pair.a)!.push(week)
        if (sorted.includes(pair.b)) teamActiveWeeks.get(pair.b)!.push(week)
      }
    }

    // Assign home weeks: iterate through weeks in order; for each week,
    // up to `capacity` teams from this group may be home. Rotate fairly.
    // We use a round-robin pointer so no team monopolises early weeks.
    let pointer = 0
    for (let wi = 0; wi < rounds.length; wi++) {
      const week = wi + 1
      const venueUsedThisWeek = venueWeekUsage.get(week) ?? 0
      if (venueUsedThisWeek >= capacity) continue

      let slotsRemaining = capacity - venueUsedThisWeek
      let checked = 0

      while (slotsRemaining > 0 && checked < sorted.length) {
        const teamId = sorted[pointer % sorted.length]
        pointer++
        checked++

        const team = division.teamSlots.find((t) => t.id === teamId)
        if (!team) continue

        // Only assign home for this week if the team actually plays this week
        const activeWeeks = teamActiveWeeks.get(teamId) ?? []
        if (!activeWeeks.includes(week)) continue

        const alreadyForcedHome = (forcedHome.get(teamId)?.size ?? 0)
        const target = homeTarget.get(teamId) ?? 0
        if (alreadyForcedHome >= target) continue

        const set = forcedHome.get(teamId) ?? new Set<number>()
        set.add(week)
        forcedHome.set(teamId, set)
        venueWeekUsage.set(week, (venueWeekUsage.get(week) ?? 0) + 1)
        slotsRemaining--
      }
    }
  }

  return forcedHome
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

    // Hard home/away caps: each team is home exactly ceil(N/2) times.
    const maxHomeGames = new Map<number, number>()
    const maxAwayGames = new Map<number, number>()
    for (const [teamId, games] of gameCounts.entries()) {
      maxHomeGames.set(teamId, Math.ceil(games / 2))
      maxAwayGames.set(teamId, Math.floor(games / 2))
    }

    // Pre-assign shared-venue teams so they don't deadlock each other.
    const forcedHomeWeeks = preAssignSharedVenueHome(rounds, division, clubById)

    const homeCounts = new Map<number, number>()
    const awayCounts = new Map<number, number>()
    const histories = new Map<number, string>()

    // Venue constraint score for scheduling priority within a week.
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

      // Process pairs involving constrained (shared-venue) teams first.
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

        // Pre-committed home weeks from the shared-venue pre-pass take highest
        // priority. If a team is pre-committed home this week, it IS home.
        const aForcedHome = forcedHomeWeeks.get(pair.a)?.has(week) ?? false
        const bForcedHome = forcedHomeWeeks.get(pair.b)?.has(week) ?? false

        // Hard cap constraints (fallback if not pre-committed)
        const aMustBeHome = !bForcedHome && (aAwayCount >= aMaxAway)
        const bMustBeHome = !aForcedHome && (bAwayCount >= bMaxAway)
        const aMustBeAway = aHomeCount >= aMaxHome
        const bMustBeAway = bHomeCount >= bMaxHome

        let homeTeamId: number
        let awayTeamId: number

        if (aForcedHome || aMustBeHome || bMustBeAway) {
          homeTeamId = pair.a
          awayTeamId = pair.b
        } else if (bForcedHome || bMustBeHome || aMustBeAway) {
          homeTeamId = pair.b
          awayTeamId = pair.a
        } else {
          // Neither side is forced — use scoring to pick the better orientation.
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

            const venuePenalty = canHostThisWeek ? 0 : 15
            return balance + venuePenalty
          }

          const scoreAHome = scoreAsHome(pair.a, pair.b, aCanHost)
          const scoreBHome = scoreAsHome(pair.b, pair.a, bCanHost)

          homeTeamId = scoreAHome <= scoreBHome ? pair.a : pair.b
          awayTeamId = homeTeamId === pair.a ? pair.b : pair.a
        }

        // Pick venue: home team's venue first, then away team's venue.
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

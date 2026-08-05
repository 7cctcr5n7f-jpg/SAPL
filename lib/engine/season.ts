/**
 * Deterministic fixture scheduling engine for SAPL league play.
 *
 * The engine is pure: callers provide placed teams, venue capacity, and season
 * dates; it returns a draft schedule with home/away assignments, venues,
 * timeslots, and default per-category court allocations.
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

function pushHistory(history: string, value: "H" | "A"): string {
  return `${history}${value}`
}

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

function orientationPenalty(args: {
  teamId: number
  side: "H" | "A"
  homeCount: number
  awayCount: number
  history: string
  maxPerSide: number
}) {
  const { side, homeCount, awayCount, history, maxPerSide } = args
  const nextHome = side === "H" ? homeCount + 1 : homeCount
  const nextAway = side === "A" ? awayCount + 1 : awayCount
  const nextHistory = pushHistory(history, side)

  let penalty = Math.abs(nextHome - nextAway) * 8
  if ((side === "H" ? nextHome : nextAway) > maxPerSide) penalty += 200
  if (history.endsWith(side.repeat(2))) penalty += 120
  else if (history.endsWith(side)) penalty += 10
  if (nextHistory.endsWith(side.repeat(3))) penalty += 400

  return penalty
}

// orientRoundRobin is no longer used as a separate step; orientation is now
// integrated into planSeason together with venue-awareness so the two cannot
// work against each other.

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

function venueNightCapacity(club: PlannerClub): number {
  if (!club.hostsThursday || club.hostingCapacity <= 0) return 0
  if ((club.courts ?? 0) < CATEGORY_LAYOUT.length) return club.hostTimeslots.length >= 2 ? 1 : 0
  return club.hostTimeslots.length
}

function venueAvailableTimeslots(club: PlannerClub): FixtureTimeslot[] {
  if ((club.courts ?? 0) < CATEGORY_LAYOUT.length) {
    // Venue with < 4 courts can host only 1 fixture per night.
    // Return the first available timeslot from the club's configured slots.
    return club.hostTimeslots.length > 0 ? [club.hostTimeslots[0]] : []
  }
  return club.hostTimeslots
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
  const available = venueAvailableTimeslots(club)
  if (available.length === 0) return null

  const current = venueUsageForWeek(usage, week, club.id)
  if ((club.courts ?? 0) < CATEGORY_LAYOUT.length) {
    // Venue with < 4 courts can host only 1 fixture per night.
    // Return the first available timeslot if this is the first fixture this week.
    return current.total === 0 ? available[0] : null
  }

  const preferred = club.preferredTimeslot
  const timeslotIndex = (slot: FixtureTimeslot): number => FIXTURE_TIMESLOTS.indexOf(slot)
  const ordered = [...available].sort((a, b) => {
    if (preferred && a === preferred && b !== preferred) return -1
    if (preferred && b === preferred && a !== preferred) return 1
    const aUsed = current.slots.has(a) ? 1 : 0
    const bUsed = current.slots.has(b) ? 1 : 0
    if (aUsed !== bUsed) return aUsed - bUsed
    // Sort by FIXTURE_TIMESLOTS order (priority)
    return timeslotIndex(a) - timeslotIndex(b)
  })

  for (const slot of ordered) {
    if (!current.slots.has(slot)) return slot
  }
  return null
}

/** Roll a date forward to the next Thursday (incl. the same day if already Thu).
 *  Works entirely in UTC so DST / server-timezone differences don't shift the date. */
export function nextThursday(from: Date): Date {
  // Work with the UTC date components to avoid timezone day-shifts.
  const utcYear = from.getUTCFullYear()
  const utcMonth = from.getUTCMonth()
  const utcDay = from.getUTCDate()
  const baseDay = from.getUTCDay() // 0=Sun … 4=Thu … 6=Sat
  const delta = (4 - baseDay + 7) % 7
  const d = new Date(Date.UTC(utcYear, utcMonth, utcDay + delta, 17, 0, 0, 0))
  return d
}

/**
 * Legacy slot balancer kept for callers that still work with slot templates.
 * Ties are resolved deterministically.
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
    const choice = earlyImbalance < lateImbalance ? early : lateImbalance < earlyImbalance ? late : index % 2 === 0 ? early : late
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
    const maxPerSide = new Map<number, number>()
    for (const [teamId, games] of gameCounts.entries()) {
      maxPerSide.set(teamId, Math.ceil(games / 2))
    }

    const homeCounts = new Map<number, number>()
    const awayCounts = new Map<number, number>()
    const histories = new Map<number, string>()

    const teamCanHostWeek = (teamId: number, week: number): boolean => {
      const team = teamById.get(teamId)
      if (!team?.homeClubId) return false
      const club = clubById.get(team.homeClubId)
      if (!club || venueNightCapacity(club) <= 0) return false
      const current = venueUsageForWeek(usage, week, club.id)
      return current.total < venueNightCapacity(club)
    }

    // Prioritize venues by capacity utilization. Defined here (before minimumHomeGames)
    // so teamVenuePriority is available when computing minimum home game allocations.
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
      const courts = club.courts ?? 0
      const utilization = courts > 0 ? teamCount / courts : teamCount * 100
      return utilization
    }

    const teamVenuePriority = (teamId: number): number => {
      const team = teamById.get(teamId)
      return team?.homeClubId != null ? venueConstraintScore(team.homeClubId) : 0
    }

    // Compute minimum home games required per team based on venue constraint.
    // Teams at bottleneck venues (100% utilization) MUST get at least 2 home games.
    // This is computed BEFORE orientation to ensure fairness for constrained venues.
    const minimumHomeGames = new Map<number, number>()
    const totalFixturesPerTeam = gameCounts.get(division.teamSlots[0]?.id) ?? 6
    
    for (const team of division.teamSlots) {
      const constraint = teamVenuePriority(team.id)
      let minimum = Math.floor(totalFixturesPerTeam / 2) // Default: 3 home for 6 games
      
      // Bottleneck venues (constraint >= 1.0): guarantee at least 2 home
      // This ensures Padel Parq Kimiad A/B get home games despite capacity limits
      if (constraint >= 1.0) {
        minimum = Math.max(2, minimum)
      }
      
      minimumHomeGames.set(team.id, minimum)
    }
    
    // Pre-allocate home games for constrained teams to satisfy minimum requirements.
    // This builds a set of (pair, orientation) that MUST be home for that team.
    const preAllocatedHome = new Map<number, Set<number>>() // teamId -> set of opponent teamIds where this team must be HOME
    
    for (const team of division.teamSlots) {
      const minimumForThisTeam = minimumHomeGames.get(team.id) ?? 0
      if (minimumForThisTeam <= 0) continue
      
      // Find all pairs involving this team
      const pairsForThisTeam: Array<{ opponent: number; round: number }> = []
      for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
        for (const pair of rounds[roundIdx]) {
          if (pair.a === team.id) pairsForThisTeam.push({ opponent: pair.b, round: roundIdx })
          if (pair.b === team.id) pairsForThisTeam.push({ opponent: pair.a, round: roundIdx })
        }
      }
      
      // Pre-allocate the first N matches as HOME (N = minimum home games)
      const allocated = new Set<number>()
      for (let i = 0; i < Math.min(minimumForThisTeam, pairsForThisTeam.length); i++) {
        allocated.add(pairsForThisTeam[i].opponent)
      }
      
      if (allocated.size > 0) {
        preAllocatedHome.set(team.id, allocated)
      }
    }

    for (let weekIndex = 0; weekIndex < rounds.length; weekIndex++) {
      const week = weekIndex + 1

      // Sort pairs within this round so those involving teams from high-occupancy
      // venues (most teams sharing that club) are scheduled first. This ensures
      // WRC 4-team pairs lock in their venue slots before lower-priority pairs
      // compete for the same night capacity.
      const sortedPairs = [...rounds[weekIndex]].sort((a, b) => {
        const pa = Math.max(teamVenuePriority(a.a), teamVenuePriority(a.b))
        const pb = Math.max(teamVenuePriority(b.a), teamVenuePriority(b.b))
        return pb - pa
      })

      for (const pair of sortedPairs) {
        const aCanHost = teamCanHostWeek(pair.a, week)
        const bCanHost = teamCanHostWeek(pair.b, week)

        // Check if this pair has a pre-allocated home assignment (hard constraint for bottleneck venues)
        const aPreAllocated = preAllocatedHome.get(pair.a)?.has(pair.b) ?? false
        const bPreAllocated = preAllocatedHome.get(pair.b)?.has(pair.a) ?? false

        let homeTeamId: number
        let awayTeamId: number

        // If one team has pre-allocated home, use that orientation
        if (aPreAllocated && !bPreAllocated) {
          homeTeamId = pair.a
          awayTeamId = pair.b
        } else if (bPreAllocated && !aPreAllocated) {
          homeTeamId = pair.b
          awayTeamId = pair.a
        } else {
          // No pre-allocation: use scoring to determine home/away
          // Score each orientation: orientation balance penalty + venue availability bonus.
          // Lower score wins. For constrained venues (high utilization), boost the penalty
          // for NOT being able to host, scaled by the venue constraint score.
          const scoreAsHome = (homeId: number, awayId: number, canHostThisWeek: boolean): number => {
            const max = maxPerSide.get(homeId) ?? Number.MAX_SAFE_INTEGER
            const awayMax = maxPerSide.get(awayId) ?? Number.MAX_SAFE_INTEGER
              
            // Get venue constraint score to boost penalty for constrained venues
            const homeTeam = teamById.get(homeId)
            const homeConstraint = homeTeam?.homeClubId != null ? venueConstraintScore(homeTeam.homeClubId) : 0
              
            // Hosting penalty: base 25 + venue constraint bonus
            // Venues at 100% capacity (score 1.0) get +25 bonus = 50 total penalty
            // Venues at 200% capacity (score 2.0) get +50 bonus = 75 total penalty
            const hostingPenalty = canHostThisWeek ? 0 : (25 + homeConstraint * 25)
              
            const balancePenalty = orientationPenalty({
                teamId: homeId,
                side: "H",
                homeCount: homeCounts.get(homeId) ?? 0,
                awayCount: awayCounts.get(homeId) ?? 0,
                history: histories.get(homeId) ?? "",
                maxPerSide: max,
              }) +
              orientationPenalty({
                teamId: awayId,
                side: "A",
                homeCount: homeCounts.get(awayId) ?? 0,
                awayCount: awayCounts.get(awayId) ?? 0,
                history: histories.get(awayId) ?? "",
                maxPerSide: awayMax,
              })
              
            return balancePenalty + hostingPenalty
          }

          const scoreAHome = scoreAsHome(pair.a, pair.b, aCanHost)
          const scoreBHome = scoreAsHome(pair.b, pair.a, bCanHost)

          homeTeamId = scoreAHome <= scoreBHome ? pair.a : pair.b
          awayTeamId = homeTeamId === pair.a ? pair.b : pair.a
        }

        // Pick venue: home team's venue first, then away team's venue.
         // Never assign an unrelated venue — if neither team's venue is available
         // this week the fixture is left without a venue (TBD) so the admin can
         // assign one manually.
         let venuePick: { club: PlannerClub | null; kickoff: FixtureTimeslot | null } = {
           club: null,
           kickoff: null,
         }

        const tryTeamVenue = (teamId: number): boolean => {
          const team = teamById.get(teamId)
          if (!team?.homeClubId) return false
          const club = clubById.get(team.homeClubId)
          if (!club) return false
          const current = venueUsageForWeek(usage, week, club.id)
          if (current.total >= venueNightCapacity(club)) return false
          const kickoff = chooseKickoffForVenue(club, week, usage)
          if (!kickoff) return false
          venuePick = { club, kickoff }
          return true
        }

        if (!tryTeamVenue(homeTeamId)) tryTeamVenue(awayTeamId)

        if (venuePick.club && venuePick.kickoff) markVenueUsage(usage, week, venuePick.club, venuePick.kickoff)

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

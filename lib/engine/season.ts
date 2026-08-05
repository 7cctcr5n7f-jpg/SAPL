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
 * Pre-assign home weeks for all teams that share a venue across ALL divisions.
 *
 * Teams from different divisions can share the same physical venue. Since the
 * venue's nightly capacity is global (not per-division), this pre-pass must see
 * every division at once to distribute home weeks fairly before the per-division
 * orientation pass runs.
 *
 * For each venue whose total teams across all divisions exceeds its nightly
 * capacity, teams are sorted by (divisionId, slot) and given home weeks in a
 * round-robin pattern, capped at `capacity` home slots per week, until each
 * team accumulates ceil(games/2) forced-home weeks.
 *
 * Returns a Map<teamId, Set<week>> used as hard pre-commits in planSeason.
 */
function preAssignSharedVenueHomeGlobal(
  divisionRounds: Map<number, RoundPair[][]>,
  allDivisions: PlannerDivision[],
  clubById: Map<number, PlannerClub>,
): Map<number, Set<number>> {
  const forcedHome = new Map<number, Set<number>>()

  // Build a flat list of all teams across all divisions, grouped by homeClubId
  const teamsByClub = new Map<number, Array<{ teamId: number; divisionId: number; slot: number }>>()
  for (const division of allDivisions) {
    for (const team of division.teamSlots) {
      if (team.homeClubId == null) continue
      const bucket = teamsByClub.get(team.homeClubId) ?? []
      bucket.push({ teamId: team.id, divisionId: division.id, slot: team.slot })
      teamsByClub.set(team.homeClubId, bucket)
    }
  }

  for (const [clubId, sharingTeams] of teamsByClub.entries()) {
    const club = clubById.get(clubId)
    if (!club) continue
    const capacity = venueNightCapacity(club)
    // Only intervene when more teams share this venue than it can host per night
    if (sharingTeams.length <= capacity) continue

    // Sort deterministically: by divisionId then slot
    const sorted = [...sharingTeams].sort(
      (a, b) => a.divisionId - b.divisionId || a.slot - b.slot,
    )

    // For each team, find how many games they play (from their division's rounds)
    // and how many home games they need
    const homeTarget = new Map<number, number>()
    for (const { teamId, divisionId } of sorted) {
      const rounds = divisionRounds.get(divisionId) ?? []
      const counts = countGamesByTeam(rounds)
      homeTarget.set(teamId, Math.ceil((counts.get(teamId) ?? 0) / 2))
    }

    // Build active-weeks per team: weeks where that team has a fixture (no bye)
    const teamActiveWeeks = new Map<number, number[]>()
    for (const { teamId, divisionId } of sorted) {
      const rounds = divisionRounds.get(divisionId) ?? []
      const weeks: number[] = []
      for (let wi = 0; wi < rounds.length; wi++) {
        for (const pair of rounds[wi]) {
          if (pair.a === teamId || pair.b === teamId) weeks.push(wi + 1)
        }
      }
      teamActiveWeeks.set(teamId, weeks)
    }

    // Determine the total number of weeks (max rounds across involved divisions)
    const totalWeeks = Math.max(
      ...[...divisionRounds.values()].map((r) => r.length),
    )

    // Assign home weeks: walk every week, grant up to `capacity` slots, cycling
    // through sorted teams so each gets a fair share.
    const venueWeekUsage = new Map<number, number>()
    let pointer = 0

    for (let wi = 0; wi < totalWeeks; wi++) {
      const week = wi + 1
      const usedThisWeek = venueWeekUsage.get(week) ?? 0
      if (usedThisWeek >= capacity) continue

      let slotsRemaining = capacity - usedThisWeek
      let checked = 0

      while (slotsRemaining > 0 && checked < sorted.length) {
        const { teamId } = sorted[pointer % sorted.length]
        pointer++
        checked++

        // Skip if this team doesn't play this week
        if (!(teamActiveWeeks.get(teamId) ?? []).includes(week)) continue

        // Skip if this team already has enough forced-home weeks
        const alreadyForced = forcedHome.get(teamId)?.size ?? 0
        if (alreadyForced >= (homeTarget.get(teamId) ?? 0)) continue

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
  // Shared venue-usage map across all divisions and weeks.
  const usage: UsageByWeek = new Map()
  const planned: PlannedFixture[] = []

  const sortedDivisions = [...args.divisions].sort((a, b) => a.id - b.id)

  // Build all round-robin schedules upfront.
  const divisionRoundsMap = new Map<number, RoundPair[][]>()
  for (const division of sortedDivisions) {
    const orderedIds = [...division.teamSlots]
      .sort((a, b) => a.slot - b.slot || a.id - b.id)
      .map((t) => t.id)
    divisionRoundsMap.set(division.id, buildRoundRobinRounds(orderedIds))
  }

  // Global pre-pass: pre-assign forced-home weeks for teams sharing a venue
  // across ANY division so they never compete for the same venue in the same week.
  const forcedHomeWeeks = preAssignSharedVenueHomeGlobal(divisionRoundsMap, sortedDivisions, clubById)

  // Global venue team count across all divisions (used for priority scoring).
  const globalVenueTeamCount = new Map<number, number>()
  for (const division of sortedDivisions) {
    for (const team of division.teamSlots) {
      if (team.homeClubId != null) {
        globalVenueTeamCount.set(team.homeClubId, (globalVenueTeamCount.get(team.homeClubId) ?? 0) + 1)
      }
    }
  }

  // Per-division tracking state (home/away counts, history).
  const divisionState = new Map<
    number,
    {
      teamById: Map<number, PlannerTeam>
      maxHomeGames: Map<number, number>
      maxAwayGames: Map<number, number>
      homeCounts: Map<number, number>
      awayCounts: Map<number, number>
      histories: Map<number, string>
    }
  >()

  for (const division of sortedDivisions) {
    const rounds = divisionRoundsMap.get(division.id)!
    const gameCounts = countGamesByTeam(rounds)
    const maxHomeGames = new Map<number, number>()
    const maxAwayGames = new Map<number, number>()
    for (const [teamId, games] of gameCounts.entries()) {
      maxHomeGames.set(teamId, Math.ceil(games / 2))
      maxAwayGames.set(teamId, Math.floor(games / 2))
    }
    divisionState.set(division.id, {
      teamById: new Map(division.teamSlots.map((t) => [t.id, t])),
      maxHomeGames,
      maxAwayGames,
      homeCounts: new Map(),
      awayCounts: new Map(),
      histories: new Map(),
    })
  }

  // Helpers that resolve against the live shared usage map.
  const venueConstraintScore = (clubId: number): number => {
    const club = clubById.get(clubId)
    if (!club) return 0
    const teamCount = globalVenueTeamCount.get(clubId) ?? 0
    const capacity = venueNightCapacity(club)
    return capacity > 0 ? teamCount / capacity : teamCount * 100
  }

  const teamVenuePriorityGlobal = (teamId: number, divId: number): number => {
    const state = divisionState.get(divId)
    const team = state?.teamById.get(teamId)
    return team?.homeClubId != null ? venueConstraintScore(team.homeClubId) : 0
  }

  const teamCanHostWeek = (teamId: number, divId: number, week: number): boolean => {
    const state = divisionState.get(divId)
    const team = state?.teamById.get(teamId)
    if (!team?.homeClubId) return false
    const club = clubById.get(team.homeClubId)
    if (!club || venueNightCapacity(club) <= 0) return false
    return venueUsageForWeek(usage, week, club.id).total < venueNightCapacity(club)
  }

  // Process week-by-week across ALL divisions simultaneously so the shared
  // usage map is updated before the next division's pairs for the same week.
  const totalWeeks = Math.max(...[...divisionRoundsMap.values()].map((r) => r.length))

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    const week = weekIndex + 1
    const matchDate = new Date(firstNight.getTime() + weekIndex * 7 * MS_PER_DAY)

    // Collect all pairs this week across all divisions, tagged with divisionId.
    // Sort so pairs involving constrained (over-subscribed) venues are resolved first.
    const allPairsThisWeek: Array<{ divisionId: number; pair: RoundPair }> = []
    for (const division of sortedDivisions) {
      const rounds = divisionRoundsMap.get(division.id)!
      if (weekIndex >= rounds.length) continue
      for (const pair of rounds[weekIndex]) {
        allPairsThisWeek.push({ divisionId: division.id, pair })
      }
    }

    allPairsThisWeek.sort((x, y) => {
      const px = Math.max(teamVenuePriorityGlobal(x.pair.a, x.divisionId), teamVenuePriorityGlobal(x.pair.b, x.divisionId))
      const py = Math.max(teamVenuePriorityGlobal(y.pair.a, y.divisionId), teamVenuePriorityGlobal(y.pair.b, y.divisionId))
      return py - px
    })

    for (const { divisionId, pair } of allPairsThisWeek) {
      const state = divisionState.get(divisionId)!
      const { teamById, maxHomeGames, maxAwayGames, homeCounts, awayCounts, histories } = state

      const aHomeCount = homeCounts.get(pair.a) ?? 0
      const bHomeCount = homeCounts.get(pair.b) ?? 0
      const aAwayCount = awayCounts.get(pair.a) ?? 0
      const bAwayCount = awayCounts.get(pair.b) ?? 0
      const aMaxHome = maxHomeGames.get(pair.a) ?? Number.MAX_SAFE_INTEGER
      const bMaxHome = maxHomeGames.get(pair.b) ?? Number.MAX_SAFE_INTEGER
      const aMaxAway = maxAwayGames.get(pair.a) ?? Number.MAX_SAFE_INTEGER
      const bMaxAway = maxAwayGames.get(pair.b) ?? Number.MAX_SAFE_INTEGER

      // Pre-committed home weeks from the global pre-pass (highest priority).
      const aForcedHome = forcedHomeWeeks.get(pair.a)?.has(week) ?? false
      const bForcedHome = forcedHomeWeeks.get(pair.b)?.has(week) ?? false

      const aMustBeAway = aHomeCount >= aMaxHome
      const bMustBeAway = bHomeCount >= bMaxHome

      // "Must be home" only fires if the venue is actually available this week.
      const aCanHostNow = teamCanHostWeek(pair.a, divisionId, week)
      const bCanHostNow = teamCanHostWeek(pair.b, divisionId, week)
      const aMustBeHome = !bForcedHome && !aMustBeAway && aCanHostNow && (aAwayCount >= aMaxAway)
      const bMustBeHome = !aForcedHome && !bMustBeAway && bCanHostNow && (bAwayCount >= bMaxAway)

      let homeTeamId: number
      let awayTeamId: number

      // If both teams are must-away (both at home cap), the hard caps have been
      // exhausted — this can happen when cross-division forced-home assignments
      // drift out of sync with per-team caps. Fall through to scoring in that
      // case rather than blindly picking pair.a, which would over-count home games.
      const bothMustAway = aMustBeAway && bMustBeAway

      if (!bothMustAway && (aForcedHome || aMustBeHome || bMustBeAway)) {
        homeTeamId = pair.a
        awayTeamId = pair.b
      } else if (!bothMustAway && (bForcedHome || bMustBeHome || aMustBeAway)) {
        homeTeamId = pair.b
        awayTeamId = pair.a
      } else {
        const scoreAsHome = (homeId: number, awayId: number, canHostThisWeek: boolean): number => {
          const homeH = homeCounts.get(homeId) ?? 0
          const homeA = awayCounts.get(homeId) ?? 0
          const awayH = homeCounts.get(awayId) ?? 0
          const awayA = awayCounts.get(awayId) ?? 0
          const balance =
            orientationPenalty({ side: "H", homeCount: homeH, awayCount: homeA, history: histories.get(homeId) ?? "" }) +
            orientationPenalty({ side: "A", homeCount: awayH, awayCount: awayA, history: histories.get(awayId) ?? "" })
          return balance + (canHostThisWeek ? 0 : 15)
        }

        const scoreA = scoreAsHome(pair.a, pair.b, aCanHostNow)
        const scoreB = scoreAsHome(pair.b, pair.a, bCanHostNow)
        if (scoreA !== scoreB) {
          homeTeamId = scoreA < scoreB ? pair.a : pair.b
        } else {
          // Break ties by fewest home games so far (favour the under-hosted team).
          const aH = homeCounts.get(pair.a) ?? 0
          const bH = homeCounts.get(pair.b) ?? 0
          homeTeamId = aH <= bH ? pair.a : pair.b
        }
        awayTeamId = homeTeamId === pair.a ? pair.b : pair.a
      }

      // If home team's venue is now blocked (used by an earlier pair this week
      // from another division) but the away team can host, flip — unless doing
      // so would push the new home team over their max-home cap.
      const homeCanHostNow = teamCanHostWeek(homeTeamId, divisionId, week)
      const awayCanHostNow = teamCanHostWeek(awayTeamId, divisionId, week)
      if (!homeCanHostNow && awayCanHostNow) {
        const newHomeWouldExceedCap = (homeCounts.get(awayTeamId) ?? 0) >= (maxHomeGames.get(awayTeamId) ?? 0)
        if (!newHomeWouldExceedCap) {
          ;[homeTeamId, awayTeamId] = [awayTeamId, homeTeamId]
        }
      }

      // Pick venue.
      let venuePick: { club: PlannerClub | null; kickoff: FixtureTimeslot | null } = { club: null, kickoff: null }
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

      planned.push({
        divisionId,
        week,
        homeTeamId,
        awayTeamId,
        homeSlot: teamById.get(homeTeamId)?.slot ?? 0,
        awaySlot: teamById.get(awayTeamId)?.slot ?? 0,
        matchDate,
        venueClubId: venuePick.club?.id ?? null,
        venue: venuePick.club?.name ?? null,
        timeslot: venuePick.kickoff,
        courtAssignments: buildCourtAssignments(venuePick.club?.courts ?? 0, venuePick.kickoff),
      })
    }
  }

  return planned
}

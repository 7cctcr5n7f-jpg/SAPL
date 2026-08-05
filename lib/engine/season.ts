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

export type PlannedPairing = {
  divisionId: number
  round: number
  pairingOrder: number
  teamAId: number
  teamBId: number
  teamASlot: number
  teamBSlot: number
}

type RoundPair = { a: number; b: number }

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

export function buildCourtAssignments(courts: number, kickoff: FixtureTimeslot | null): PlannedCourtAssignments {
  const safeCourts = Math.max(1, courts || 0)
  const out: PlannedCourtAssignments = {}

  if (safeCourts >= 4) {
    const primaryTime = kickoff ?? FIXTURE_TIMESLOTS[0]
    out["Mens Open"] = { court: "1", time: primaryTime }
    out["Ladies Open"] = { court: "2", time: primaryTime }
    out["Mens Intermediate"] = { court: "3", time: primaryTime }
    out["Mens Beginner"] = { court: "4", time: primaryTime }
    return out
  }

  out["Mens Open"] = { court: "1", time: "17:00" }
  out["Mens Beginner"] = { court: "2", time: "17:00" }
  out["Ladies Open"] = { court: "1", time: "18:30" }
  out["Mens Intermediate"] = { court: "2", time: "18:30" }
  return out
}

export function nextThursday(from: Date): Date {
  const utcYear = from.getUTCFullYear()
  const utcMonth = from.getUTCMonth()
  const utcDay = from.getUTCDate()
  const baseDay = from.getUTCDay()
  const delta = (4 - baseDay + 7) % 7
  return new Date(Date.UTC(utcYear, utcMonth, utcDay + delta, 17, 0, 0, 0))
}

export function balanceTimeslots(fixtures: { homeSlot: number; awaySlot: number }[]): FixtureTimeslot[] {
  const [early, late] = FIXTURE_TIMESLOTS
  return fixtures.map((_, index) => (index % 2 === 0 ? early : late))
}

export function planSeason(args: {
  startDate: Date
  divisions: PlannerDivision[]
  clubs: PlannerClub[]
}): PlannedPairing[] {
  void args.startDate
  void args.clubs

  const planned: PlannedPairing[] = []

  for (const division of args.divisions) {
    const sorted = [...division.teamSlots].sort((a, b) => a.slot - b.slot || a.id - b.id)
    const rounds = buildRoundRobinRounds(sorted.map((team) => team.id))
    const slotById = new Map(sorted.map((team) => [team.id, team.slot]))

    rounds.forEach((round, roundIndex) => {
      round.forEach((pair, pairIndex) => {
        planned.push({
          divisionId: division.id,
          round: roundIndex + 1,
          pairingOrder: pairIndex + 1,
          teamAId: pair.a,
          teamBId: pair.b,
          teamASlot: slotById.get(pair.a) ?? 0,
          teamBSlot: slotById.get(pair.b) ?? 0,
        })
      })
    })
  }

  return planned
}

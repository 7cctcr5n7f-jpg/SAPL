/**
 * Fixture & bracket generation for the PPL competition structure.
 */

export type GeneratedFixture = {
  week: number
  homeTeamId: number
  awayTeamId: number
}

/**
 * Round-robin schedule (circle method) for a division of teams.
 * With 6 teams this yields 5 rounds = the 5-week regular season.
 */
export function generateRoundRobin(teamIds: number[]): GeneratedFixture[] {
  const teams = [...teamIds]
  const fixtures: GeneratedFixture[] = []
  const hasBye = teams.length % 2 !== 0
  if (hasBye) teams.push(-1) // bye marker

  const n = teams.length
  const rounds = n - 1
  const half = n / 2
  const rotation = [...teams]

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i]
      const away = rotation[n - 1 - i]
      if (home !== -1 && away !== -1) {
        // alternate home/away for fairness
        if (r % 2 === 0) fixtures.push({ week: r + 1, homeTeamId: home, awayTeamId: away })
        else fixtures.push({ week: r + 1, homeTeamId: away, awayTeamId: home })
      }
    }
    // rotate, keeping first team fixed
    const fixed = rotation[0]
    const rest = rotation.slice(1)
    rest.unshift(rest.pop() as number)
    rotation.splice(0, rotation.length, fixed, ...rest)
  }

  return fixtures
}

export type PlayoffPairing = {
  round: string
  homeTeamId: number | null
  awayTeamId: number | null
  bracketPosition: number
}

// ---- Placeholder bracket templates ---------------------------------------
// These build the playoff structure BEFORE standings exist, mirroring how
// league fixtures use division slots. Seeds / region ids / source brackets are
// resolved into real teams later via `pullPlayoffTeams`.

export type PlayoffTemplate = {
  type: "regional_final" | "tshwane_masters"
  round: "quarter_final" | "semi_final" | "final"
  divisionId: number | null
  regionId: number | null
  bracketPosition: number
  homeSeed: number | null
  awaySeed: number | null
  homeRegionId: number | null
  awayRegionId: number | null
  homeSourceBracket: number | null
  awaySourceBracket: number | null
  homeLabel: string
  awayLabel: string
}

const ordinal = (n: number) => ["", "1st", "2nd", "3rd", "4th"][n] ?? `${n}th`

export type DivisionPlayoffStandingInput = {
  divisionId: number
  divisionLevel: number
  divisionName: string
  regionId: number | null
  regionName: string | null
  teamId: number
  teamName?: string | null
  rank: number | null
  points: number
  wins: number
  setsWon: number
  pointsDiff: number
}

export type DivisionPlayoffQualifier = DivisionPlayoffStandingInput & {
  seed: number
  qualificationType: "direct" | "wildcard"
}

function compareQualifierStrength(a: Pick<DivisionPlayoffStandingInput, "rank" | "points" | "wins" | "setsWon" | "pointsDiff" | "teamId">, b: Pick<DivisionPlayoffStandingInput, "rank" | "points" | "wins" | "setsWon" | "pointsDiff" | "teamId">) {
  const rankA = a.rank ?? Number.MAX_SAFE_INTEGER
  const rankB = b.rank ?? Number.MAX_SAFE_INTEGER
  if (rankA !== rankB) return rankA - rankB
  if (b.points !== a.points) return b.points - a.points
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
  if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
  return a.teamId - b.teamId
}

export function computeDivisionPlayoffQualifiers(
  rows: DivisionPlayoffStandingInput[],
  targetSize = 8,
): DivisionPlayoffQualifier[] {
  const rankedRows = rows
    .filter((row): row is DivisionPlayoffStandingInput & { rank: number } => row.rank != null)
    .sort((a, b) => compareQualifierStrength(a, b))

  const rowsByRegion = new Map<number | null, (DivisionPlayoffStandingInput & { rank: number })[]>()
  for (const row of rankedRows) {
    const bucket = rowsByRegion.get(row.regionId) ?? []
    bucket.push(row)
    rowsByRegion.set(row.regionId, bucket)
  }

  const regionCount = rowsByRegion.size
  if (regionCount === 0) return []

  const basePerRegion = Math.floor(targetSize / regionCount)
  const extraSlots = targetSize % regionCount

  const direct: DivisionPlayoffQualifier[] = []
  const wildcards: DivisionPlayoffQualifier[] = []

  for (const regionRows of rowsByRegion.values()) {
    const ordered = [...regionRows].sort((a, b) => compareQualifierStrength(a, b))
    for (const row of ordered.slice(0, basePerRegion)) {
      direct.push({ ...row, seed: 0, qualificationType: "direct" })
    }
    const wildcardCandidate = ordered[basePerRegion]
    if (wildcardCandidate) {
      wildcards.push({ ...wildcardCandidate, seed: 0, qualificationType: "wildcard" })
    }
  }

  const selected = [
    ...direct,
    ...wildcards.sort((a, b) => compareQualifierStrength(a, b)).slice(0, extraSlots),
  ]
    .sort((a, b) => compareQualifierStrength(a, b))
    .slice(0, targetSize)

  return selected.map((row, index) => ({ ...row, seed: index + 1 }))
}

export function buildDivisionPlayoffTemplates(opts: {
  divisionId: number
  divisionName: string
}): PlayoffTemplate[] {
  const { divisionId, divisionName } = opts
  const seedLabel = (seed: number) => `${divisionName} Seed ${seed}`
  const base = {
    type: "regional_final" as const,
    divisionId,
    regionId: null,
    homeRegionId: null,
    awayRegionId: null,
  }
  return [
    {
      ...base,
      round: "quarter_final",
      bracketPosition: 1,
      homeSeed: 1,
      awaySeed: 8,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: seedLabel(1),
      awayLabel: seedLabel(8),
    },
    {
      ...base,
      round: "quarter_final",
      bracketPosition: 2,
      homeSeed: 4,
      awaySeed: 5,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: seedLabel(4),
      awayLabel: seedLabel(5),
    },
    {
      ...base,
      round: "quarter_final",
      bracketPosition: 3,
      homeSeed: 2,
      awaySeed: 7,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: seedLabel(2),
      awayLabel: seedLabel(7),
    },
    {
      ...base,
      round: "quarter_final",
      bracketPosition: 4,
      homeSeed: 3,
      awaySeed: 6,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: seedLabel(3),
      awayLabel: seedLabel(6),
    },
    {
      ...base,
      round: "semi_final",
      bracketPosition: 5,
      homeSeed: null,
      awaySeed: null,
      homeSourceBracket: 1,
      awaySourceBracket: 2,
      homeLabel: "Winner Quarter 1",
      awayLabel: "Winner Quarter 2",
    },
    {
      ...base,
      round: "semi_final",
      bracketPosition: 6,
      homeSeed: null,
      awaySeed: null,
      homeSourceBracket: 3,
      awaySourceBracket: 4,
      homeLabel: "Winner Quarter 3",
      awayLabel: "Winner Quarter 4",
    },
    {
      ...base,
      round: "final",
      bracketPosition: 7,
      homeSeed: null,
      awaySeed: null,
      homeSourceBracket: 5,
      awaySourceBracket: 6,
      homeLabel: "Winner Semi 1",
      awayLabel: "Winner Semi 2",
    },
  ]
}

/**
 * Regional Final bracket for one division: SF1 (1st v 4th), SF2 (2nd v 3rd) and
 * a Final fed by the two semi winners. Labels read e.g. "Premier 1st (East)".
 */
export function buildRegionalFinalTemplates(opts: {
  divisionId: number
  divisionName: string
  regionId: number | null
  regionLabel?: string | null
}): PlayoffTemplate[] {
  const { divisionId, divisionName, regionId } = opts
  const tag = opts.regionLabel ? ` (${opts.regionLabel})` : ""
  const base = {
    type: "regional_final" as const,
    divisionId,
    regionId,
    homeRegionId: null,
    awayRegionId: null,
  }
  return [
    {
      ...base,
      round: "semi_final",
      bracketPosition: 1,
      homeSeed: 1,
      awaySeed: 4,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: `${divisionName} ${ordinal(1)}${tag}`,
      awayLabel: `${divisionName} ${ordinal(4)}${tag}`,
    },
    {
      ...base,
      round: "semi_final",
      bracketPosition: 2,
      homeSeed: 2,
      awaySeed: 3,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: `${divisionName} ${ordinal(2)}${tag}`,
      awayLabel: `${divisionName} ${ordinal(3)}${tag}`,
    },
    {
      ...base,
      round: "final",
      bracketPosition: 3,
      homeSeed: null,
      awaySeed: null,
      homeSourceBracket: 1,
      awaySourceBracket: 2,
      homeLabel: "Winner Semi 1",
      awayLabel: "Winner Semi 2",
    },
  ]
}

/**
 * Masters placeholder bracket for the active season regions.
 *
 * Supports:
 *  - 2 regions: direct final
 *  - 3 regions: region 1 bye to final, regions 2v3 in a semi
 *  - 4 regions: two semis and a final
 */
export function buildMastersTemplates(regions: { id: number; name: string }[]): PlayoffTemplate[] {
  const base = {
    type: "tshwane_masters" as const,
    divisionId: null,
    regionId: null,
    homeSeed: null,
    awaySeed: null,
  }
  if (regions.length < 2) return []
  if (regions.length === 2) {
    return [
      {
        ...base,
        round: "final",
        bracketPosition: 1,
        homeRegionId: regions[0].id,
        awayRegionId: regions[1].id,
        homeSourceBracket: null,
        awaySourceBracket: null,
        homeLabel: `${regions[0].name} Champion`,
        awayLabel: `${regions[1].name} Champion`,
      },
    ]
  }
  if (regions.length === 3) {
    return [
      {
        ...base,
        round: "semi_final",
        bracketPosition: 1,
        homeRegionId: regions[1].id,
        awayRegionId: regions[2].id,
        homeSourceBracket: null,
        awaySourceBracket: null,
        homeLabel: `${regions[1].name} Champion`,
        awayLabel: `${regions[2].name} Champion`,
      },
      {
        ...base,
        round: "final",
        bracketPosition: 2,
        homeRegionId: regions[0].id,
        awayRegionId: null,
        homeSourceBracket: null,
        awaySourceBracket: 1,
        homeLabel: `${regions[0].name} Champion`,
        awayLabel: "Winner Semi 1",
      },
    ]
  }
  return [
    {
      ...base,
      round: "semi_final",
      bracketPosition: 1,
      homeRegionId: regions[0].id,
      awayRegionId: regions[3].id,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: `${regions[0].name} Champion`,
      awayLabel: `${regions[3].name} Champion`,
    },
    {
      ...base,
      round: "semi_final",
      bracketPosition: 2,
      homeRegionId: regions[1].id,
      awayRegionId: regions[2].id,
      homeSourceBracket: null,
      awaySourceBracket: null,
      homeLabel: `${regions[1].name} Champion`,
      awayLabel: `${regions[2].name} Champion`,
    },
    {
      ...base,
      round: "final",
      bracketPosition: 3,
      homeRegionId: null,
      awayRegionId: null,
      homeSourceBracket: 1,
      awaySourceBracket: 2,
      homeLabel: "Winner Semi 1",
      awayLabel: "Winner Semi 2",
    },
  ]
}

/**
 * Promotion / relegation playoff:
 * 5th and 6th of a division play the top two of the division below.
 */
export function generatePromotionRelegation(
  upperDivision: { rank: number; teamId: number }[],
  lowerDivision: { rank: number; teamId: number }[],
): PlayoffPairing[] {
  const upper5 = upperDivision.find((t) => t.rank === 5)?.teamId ?? null
  const upper6 = upperDivision.find((t) => t.rank === 6)?.teamId ?? null
  const lower1 = lowerDivision.find((t) => t.rank === 1)?.teamId ?? null
  const lower2 = lowerDivision.find((t) => t.rank === 2)?.teamId ?? null

  return [
    { round: "Promotion Playoff", homeTeamId: upper5, awayTeamId: lower2, bracketPosition: 1 },
    { round: "Promotion Playoff", homeTeamId: upper6, awayTeamId: lower1, bracketPosition: 2 },
  ]
}

/**
 * Regional Finals: top four teams qualify.
 * Semi Finals: 1v4, 2v3. Final between winners.
 */
export function generateRegionalFinals(top4: { rank: number; teamId: number }[]): PlayoffPairing[] {
  const t = (rank: number) => top4.find((x) => x.rank === rank)?.teamId ?? null
  return [
    { round: "Semi Final", homeTeamId: t(1), awayTeamId: t(4), bracketPosition: 1 },
    { round: "Semi Final", homeTeamId: t(2), awayTeamId: t(3), bracketPosition: 2 },
    { round: "Final", homeTeamId: null, awayTeamId: null, bracketPosition: 3 },
  ]
}

/**
 * Tshwane Masters: regional champions progress into a knockout bracket.
 * Supports any power-of-two-ish number of regions (byes handled).
 */
export function generateMastersBracket(champions: { regionId: number; teamId: number }[]): PlayoffPairing[] {
  const pairings: PlayoffPairing[] = []
  const teams = champions.map((c) => c.teamId)
  let pos = 1
  if (teams.length === 4) {
    pairings.push({ round: "Semi Final", homeTeamId: teams[0], awayTeamId: teams[3], bracketPosition: pos++ })
    pairings.push({ round: "Semi Final", homeTeamId: teams[1], awayTeamId: teams[2], bracketPosition: pos++ })
    pairings.push({ round: "Final", homeTeamId: null, awayTeamId: null, bracketPosition: pos++ })
  } else {
    for (let i = 0; i < teams.length; i += 2) {
      pairings.push({
        round: "Round 1",
        homeTeamId: teams[i] ?? null,
        awayTeamId: teams[i + 1] ?? null,
        bracketPosition: pos++,
      })
    }
    pairings.push({ round: "Final", homeTeamId: null, awayTeamId: null, bracketPosition: pos++ })
  }
  return pairings
}

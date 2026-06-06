import { CATEGORY_RULES, type CategoryRule } from "@/lib/constants"

export function getCategoryRule(name: string): CategoryRule | undefined {
  return CATEGORY_RULES.find((c) => c.name === name)
}

export type LineupPlayer = {
  id: number
  name: string
  gender: "male" | "female"
  li: number
}

export type EligibilityResult = {
  valid: boolean
  category: string
  avgLi: number
  avgLiMax: number
  errors: string[]
  warnings: string[]
}

/**
 * Validate a 2-player lineup for a given category against League Index rules.
 * - Each player's LI must be within [playerMinLi, playerMaxLi]
 * - Team average LI must not exceed avgTeamMaxLi (anti-sandbagging cap)
 * - Gender must match the category (mixed requires one male + one female)
 */
export function validateLineup(categoryName: string, lineup: LineupPlayer[]): EligibilityResult {
  const rule = getCategoryRule(categoryName)
  const errors: string[] = []
  const warnings: string[] = []

  if (!rule) {
    return {
      valid: false,
      category: categoryName,
      avgLi: 0,
      avgLiMax: 0,
      errors: [`Unknown category: ${categoryName}`],
      warnings: [],
    }
  }

  if (lineup.length !== 2) {
    errors.push(`A lineup requires exactly 2 players (got ${lineup.length}).`)
  }

  const avgLi = lineup.length ? lineup.reduce((s, p) => s + p.li, 0) / lineup.length : 0

  // Gender checks
  if (rule.gender === "mixed") {
    const males = lineup.filter((p) => p.gender === "male").length
    const females = lineup.filter((p) => p.gender === "female").length
    if (lineup.length === 2 && (males !== 1 || females !== 1)) {
      errors.push("Mixed requires exactly one male and one female player.")
    }
  } else {
    for (const p of lineup) {
      if (p.gender !== rule.gender) {
        errors.push(`${p.name} does not match the ${rule.gender} requirement for ${rule.name}.`)
      }
    }
  }

  // Per-player LI range
  for (const p of lineup) {
    if (p.li < rule.playerMinLi || p.li > rule.playerMaxLi) {
      errors.push(
        `${p.name} (LI ${p.li.toFixed(1)}) is outside the allowed range ${rule.playerMinLi.toFixed(1)}–${rule.playerMaxLi.toFixed(1)} for ${rule.name}.`,
      )
    }
  }

  // Team average cap
  if (avgLi > rule.avgTeamMaxLi + 1e-9) {
    errors.push(
      `Average team LI ${avgLi.toFixed(2)} exceeds the maximum ${rule.avgTeamMaxLi.toFixed(1)} for ${rule.name}.`,
    )
  } else if (avgLi > rule.avgTeamMaxLi - 0.2) {
    warnings.push(`Average team LI ${avgLi.toFixed(2)} is close to the cap of ${rule.avgTeamMaxLi.toFixed(1)}.`)
  }

  return {
    valid: errors.length === 0,
    category: rule.name,
    avgLi,
    avgLiMax: rule.avgTeamMaxLi,
    errors,
    warnings,
  }
}

/**
 * Registration / category validation for a single player.
 * Returns the categories the player is eligible for based on current LI + gender.
 */
export function eligibleCategoriesForPlayer(gender: "male" | "female", li: number): string[] {
  return CATEGORY_RULES.filter((rule) => {
    const genderOk = rule.gender === "mixed" || rule.gender === gender
    const liOk = li >= rule.playerMinLi && li <= rule.playerMaxLi
    return genderOk && liOk
  }).map((r) => r.name)
}

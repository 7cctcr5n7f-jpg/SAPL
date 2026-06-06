import { TPR_CONFIG } from "@/lib/constants"

export type TprInput = {
  homeTpr: number
  awayTpr: number
  homeSetsWon: number
  awaySetsWon: number
  divisionLevel?: number // 1 = Premier (strongest) .. 4 = Challenge
  isPlayoff?: boolean
}

export type TprOutput = {
  homeTpr: number
  awayTpr: number
  homeChange: number
  awayChange: number
}

/**
 * ELO-based Team Power Rating update.
 * Factors: opponent strength (ELO expectation), margin of victory,
 * division strength, and playoff weighting.
 */
export function calculateTpr(input: TprInput): TprOutput {
  const { homeTpr, awayTpr, homeSetsWon, awaySetsWon } = input

  // Expected score via standard ELO logistic
  const expectedHome = 1 / (1 + Math.pow(10, (awayTpr - homeTpr) / 400))
  const expectedAway = 1 - expectedHome

  // Actual outcome (1 win / 0.5 draw / 0 loss)
  let actualHome = 0.5
  if (homeSetsWon > awaySetsWon) actualHome = 1
  else if (awaySetsWon > homeSetsWon) actualHome = 0
  const actualAway = 1 - actualHome

  // Margin-of-victory multiplier
  const totalSets = Math.max(1, homeSetsWon + awaySetsWon)
  const margin = Math.abs(homeSetsWon - awaySetsWon) / totalSets
  const movMultiplier = 1 + margin * (TPR_CONFIG.marginFactor - 1)

  // Division strength multiplier (stronger divisions move ratings more)
  const level = input.divisionLevel ?? 4
  const divisionMultiplier = 1 + (4 - level) * TPR_CONFIG.divisionFactorStep

  // Playoff weighting
  const playoffMultiplier = input.isPlayoff ? TPR_CONFIG.playoffMultiplier : 1

  const k = TPR_CONFIG.kFactor * movMultiplier * divisionMultiplier * playoffMultiplier

  const homeChange = Math.round(k * (actualHome - expectedHome) * 10) / 10
  const awayChange = Math.round(k * (actualAway - expectedAway) * 10) / 10

  return {
    homeTpr: Math.round((homeTpr + homeChange) * 10) / 10,
    awayTpr: Math.round((awayTpr + awayChange) * 10) / 10,
    homeChange,
    awayChange,
  }
}

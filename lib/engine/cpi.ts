/**
 * Club Performance Index (CPI):
 * Average TPR of an organisation's best two teams.
 * If an org has only one team, CPI = that team's TPR.
 */
export function calculateCpi(teamTprs: number[]): number {
  if (teamTprs.length === 0) return 0
  const sorted = [...teamTprs].sort((a, b) => b - a)
  const best = sorted.slice(0, 2)
  const avg = best.reduce((s, t) => s + t, 0) / best.length
  return Math.round(avg * 10) / 10
}

export type CpiRankRow = {
  organisationId: number
  cpi: number
  province: string
  rank: number
  provincialRank: number
  nationalRank: number
}

export function rankCpi(
  orgs: { organisationId: number; cpi: number; province: string }[],
): CpiRankRow[] {
  const national = [...orgs].sort((a, b) => b.cpi - a.cpi)
  const provincialCounters: Record<string, number> = {}

  return national.map((org, i) => {
    provincialCounters[org.province] = (provincialCounters[org.province] ?? 0) + 1
    return {
      ...org,
      rank: i + 1,
      nationalRank: i + 1,
      provincialRank: provincialCounters[org.province],
    }
  })
}

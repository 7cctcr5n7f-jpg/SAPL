export const SEASON_LIFECYCLE_STATUSES = [
  "registration_open",
  "registration_closed",
  "divisions_finalised",
  "fixtures_generated",
  "league_locked",
] as const

export type SeasonLifecycleStatus = (typeof SEASON_LIFECYCLE_STATUSES)[number]

export function normalizeSeasonStatus(status: string | null | undefined): SeasonLifecycleStatus {
  switch (status) {
    case "registration_open":
    case "registration_closed":
    case "divisions_finalised":
    case "fixtures_generated":
    case "league_locked":
      return status
    case "setup":
      return "registration_open"
    case "validated":
      return "divisions_finalised"
    case "draft":
      return "fixtures_generated"
    case "active":
    case "published":
      return "league_locked"
    default:
      return "registration_open"
  }
}

export function isSeasonLockedStatus(status: string | null | undefined): boolean {
  const normalized = normalizeSeasonStatus(status)
  return normalized === "league_locked"
}

export function seasonStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeSeasonStatus(status)
  switch (normalized) {
    case "registration_open":
      return "Registration Open"
    case "registration_closed":
      return "Registration Closed"
    case "divisions_finalised":
      return "Divisions Finalised"
    case "fixtures_generated":
      return "Fixtures Generated"
    case "league_locked":
      return "League Locked"
    default:
      return "Registration Open"
  }
}

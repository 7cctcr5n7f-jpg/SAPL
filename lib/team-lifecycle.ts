export const TEAM_LIFECYCLE_STATUSES = [
  "draft",
  "recruiting",
  "ready",
  "division_assigned",
  "fixtures_generated",
  "league_active",
  "completed",
] as const

export type TeamLifecycleStatus = (typeof TEAM_LIFECYCLE_STATUSES)[number]

// Team statuses considered "live" in list/read models.
// Includes legacy statuses so existing data keeps working.
export const TEAM_VISIBLE_STATUSES = [
  ...TEAM_LIFECYCLE_STATUSES,
  "active",
  "pending",
] as const

export function deriveTeamLifecycleStatus(input: {
  playerCount: number
  maxPlayers: number
  divisionId: number | null
  fixtureCount: number
  remainingFixtureCount: number
  seasonStatus: string | null
}): TeamLifecycleStatus {
  if (input.fixtureCount > 0 && input.remainingFixtureCount === 0) return "completed"
  if (input.fixtureCount > 0 && input.seasonStatus === "active") return "league_active"
  if (input.fixtureCount > 0) return "fixtures_generated"
  if (input.divisionId != null) return "division_assigned"
  if (input.playerCount >= input.maxPlayers) return "ready"
  if (input.playerCount > 0) return "recruiting"
  return "draft"
}

export function formatTeamStatusLabel(status: string): string {
  switch (status) {
    case "division_assigned":
      return "Division Assigned"
    case "fixtures_generated":
      return "Fixtures Generated"
    case "league_active":
      return "League Active"
    default:
      return status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
  }
}

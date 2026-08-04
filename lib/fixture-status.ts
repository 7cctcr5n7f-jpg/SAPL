export const DRAFT_FIXTURE_STATUS = "draft"

export function isDraftFixtureStatus(status: string | null | undefined) {
  return status === DRAFT_FIXTURE_STATUS
}

export function isEditableLeagueFixtureStatus(status: string | null | undefined) {
  return status === DRAFT_FIXTURE_STATUS || status === "scheduled"
}

export function isCompletedFixtureStatus(status: string | null | undefined) {
  return status === "completed"
}

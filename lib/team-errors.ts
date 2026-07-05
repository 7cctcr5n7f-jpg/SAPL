import { TEAM_SQUAD_SIZE } from "@/lib/constants"

/**
 * Thrown when a roster is already at the hard cap of active players. Lives in a
 * plain module (not a "use server" file) so it can be exported as a class —
 * "use server" modules may only export async functions.
 */
export class TeamFullError extends Error {
  constructor() {
    super(`This team already has the maximum of ${TEAM_SQUAD_SIZE} players.`)
    this.name = "TeamFullError"
  }
}

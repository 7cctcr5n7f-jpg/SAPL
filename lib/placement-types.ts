// Shared, db-free types & constants for the Placement Board. Safe to import from
// client components (no database / pg imports here).

export const PLACEMENT_SLOTS = 8

export type BoardTeam = {
  id: number
  name: string
  teamType: string
  logoUrl: string | null
  avgLi: number
  playerCount: number
  maxPlayers: number
  saplRegion: string | null
  homeClubId: number | null
  homeClubName: string | null
  captainName: string | null
  managerName: string | null
  divisionId: number | null
  slot: number | null
  sortOrder: number
}

export type BoardDivision = {
  id: number
  name: string
  level: number
  maxTeams: number
  regionName: string | null
}

export type PlacementBoardData = {
  seasonId: number
  seasonName: string
  divisions: BoardDivision[]
  teams: BoardTeam[]
}

export type RosterEntry = {
  playerId: string
  name: string
  li: number
  isCaptain: boolean
}

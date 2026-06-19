import { db } from "@/lib/db"
import {
  teams,
  divisions,
  teamEntries,
  clubs,
  teamMembers,
  seasons,
  regions,
  user,
} from "@/lib/db/schema"
import { and, eq, asc } from "drizzle-orm"
import type { BoardTeam, BoardDivision, PlacementBoardData, RosterEntry } from "@/lib/placement-types"

export { PLACEMENT_SLOTS } from "@/lib/placement-types"
export type { BoardTeam, BoardDivision, PlacementBoardData, RosterEntry } from "@/lib/placement-types"

async function nameForUserId(userId: string | null): Promise<string | null> {
  if (!userId) return null
  const [p] = await db
    .select({ first: user.firstName, last: user.lastName })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (p) return `${p.first} ${p.last}`
  const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  return u?.name ?? null
}

export async function getPlacementBoard(seasonId: number): Promise<PlacementBoardData | null> {
  const [season] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, seasonId)).limit(1)

  const divs = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      level: divisions.level,
      maxTeams: divisions.maxTeams,
      regionName: regions.name,
    })
    .from(divisions)
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(eq(divisions.seasonId, seasonId))
    .orderBy(asc(divisions.level), asc(divisions.id))

  const divIds = new Set(divs.map((d) => d.id))

  // All active teams + their entry for this season (if any).
  const rows = await db
    .select({
      team: teams,
      club: clubs,
      entry: teamEntries,
    })
    .from(teams)
    .leftJoin(clubs, eq(teams.homeClubId, clubs.id))
    .leftJoin(teamEntries, and(eq(teamEntries.teamId, teams.id), eq(teamEntries.seasonId, seasonId)))
    .where(eq(teams.status, "active"))
    .orderBy(asc(teams.name))

  const boardTeams: BoardTeam[] = []
  for (const r of rows) {
    const captainName = await nameForUserId(r.team.captainUserId)
    const managerName = await nameForUserId(r.team.managerUserId)
    // A team is placed only if its entry points to a division belonging to this season.
    const placedDivId =
      r.entry?.divisionId && divIds.has(r.entry.divisionId) ? r.entry.divisionId : null
    boardTeams.push({
      id: r.team.id,
      name: r.team.name,
      teamType: r.team.teamType,
      logoUrl: r.team.logoUrl,
      avgLi: r.team.avgLi,
      playerCount: r.team.playerCount,
      maxPlayers: r.team.maxPlayers,
      // Fall back to the home club's region when the team's own region is unset
      // so teams aren't hidden by the board's region filter.
      saplRegion: r.team.saplRegion ?? r.club?.saplRegion ?? null,
      homeClubId: r.team.homeClubId,
      homeClubName: r.club?.name ?? null,
      captainName,
      managerName,
      divisionId: placedDivId,
      slot: placedDivId ? (r.entry?.slot ?? null) : null,
      sortOrder: r.entry?.sortOrder ?? 0,
    })
  }

  return {
    seasonId,
    seasonName: season?.name ?? `Season ${seasonId}`,
    divisions: divs,
    teams: boardTeams,
  }
}

export async function getTeamRoster(teamId: number): Promise<RosterEntry[]> {
  const rows = await db
    .select({
      playerId: user.id,
      first: user.firstName,
      last: user.lastName,
      li: user.currentLi,
      userId: user.id,
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.playerId, user.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))
    .orderBy(asc(user.currentLi))

  const [team] = await db.select({ captainUserId: teams.captainUserId }).from(teams).where(eq(teams.id, teamId)).limit(1)

  return rows.map((r) => ({
    playerId: r.playerId,
    name: `${r.first} ${r.last}`,
    li: r.li,
    isCaptain: !!team?.captainUserId && r.userId === team.captainUserId,
  }))
}

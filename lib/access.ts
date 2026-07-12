import "server-only"
import { db } from "@/lib/db"
import { clubs, teamMembers, teams } from "@/lib/db/schema"
import { and, eq, inArray, sql } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { PERMISSIONS, type Permission } from "@/lib/permissions"

export type ClubAssignment = {
  clubId: number
  clubName: string
  /** true when matched automatically via club contact email (cannot be removed). */
  auto: boolean
}

export type TeamAssignment = {
  teamId: number
  teamName: string
  /**
   * "owner" (email match), "captain" (active captain membership),
   * "member" (active non-captain membership), or "club" (team homed at a
   * managed club).
   */
  source: "owner" | "captain" | "member" | "club" | "manual"
}

export type AccessContext = {
  user: CurrentUser
  permissions: Set<Permission>
  /** Effective club ids this user may manage. */
  clubIds: number[]
  clubAssignments: ClubAssignment[]
  /** Teams associated to this user (ownership, captaincy, membership, club scope). */
  teamIds: number[]
  teamAssignments: TeamAssignment[]
  /** Teams this user may actively manage. */
  manageableTeamIds: number[]
  /** Team-owner scope (owner email / co-owner email / captain membership). */
  ownedTeamIds: number[]
  /** True when the user has full league access (sees everything). */
  isLeagueAdmin: boolean
  can(permission: Permission): boolean
  canManageClub(clubId: number): boolean
  canManageTeam(teamId: number): boolean
}

/**
 * Resolves the full access context for a user: effective permissions, assigned
 * clubs and teams (email-matched + manual overrides), and convenience guards.
 *
 * Assignment rules (per the SAPL workflow):
 *  - Super Admin: unrestricted.
 *  - Club scope: clubs whose contact emails match the user's email.
 *  - Team-owner scope: teams whose owner/co-owner email matches the user, plus
 *    active captain memberships.
 *  - Team-member scope: active team memberships (non-captain) for visibility.
 */
export async function getAccessContext(user: CurrentUser): Promise<AccessContext> {
  const isLeagueAdmin = user.role === "super_admin"
  const permissions = isLeagueAdmin ? new Set<Permission>(PERMISSIONS) : new Set<Permission>()

  const email = user.email.trim().toLowerCase()

  // --- Clubs: email-matched (auto only) ---
  const autoClubs = email
    ? await db
        .select({ id: clubs.id, name: clubs.name })
        .from(clubs)
        .where(
          sql`lower(${clubs.contactEmail}) = ${email} OR lower(${clubs.contactEmail2}) = ${email}`,
        )
    : []
  const clubAssignments: ClubAssignment[] = autoClubs.map((c) => ({ clubId: c.id, clubName: c.name, auto: true }))
  const clubIds = [...new Set(clubAssignments.map((c) => c.clubId))]

  if (clubIds.length > 0 && !isLeagueAdmin) {
    permissions.add("club_management")
    permissions.add("fixture_management")
    permissions.add("team_management")
    permissions.add("captain_hub")
  }

  // --- Teams: owner-email / co-owner-email (auto) ---
  const autoOwnerTeams = email
    ? await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(sql`lower(${teams.ownerEmail}) = ${email}`)
    : []
  const autoCoOwnerTeams = email
    ? await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(sql`lower(${teams.coOwnerEmail}) = ${email}`)
    : []
  const memberships = await db
    .select({ teamId: teams.id, teamName: teams.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.playerId, user.id), eq(teamMembers.status, "active")))

  const teamSourceMap = new Map<number, { name: string; source: TeamAssignment["source"] }>()
  const ownerTeamIds = new Set<number>()
  const captainTeamIds = new Set<number>()
  const memberTeamIds = new Set<number>()

  for (const t of autoOwnerTeams) {
    teamSourceMap.set(t.id, { name: t.name, source: "owner" })
    ownerTeamIds.add(t.id)
  }
  for (const t of autoCoOwnerTeams) {
    if (!teamSourceMap.has(t.id)) teamSourceMap.set(t.id, { name: t.name, source: "owner" })
    ownerTeamIds.add(t.id)
  }
  for (const m of memberships) {
    const source: TeamAssignment["source"] = m.role === "captain" ? "captain" : "member"
    if (!teamSourceMap.has(m.teamId)) teamSourceMap.set(m.teamId, { name: m.teamName, source })
    if (source === "captain") captainTeamIds.add(m.teamId)
    else memberTeamIds.add(m.teamId)
  }

  if ((ownerTeamIds.size > 0 || captainTeamIds.size > 0) && !isLeagueAdmin) {
    permissions.add("captain_hub")
    permissions.add("team_management")
    permissions.add("fixture_management")
  }

  // Teams homed at a managed club are manageable by that club owner.
  const clubTeamIds = new Set<number>()
  if (clubIds.length) {
    const clubTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArrayInts(teams.homeClubId, clubIds))
    for (const t of clubTeams) {
      clubTeamIds.add(t.id)
      if (!teamSourceMap.has(t.id)) teamSourceMap.set(t.id, { name: t.name, source: "club" })
    }
  }

  const teamAssignments: TeamAssignment[] = [...teamSourceMap.entries()].map(([id, info]) => ({
    teamId: id,
    teamName: info.name,
    source: info.source,
  }))

  const ownedTeamIds = [...new Set([...ownerTeamIds, ...captainTeamIds])]
  const manageableTeamIds = [...new Set([...ownedTeamIds, ...clubTeamIds])]
  const teamIds = [...new Set([...manageableTeamIds, ...memberTeamIds])]

  return {
    user,
    permissions,
    clubIds,
    clubAssignments,
    teamIds,
    teamAssignments,
    manageableTeamIds,
    ownedTeamIds,
    isLeagueAdmin,
    can: (permission: Permission) => permissions.has(permission),
    canManageClub: (clubId: number) => isLeagueAdmin || clubIds.includes(clubId),
    canManageTeam: (teamId: number) => isLeagueAdmin || manageableTeamIds.includes(teamId),
  }
}

// Local helper that wraps drizzle's inArray. Callers guard for non-empty arrays
// since an empty array generates invalid SQL.
function inArrayInts(column: Parameters<typeof inArray>[0], ids: number[]) {
  return inArray(column, ids)
}

/**
 * Resolve the access context for the currently signed-in user, redirecting to
 * sign-in when there is no session. Convenience wrapper for pages/actions.
 */
export async function requireAccessContext(): Promise<AccessContext> {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  return getAccessContext(user)
}

/**
 * Page guard: ensures the signed-in user holds `permission`, else redirects to
 * the dashboard. Returns the resolved access context for further scoping.
 */
export async function requirePermissionPage(permission: Permission): Promise<AccessContext> {
  const ctx = await requireAccessContext()
  if (!ctx.can(permission)) redirect("/dashboard")
  return ctx
}

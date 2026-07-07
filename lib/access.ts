import "server-only"
import { db } from "@/lib/db"
import { userMeta, clubs, teams } from "@/lib/db/schema"
import { eq, sql, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getCurrentUser, type CurrentUser } from "@/lib/session"
import { getEffectivePermissions, type Permission } from "@/lib/permissions"

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
   * "owner" (email match), "captain", "club" (team homed at a managed club), or
   * "manual". owner/captain/club are auto (cannot be removed manually).
   */
  source: "owner" | "captain" | "club" | "manual"
}

export type AccessContext = {
  user: CurrentUser
  permissions: Set<Permission>
  /** Effective club ids this user may manage. */
  clubIds: number[]
  clubAssignments: ClubAssignment[]
  /** Effective team ids this user may manage. */
  teamIds: number[]
  teamAssignments: TeamAssignment[]
  /** True when the user has full league access (sees everything). */
  isLeagueAdmin: boolean
  can(permission: Permission): boolean
  canManageClub(clubId: number): boolean
  canManageTeam(teamId: number): boolean
}

type OverrideShape = { add: number[]; remove: number[] }

function normaliseOverride(value: unknown): OverrideShape {
  const v = (value ?? {}) as Partial<OverrideShape>
  const toInts = (arr: unknown) =>
    Array.isArray(arr) ? arr.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : []
  return { add: toInts(v.add), remove: toInts(v.remove) }
}

/**
 * Resolves the full access context for a user: effective permissions, assigned
 * clubs and teams (email-matched + manual overrides), and convenience guards.
 *
 * Assignment rules (per the SAPL brief):
 *  - Clubs: clubs whose contactEmail == user email (auto) ∪ manual adds − manual removes.
 *  - Teams: teams whose ownerEmail == user email (auto) ∪ teams the user captains
 *    (auto) ∪ manual adds − manual removes.
 *  - League admins / super admins are unrestricted (clubIds/teamIds still computed
 *    for display, but isLeagueAdmin short-circuits the can* guards to allow all).
 */
export async function getAccessContext(user: CurrentUser): Promise<AccessContext> {
  const [meta] = await db
    .select({
      permissions: userMeta.permissions,
      clubOverrides: userMeta.clubOverrides,
      teamOverrides: userMeta.teamOverrides,
    })
    .from(userMeta)
    .where(eq(userMeta.userId, user.id))
    .limit(1)

  const permissions = getEffectivePermissions(user.role, meta?.permissions ?? null)
  const isLeagueAdmin = permissions.has("league_management")

  const email = user.email.trim().toLowerCase()
  const clubOverrides = normaliseOverride(meta?.clubOverrides)
  const teamOverrides = normaliseOverride(meta?.teamOverrides)

  // --- Clubs: email-matched (auto) + manual overrides ---
  const autoClubs = email
    ? await db
        .select({ id: clubs.id, name: clubs.name })
        .from(clubs)
        .where(
          sql`lower(${clubs.contactEmail}) = ${email} OR lower(${clubs.contactEmail2}) = ${email}`,
        )
    : []
  const autoClubIds = new Set(autoClubs.map((c) => c.id))

  const manualAddClubIds = clubOverrides.add.filter((id) => !autoClubIds.has(id))
  const manualClubs = manualAddClubIds.length
    ? await db
        .select({ id: clubs.id, name: clubs.name })
        .from(clubs)
        .where(inArrayInts(clubs.id, manualAddClubIds))
    : []

  const removeClubSet = new Set(clubOverrides.remove)
  const clubAssignments: ClubAssignment[] = [
    ...autoClubs.map((c) => ({ clubId: c.id, clubName: c.name, auto: true })),
    ...manualClubs.map((c) => ({ clubId: c.id, clubName: c.name, auto: false })),
  ].filter((c) => c.auto || !removeClubSet.has(c.clubId)) // manual removals only affect manual/non-auto
  const clubIds = [...new Set(clubAssignments.map((c) => c.clubId))]

  // Being assigned a club — via the club's contact email (auto) or a manual
  // assignment — makes the user a club manager for that venue, but ONLY when
  // their role is captain or above. Plain players should never receive
  // management permissions, even if their email coincidentally matches a
  // club's contact address.
  const isElevatedRole = ["captain", "org_admin", "super_admin"].includes(user.role)
  if (clubIds.length > 0 && !isLeagueAdmin && isElevatedRole) {
    permissions.add("club_management")
    permissions.add("fixture_management")
    // Player Management is league admin only — removed from club managers, captains, and team owners
    permissions.add("team_management")
    permissions.add("captain_hub")
  }

  // --- Teams: owner-email (auto) + captaincy (auto) + manual overrides ---
  const autoOwnerTeams = email
    ? await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(sql`lower(${teams.ownerEmail}) = ${email}`)
    : []
  const captainTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.captainUserId, user.id))

  const teamSourceMap = new Map<number, { name: string; source: TeamAssignment["source"] }>()
  for (const t of autoOwnerTeams) teamSourceMap.set(t.id, { name: t.name, source: "owner" })
  for (const t of captainTeams) if (!teamSourceMap.has(t.id)) teamSourceMap.set(t.id, { name: t.name, source: "captain" })

  // Teams homed at a club this user manages (via the club's contact email or a
  // manual club assignment) are also in their scope. This gives club managers
  // the Captain Hub — and all other team-scoped management — for every team
  // that plays out of their venue, without a separate per-team assignment.
  if (clubIds.length) {
    const clubTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArrayInts(teams.homeClubId, clubIds))
    for (const t of clubTeams) if (!teamSourceMap.has(t.id)) teamSourceMap.set(t.id, { name: t.name, source: "club" })
  }

  const manualAddTeamIds = teamOverrides.add.filter((id) => !teamSourceMap.has(id))
  if (manualAddTeamIds.length) {
    const manualTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArrayInts(teams.id, manualAddTeamIds))
    for (const t of manualTeams) teamSourceMap.set(t.id, { name: t.name, source: "manual" })
  }

  const removeTeamSet = new Set(teamOverrides.remove)
  const teamAssignments: TeamAssignment[] = [...teamSourceMap.entries()]
    .filter(([id, info]) => info.source !== "manual" || !removeTeamSet.has(id))
    .map(([id, info]) => ({ teamId: id, teamName: info.name, source: info.source }))
  const teamIds = teamAssignments.map((t) => t.teamId)

  return {
    user,
    permissions,
    clubIds,
    clubAssignments,
    teamIds,
    teamAssignments,
    isLeagueAdmin,
    can: (permission: Permission) => permissions.has(permission),
    canManageClub: (clubId: number) => isLeagueAdmin || clubIds.includes(clubId),
    canManageTeam: (teamId: number) => isLeagueAdmin || teamIds.includes(teamId),
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

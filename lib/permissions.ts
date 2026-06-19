import type { Role } from "@/lib/session"

/**
 * Granular permission keys. These sit ON TOP of the existing role system — a
 * role implies a set of default permissions, and a per-user override list (when
 * present) replaces those defaults entirely.
 */
export const PERMISSIONS = [
  "league_management",
  "club_management",
  "team_management",
  "player_management",
  "billing_management",
  "fixture_management",
  "captain_hub",
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Human labels for the Members & Roles UI. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  league_management: "League Management",
  club_management: "Club Management",
  team_management: "Team Management",
  player_management: "Player Management",
  billing_management: "Billing Management",
  fixture_management: "Fixture Management",
  captain_hub: "Captain Hub",
}

/** Short descriptions shown beside each checkbox. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  league_management: "Full league administration — seasons, regions, divisions and members.",
  club_management: "Manage assigned clubs and their venues.",
  team_management: "Manage assigned teams and rosters.",
  player_management: "View and edit players within scope.",
  billing_management: "View and manage entry fees and payments.",
  fixture_management: "Manage fixtures for assigned teams.",
  captain_hub: "Access the Captain Hub for teams they captain or own.",
}

/**
 * Default permissions for each role, exactly per the SAPL brief.
 * - player: none (Overview/League Centre/Profile are always available)
 * - captain: fixture, captain_hub (player_management removed — super admin only)
 * - org_admin (Club Admin): club, team, fixture, captain_hub (player_management removed — super admin only)
 * - super_admin: everything
 */
export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  player: [],
  captain: ["fixture_management", "captain_hub"],
  org_admin: [
    "club_management",
    "team_management",
    "fixture_management",
    "captain_hub",
  ],
  super_admin: [...PERMISSIONS],
}

/**
 * Permissions automatically granted to a self-service Team Owner — someone who
 * created their own team from the dashboard. This mirrors a club admin's powers
 * minus club_management, league_management, and player_management, scoped (by the access layer) to
 * the teams they own. Granted on team creation and revoked when they own none.
 */
export const TEAM_OWNER_PERMISSIONS: Permission[] = [
  "team_management",
  "fixture_management",
  "captain_hub",
]

/** True when `values` is exactly the auto-granted Team Owner permission set. */
export function isTeamOwnerGrant(values: string[] | null | undefined): boolean {
  if (!values) return false
  const set = new Set(sanitizePermissions(values))
  return set.size === TEAM_OWNER_PERMISSIONS.length && TEAM_OWNER_PERMISSIONS.every((p) => set.has(p))
}

/** Type guard for unknown string arrays coming from the DB / forms. */
export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

export function sanitizePermissions(values: string[] | null | undefined): Permission[] {
  if (!values) return []
  return [...new Set(values.filter(isPermission))]
}

/**
 * Resolve the effective permission set for a user.
 * @param role               The user's effective role (acting role when impersonating).
 * @param permissionsOverride The stored override list, or null to use role defaults.
 *
 * super_admin always receives every permission regardless of overrides — a stored
 * captain assignment must never be able to downgrade an admin's access.
 */
export function getEffectivePermissions(
  role: Role,
  permissionsOverride: string[] | null | undefined,
): Set<Permission> {
  if (role === "super_admin") return new Set(PERMISSIONS)
  if (permissionsOverride == null) return new Set(ROLE_DEFAULTS[role] ?? [])
  return new Set(sanitizePermissions(permissionsOverride))
}

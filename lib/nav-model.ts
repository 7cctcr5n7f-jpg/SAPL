import type { CurrentUser } from "@/lib/session"
import type { AccessContext } from "@/lib/access"

/**
 * Stable icon keys shared between the server (which builds the nav model) and
 * the client bottom-nav (which maps keys -> lucide components). We pass strings,
 * never component references, so the model stays serialisable across the
 * server/client boundary.
 */
export type NavIcon =
  | "home"
  | "overview"
  | "league"
  | "clubs"
  | "rankings"
  | "alerts"
  | "captain"
  | "team"
  | "club"
  | "admin"
  | "profile"
  | "rules"
  | "marketplace"
  | "sponsors"
  | "faq"
  | "contact"
  | "seasons"
  | "fixtures"
  | "members"
  | "payments"
  | "settings"
  | "login"
  | "register"
  | "logout"
  | "more"

export type NavItem = {
  label: string
  icon: NavIcon
  /** Destination for a link item. Omitted for action items (e.g. logout). */
  href?: string
  /** Action items trigger client behaviour instead of navigating. */
  action?: "logout"
}

export type NavModel = {
  authed: boolean
  /** Primary tabs rendered directly on the bar (a "More" cell is appended by the UI). */
  primary: NavItem[]
  /** Items revealed inside the "More" bottom sheet. */
  more: NavItem[]
}

// --- Shared destinations -------------------------------------------------
// Player-facing
const HOME: NavItem = { label: "Home", icon: "home", href: "/dashboard" }
const LEAGUE_CENTRE: NavItem = { label: "League Centre", icon: "league", href: "/league-centre" }
const MY_TEAM: NavItem = { label: "My Team", icon: "team", href: "/dashboard/my-team" }
const SETTINGS: NavItem = { label: "Settings", icon: "settings", href: "/dashboard/profile" }

// Public marketing
const PUBLIC_HOME: NavItem = { label: "Home", icon: "home", href: "/" }
const CLUBS: NavItem = { label: "Clubs", icon: "clubs", href: "/clubs" }
const MARKETPLACE: NavItem = { label: "Marketplace", icon: "marketplace", href: "/marketplace" }
const LEAGUE_FORMAT: NavItem = { label: "League Format", icon: "rules", href: "/rules" }
const SPONSORS: NavItem = { label: "Sponsors", icon: "sponsors", href: "/sponsors" }

// Admin
const ADMIN_DASHBOARD: NavItem = { label: "Dashboard", icon: "admin", href: "/admin" }
const ADMIN_SEASONS: NavItem = { label: "Seasons", icon: "seasons", href: "/admin?tab=seasons" }
const ADMIN_FIXTURES: NavItem = { label: "Fixtures", icon: "fixtures", href: "/admin/fixtures" }
const ADMIN_TEAMS: NavItem = { label: "All Teams", icon: "team", href: "/admin/teams" }
const ADMIN_CLUBS: NavItem = { label: "Clubs", icon: "club", href: "/admin/clubs" }
const ADMIN_MEMBERS: NavItem = { label: "Members", icon: "members", href: "/admin/members" }
const ADMIN_PAYMENTS: NavItem = { label: "Payments", icon: "payments", href: "/admin/billing" }

const LOGOUT: NavItem = { label: "Logout", icon: "logout", action: "logout" }

/** Remove duplicate destinations. */
function dedupe(items: NavItem[]): NavItem[] {
  const seen = new Set<string>()
  return items.filter((i) => {
    const key = i.href ?? i.action ?? i.label
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Build the role-aware bottom-navigation model. Public (logged-out) visitors get
 * the marketing nav; signed-in users get a nav derived from their effective
 * permissions so it follows them across public, dashboard and admin sections.
 */
export function buildNavModel(user: CurrentUser | null, access: AccessContext | null): NavModel {
  // --- Public (not logged in) ---
  if (!user || !access) {
    return {
      authed: false,
      primary: [PUBLIC_HOME, LEAGUE_CENTRE, CLUBS, MARKETPLACE],
      more: [LEAGUE_FORMAT, SPONSORS],
    }
  }

  const isLeagueAdmin = access.permissions.has("league_management")

  // --- League / super admin: competition management ---
  if (isLeagueAdmin) {
    return {
      authed: true,
      primary: [ADMIN_DASHBOARD, LEAGUE_CENTRE, ADMIN_FIXTURES, ADMIN_MEMBERS],
      more: dedupe([
        ADMIN_SEASONS,
        ADMIN_TEAMS,
        ADMIN_CLUBS,
        ADMIN_PAYMENTS,
        SPONSORS,
        SETTINGS,
        LOGOUT,
      ]),
    }
  }

  // --- Player / team owner / captain ---
  // Team owners and captains (anyone with at least one managed team) get a
  // "My Team" shortcut on the bar. Plain players just get Home + League Centre.
  const hasTeam = access.teamIds.length > 0

  const playerPrimary: NavItem[] = hasTeam
    ? [HOME, LEAGUE_CENTRE, MY_TEAM]
    : [HOME, LEAGUE_CENTRE]

  return {
    authed: true,
    primary: playerPrimary,
    more: dedupe([
      ...(hasTeam ? [] : [MY_TEAM]),   // expose My Team in More for plain players
      MARKETPLACE,
      LEAGUE_FORMAT,
      SPONSORS,
      SETTINGS,
      LOGOUT,
    ]),
  }
}

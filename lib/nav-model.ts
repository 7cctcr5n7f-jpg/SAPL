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
const OVERVIEW: NavItem = { label: "Overview", icon: "overview", href: "/dashboard" }
const LEAGUE_CENTRE: NavItem = { label: "League Centre", icon: "league", href: "/league-centre" }
const RANKINGS: NavItem = { label: "Rankings", icon: "rankings", href: "/rankings" }
const ALERTS: NavItem = { label: "Alerts", icon: "alerts", href: "/dashboard/notifications" }
const CAPTAIN_HUB: NavItem = { label: "Captain Hub", icon: "captain", href: "/dashboard/captain" }
const TEAM_MGMT: NavItem = { label: "Team Management", icon: "team", href: "/dashboard/org" }
const CLUB_MGMT: NavItem = { label: "Club Management", icon: "club", href: "/admin/clubs" }
const PROFILE: NavItem = { label: "Profile", icon: "profile", href: "/dashboard/profile" }
const RULES: NavItem = { label: "Rules", icon: "rules", href: "/rules" }
const MARKETPLACE: NavItem = { label: "Marketplace", icon: "marketplace", href: "/marketplace" }
const SPONSORS: NavItem = { label: "Sponsors", icon: "sponsors", href: "/sponsors" }
const LOGOUT: NavItem = { label: "Logout", icon: "logout", action: "logout" }

/** Remove duplicate destinations (the brief lists Rankings twice for some roles). */
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
      primary: [
        { label: "Home", icon: "home", href: "/" },
        LEAGUE_CENTRE,
        { label: "Clubs", icon: "clubs", href: "/clubs" },
        RANKINGS,
      ],
      more: [
        RULES,
        MARKETPLACE,
        SPONSORS,
        { label: "FAQ", icon: "faq", href: "/faq" },
        { label: "Contact", icon: "contact", href: "/contact" },
      ],
    }
  }

  const isLeagueAdmin = access.permissions.has("league_management")
  const hasClubMgmt = access.permissions.has("club_management")
  const hasTeamMgmt = access.permissions.has("team_management")
  const canCaptain = access.canCaptainHub

  // --- League / super admin: full management reach ---
  if (isLeagueAdmin) {
    return {
      authed: true,
      primary: [OVERVIEW, LEAGUE_CENTRE, { label: "League", icon: "admin", href: "/admin" }, ALERTS],
      more: dedupe([
        { label: "Players", icon: "team", href: "/admin/players" },
        CLUB_MGMT,
        { label: "Members", icon: "profile", href: "/admin/members" },
        { label: "Fixtures", icon: "captain", href: "/dashboard/fixtures" },
        { label: "Communications", icon: "alerts", href: "/admin/broadcasts" },
        SPONSORS,
        RANKINGS,
        RULES,
        MARKETPLACE,
        PROFILE,
        LOGOUT,
      ]),
    }
  }

  // --- Club / venue owner ---
  if (hasClubMgmt) {
    const primary = [OVERVIEW, LEAGUE_CENTRE, CLUB_MGMT]
    // If they also own/manage a team, surface Team Management in the bar.
    if (hasTeamMgmt) primary.push(TEAM_MGMT)
    primary.push(ALERTS)
    return {
      authed: true,
      primary,
      more: dedupe([PROFILE, RANKINGS, MARKETPLACE, RULES, ...(hasTeamMgmt ? [] : [TEAM_MGMT]), LOGOUT]),
    }
  }

  // --- Team owner ---
  if (hasTeamMgmt) {
    return {
      authed: true,
      primary: [OVERVIEW, LEAGUE_CENTRE, CAPTAIN_HUB, TEAM_MGMT, ALERTS],
      more: dedupe([PROFILE, RANKINGS, MARKETPLACE, RULES, LOGOUT]),
    }
  }

  // --- Captain ---
  if (canCaptain) {
    return {
      authed: true,
      primary: [OVERVIEW, LEAGUE_CENTRE, CAPTAIN_HUB, ALERTS],
      more: dedupe([PROFILE, RANKINGS, RULES, MARKETPLACE, LOGOUT]),
    }
  }

  // --- Player (default) ---
  return {
    authed: true,
    primary: [OVERVIEW, LEAGUE_CENTRE, RANKINGS, ALERTS],
    more: dedupe([
      { label: "Player Profile", icon: "profile", href: "/dashboard/profile" },
      RULES,
      MARKETPLACE,
      RANKINGS,
      LOGOUT,
    ]),
  }
}

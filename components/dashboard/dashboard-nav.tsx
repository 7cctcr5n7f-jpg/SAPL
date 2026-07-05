"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { RoleSwitcher } from "@/components/dashboard/role-switcher"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Users,
  Trophy,
  ClipboardList,
  Building2,
  CreditCard,
  Megaphone,
  ShieldCheck,
  Swords,
  CalendarDays,
  LogOut,
  Store,
  UserCog,
  Warehouse,
  FlaskConical,
} from "lucide-react"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const ICONS = {
  dashboard: LayoutDashboard,
  profile: User,
  roster: Users,
  rankings: Trophy,
  results: ClipboardList,
  org: Building2,
  payments: CreditCard,
  announce: Megaphone,
  admin: ShieldCheck,
  fixtures: CalendarDays,
  playoffs: Swords,
  marketplace: Store,
  members: UserCog,
  sponsors: Trophy,
  venues: Warehouse,
  demo: FlaskConical,
} as const

export function DashboardNav({
  role,
  name,
  email,
  isSuperAdmin = false,
  actingRole = null,
  permissions,
  canCaptainHub = false,
  canManageMembers = false,
}: {
  role: string
  name: string
  email: string
  isSuperAdmin?: boolean
  actingRole?: string | null
  /** Effective granular permissions for the current (possibly impersonated) view. */
  permissions: string[]
  /** Captain Hub is only shown when the user captains or owns a team. */
  canCaptainHub?: boolean
  /** Members & Roles is gated by league_management (and not while previewing). */
  canManageMembers?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()

  const has = (p: string) => permissions.includes(p)
  const isLeagueAdmin = has("league_management")

  let items: NavItem[]

  if (isLeagueAdmin) {
    // --- League Admin: competition management ---
    items = [
      { href: "/admin", label: "Dashboard", icon: ICONS.admin },
      { href: "/admin?tab=seasons", label: "Seasons", icon: ICONS.rankings },
      { href: "/admin/fixtures", label: "Fixtures", icon: ICONS.fixtures },
      { href: "/admin?tab=placement", label: "Teams", icon: ICONS.roster },
      { href: "/admin/clubs", label: "Clubs", icon: ICONS.venues },
      { href: "/admin/members", label: "Members", icon: ICONS.members },
      { href: "/admin/billing", label: "Payments", icon: ICONS.payments },
      { href: "/dashboard/league-centre", label: "League Centre", icon: ICONS.results },
      { href: "/admin/broadcasts", label: "Communications", icon: ICONS.announce },
      { href: "/admin/sponsors", label: "Sponsors", icon: ICONS.sponsors },
    ]
    // Demo Controls only appear in the Demo Environment deployment.
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      items.push({ href: "/admin/demo", label: "Demo Controls", icon: ICONS.demo })
    }
  } else {
    // --- Player / team owner (unified simple menu) ---
    items = [
      { href: "/dashboard", label: "Home", icon: ICONS.dashboard },
      { href: "/dashboard/league-centre", label: "League Centre", icon: ICONS.rankings },
      { href: "/dashboard/org", label: "My Team", icon: ICONS.org },
      { href: "/dashboard/profile", label: "Settings", icon: ICONS.profile },
    ]
  }

  async function signOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo />
      </div>

      <div className="border-b border-sidebar-border px-5 py-4">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
        <span className="mt-2 inline-block rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          {(isSuperAdmin && !actingRole ? "main admin" : role.replace("_", " "))}
        </span>
        {isSuperAdmin && actingRole ? (
          <span className="ml-1.5 inline-block rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            preview
          </span>
        ) : null}
      </div>

      {isSuperAdmin ? (
        <div className="border-b border-sidebar-border px-3 py-3">
          <RoleSwitcher actingRole={actingRole} />
        </div>
      ) : null}

      {/* Active = the single nav item whose href best (longest) matches the path,
          so /admin/clubs highlights "Venues" only, not "League Control" (/admin). */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const matches = items
            .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
            .map((i) => i.href)
          const bestMatch = matches.sort((a, b) => b.length - a.length)[0]
          const active = item.href === bestMatch
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

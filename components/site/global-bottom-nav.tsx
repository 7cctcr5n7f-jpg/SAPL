"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { RoleSwitcher } from "@/components/dashboard/role-switcher"
import type { NavIcon, NavItem, NavModel } from "@/lib/nav-model"
import {
  Home,
  LayoutDashboard,
  Trophy,
  Building2,
  ListOrdered,
  Bell,
  ClipboardList,
  Users,
  Warehouse,
  ShieldCheck,
  UserCog,
  ScrollText,
  Store,
  HandshakeIcon,
  HelpCircle,
  Mail,
  CalendarRange,
  CalendarDays,
  CreditCard,
  Settings,
  LogIn,
  UserPlus,
  LogOut,
  MoreHorizontal,
} from "lucide-react"

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: Home,
  overview: LayoutDashboard,
  league: Trophy,
  clubs: Building2,
  rankings: ListOrdered,
  alerts: Bell,
  captain: ClipboardList,
  team: Users,
  club: Warehouse,
  admin: ShieldCheck,
  profile: UserCog,
  rules: ScrollText,
  marketplace: Store,
  sponsors: HandshakeIcon,
  faq: HelpCircle,
  contact: Mail,
  seasons: CalendarRange,
  fixtures: CalendarDays,
  members: UserCog,
  payments: CreditCard,
  settings: Settings,
  login: LogIn,
  register: UserPlus,
  logout: LogOut,
  more: MoreHorizontal,
}

export type NavUser = {
  name: string
  email: string
  role: string
  isSuperAdmin: boolean
  actingRole: string | null
}

// Routes where the bottom nav should never appear (auth + onboarding flows).
const HIDDEN_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/onboarding"]

export function GlobalBottomNav({ model, user }: { model: NavModel; user: NavUser | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null

  const allLinks = [...model.primary, ...model.more].filter((i) => i.href)

  const isActive = (href?: string) => {
    if (!href) return false
    if (href === "/") return pathname === "/"
    // Pick the most specific matching link so parent routes don't stay highlighted.
    const matches = allLinks
      .filter((i) => i.href && (pathname === i.href || pathname.startsWith(i.href + "/")))
      .map((i) => i.href as string)
    const best = matches.sort((a, b) => b.length - a.length)[0]
    return href === best
  }

  async function handleLogout() {
    setOpen(false)
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  function renderCell(item: NavItem) {
    const Icon = ICONS[item.icon]
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href as string}
        className={cn(
          "flex min-w-0 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="w-full truncate px-0.5 text-center">{item.label}</span>
      </Link>
    )
  }

  const moreActive = model.more.some((i) => isActive(i.href))

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div
        className="grid items-stretch"
        style={{ gridTemplateColumns: `repeat(${model.primary.length + 1}, minmax(0, 1fr))` }}
      >
        {model.primary.map(renderCell)}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
            aria-label="More navigation"
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="w-full truncate px-0.5 text-center">More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle className="heading text-lg">Menu</SheetTitle>
            </SheetHeader>

            {user ? (
              <div className="mt-1 px-4">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <span className="mt-2 inline-block rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  {user.isSuperAdmin && !user.actingRole ? "main admin" : user.role.replace("_", " ")}
                </span>
                {user.isSuperAdmin && user.actingRole ? (
                  <span className="ml-1.5 inline-block rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    preview
                  </span>
                ) : null}
              </div>
            ) : null}

            {user?.isSuperAdmin ? (
              <div className="mt-3 px-4">
                <RoleSwitcher actingRole={user.actingRole} />
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-3 gap-2 px-4 pb-2">
              {model.more
                .filter((i) => i.href)
                .map((item) => {
                  const Icon = ICONS[item.icon]
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href as string}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-md border border-border px-2 py-3 text-center text-xs font-medium transition-colors",
                        active
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="leading-tight">{item.label}</span>
                    </Link>
                  )
                })}
            </div>

            {model.authed ? (
              <div className="mt-2 border-t border-border px-4 pb-2 pt-3">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="mt-4 flex gap-2 border-t border-border px-4 pb-2 pt-4">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4" />
                  Join League
                </Link>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}

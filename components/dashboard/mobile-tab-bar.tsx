"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { RoleSwitcher } from "@/components/dashboard/role-switcher"
import {
  LayoutDashboard,
  Users,
  Trophy,
  ClipboardList,
  Building2,
  Bell,
  CreditCard,
  Megaphone,
  ShieldCheck,
  CalendarDays,
  LogOut,
  UserCog,
  Warehouse,
  MoreHorizontal,
} from "lucide-react"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

export function MobileTabBar({
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
  permissions: string[]
  canCaptainHub?: boolean
  canManageMembers?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const has = (p: string) => permissions.includes(p)

  // Build the full set of available destinations (same logic as the sidebar).
  const all: NavItem[] = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }]
  all.push({ href: "/league-centre", label: "League Centre", icon: Trophy })
  if (canCaptainHub) all.push({ href: "/dashboard/captain", label: "Captain Hub", icon: ClipboardList })
  if (has("fixture_management")) all.push({ href: "/dashboard/fixtures", label: "Fixtures", icon: CalendarDays })
  if (has("billing_management")) all.push({ href: "/admin/billing", label: "Billing", icon: CreditCard })
  if (has("player_management")) all.push({ href: "/admin/players", label: "Players", icon: Users })
  if (has("team_management")) all.push({ href: "/dashboard/org", label: "Teams", icon: Building2 })
  if (has("club_management")) all.push({ href: "/admin/clubs", label: "Clubs", icon: Warehouse })
  if (has("league_management")) {
    all.push({ href: "/admin", label: "League", icon: ShieldCheck })
    all.push({ href: "/admin/broadcasts", label: "Comms", icon: Megaphone })
    all.push({ href: "/admin/sponsors", label: "Sponsors", icon: Trophy })
  }
  if (canManageMembers) all.push({ href: "/admin/members", label: "Members", icon: UserCog })
  all.push({ href: "/dashboard/notifications", label: "Alerts", icon: Bell })

  const isActive = (href: string) => {
    const matches = all
      .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
      .map((i) => i.href)
    const best = matches.sort((a, b) => b.length - a.length)[0]
    return href === best
  }

  // Primary tabs shown directly on the bar; the rest go into "More".
  const primary = all.slice(0, 4)
  const overflow = all.slice(4)

  async function signOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="flex items-stretch">
        {primary.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate px-0.5 text-center">{item.label}</span>
            </Link>
          )
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                overflow.some((i) => isActive(i.href)) ? "text-primary" : "text-muted-foreground",
              )}
              aria-label="More navigation"
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="w-full truncate px-0.5 text-center">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle className="heading text-lg">Menu</SheetTitle>
            </SheetHeader>

            <div className="mt-1 px-4">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <span className="mt-2 inline-block rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                {isSuperAdmin && !actingRole ? "main admin" : role.replace("_", " ")}
              </span>
              {isSuperAdmin && actingRole ? (
                <span className="ml-1.5 inline-block rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  preview
                </span>
              ) : null}
            </div>

            {isSuperAdmin ? (
              <div className="mt-3 px-4">
                <RoleSwitcher actingRole={actingRole} />
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-3 gap-2 px-4 pb-2">
              {overflow.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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

            <div className="mt-2 border-t border-border px-4 pb-2 pt-3">
              <button
                onClick={signOut}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}

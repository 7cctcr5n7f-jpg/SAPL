"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Home,
  Trophy,
  Store,
  MoreHorizontal,
  LayoutDashboard,
  Building2,
  HandshakeIcon,
  ScrollText,
  HelpCircle,
  LogIn,
  UserPlus,
} from "lucide-react"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/league-centre", label: "League", icon: Trophy },
  { href: "/marketplace", label: "Market", icon: Store },
]

const MORE: NavItem[] = [
  { href: "/clubs", label: "Clubs", icon: Building2 },
  { href: "/sponsors", label: "Sponsors", icon: HandshakeIcon },
  { href: "/rules", label: "Rules", icon: ScrollText },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
]

export function PublicMobileNav({ authed = false }: { authed?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  // When logged in, surface a Dashboard tab alongside the core public tabs.
  const primary: NavItem[] = authed
    ? [...PRIMARY, { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]
    : PRIMARY

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
                "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          )
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              MORE.some((i) => isActive(i.href)) ? "text-primary" : "text-muted-foreground",
            )}
            aria-label="More navigation"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle className="heading text-lg">Menu</SheetTitle>
            </SheetHeader>

            <div className="mt-3 grid grid-cols-3 gap-2 px-4">
              {MORE.map((item) => {
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

            {!authed ? (
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
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}

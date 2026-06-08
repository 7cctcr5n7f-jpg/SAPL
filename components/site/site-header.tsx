"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/dashboard/user-menu"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"

const NAV = [
  { href: "/league-centre", label: "League Centre" },
  { href: "/rankings", label: "Rankings" },
  { href: "/clubs", label: "Clubs" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/rules", label: "Rules" },
]

type HeaderUser = { name: string; email: string; role: string }

export function SiteHeader({
  user,
  mainSponsorLabel,
}: {
  user?: HeaderUser | null
  mainSponsorLabel?: string | null
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const authed = !!user
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <Logo />
            {mainSponsorLabel ? (
              <span className="-mt-1 pl-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {mainSponsorLabel}
              </span>
            ) : null}
          </div>
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium uppercase tracking-wide transition-colors hover:text-primary",
                  pathname.startsWith(item.href) ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          {authed ? (
            <>
              <Button render={<Link href="/dashboard" />} variant="ghost" size="sm">
                Dashboard
              </Button>
              <UserMenu name={user.name} email={user.email} role={user.role} />
            </>
          ) : (
            <>
              <Button render={<Link href="/sign-in" />} variant="ghost" size="sm">
                Sign In
              </Button>
              <Button render={<Link href="/sign-up" />} size="sm">
                Join League
              </Button>
            </>
          )}
        </div>
        <button className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <nav className="border-t border-border bg-background px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "py-2 text-sm font-medium uppercase tracking-wide",
                  pathname.startsWith(item.href) ? "text-primary" : "text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2">
              {authed ? (
                <>
                  <Button
                    render={<Link href="/dashboard" />}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    Dashboard
                  </Button>
                  <Button
                    render={<Link href="/dashboard/profile" />}
                    size="sm"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    Profile
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    render={<Link href="/sign-in" />}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    Sign In
                  </Button>
                  <Button render={<Link href="/sign-up" />} size="sm" className="flex-1" onClick={() => setOpen(false)}>
                    Join
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  )
}

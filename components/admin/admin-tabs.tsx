"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "seasons", label: "Season Setup", href: "/admin/seasons" },
  { id: "placement", label: "Division Assignment", href: "/admin/placement" },
  { id: "playoffs", label: "Playoffs", href: "/admin/playoffs" },
] as const

export type AdminTabId = (typeof TABS)[number]["id"]

export function AdminTabs() {
  const pathname = usePathname()
  const active = TABS.find((t) => pathname.startsWith(t.href))?.id ?? "seasons"

  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

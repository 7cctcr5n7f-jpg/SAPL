"use client"

import Link from "next/link"
import { FlaskConical } from "lucide-react"

/**
 * Persistent Demo Environment banner.
 *
 * Reads the public demo flag directly (client-safe) so it renders on every
 * page of the demo deployment and never appears in production. It renders a
 * fixed bar plus an in-flow spacer of equal height so it pushes page content
 * down instead of overlapping sticky headers.
 */
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

export function DemoBanner() {
  if (!IS_DEMO) return null

  return (
    <>
      <div className="h-8" aria-hidden />
      <div className="fixed inset-x-0 top-0 z-[60] flex h-8 items-center justify-center gap-2 bg-primary px-3 text-primary-foreground">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
          Demo Environment — sample data only
        </p>
        <Link
          href="/demo"
          className="hidden shrink-0 rounded-sm bg-primary-foreground/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide hover:bg-primary-foreground/25 sm:inline-block"
        >
          View demo logins
        </Link>
      </div>
    </>
  )
}

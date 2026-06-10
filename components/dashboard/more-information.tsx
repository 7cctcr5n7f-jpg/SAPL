"use client"

import { useState } from "react"
import { ChevronDown, Store } from "lucide-react"
import { cn } from "@/lib/utils"

// SECONDARY INFORMATION — collapsed by default so it never dominates the page.
// Houses everything not directly tied to playing the next match.
export function MoreInformation({
  playtomicRating,
  leagueIndex,
  highestLi,
  lookingForTeam,
  eligibleCategories,
}: {
  playtomicRating: number | null
  leagueIndex: number | null
  highestLi: number | null
  lookingForTeam: boolean
  eligibleCategories: string[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">More Information</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-border p-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Playtomic Rating" value={playtomicRating != null ? playtomicRating.toFixed(2) : "—"} />
            <Field label="League Index" value={leagueIndex != null ? leagueIndex.toFixed(2) : "—"} />
            <Field label="Highest LI" value={highestLi != null && highestLi > 0 ? highestLi.toFixed(2) : "—"} />
            <Field label="Marketplace" value={lookingForTeam ? "Listed" : "Not listed"} />
          </dl>

          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Eligible Categories</p>
            {eligibleCategories.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {eligibleCategories.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No eligible categories yet — your League Index determines which categories you can play.
              </p>
            )}
          </div>

          {lookingForTeam ? (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              You are visible on the team marketplace.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-bold tabular-nums">{value}</dd>
    </div>
  )
}

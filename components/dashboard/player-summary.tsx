import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// SECTION 1 — Player Summary. A single, compact bar that answers, at a glance:
// who you play for, division, region, your LI, account standing and fee status.
// Deliberately minimal — no large hero, no marketplace/TPR snapshot.
// ---------------------------------------------------------------------------

export function PlayerSummary({
  firstName,
  leagueIndex,
  team,
  feesPaid,
  playtomicRating,
  eligibleCategories,
}: {
  firstName: string
  leagueIndex: number | null
  team: PlayerOverviewTeam | null
  feesPaid: boolean
  playtomicRating: string | null
  eligibleCategories: string[]
}) {
  const primaryCategory = eligibleCategories?.[0] || null

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background to-background/50 p-6">
      {/* Hero Profile Section */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8 mb-6">
        {/* Profile Photo */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-full border-4 border-primary/20 bg-secondary/20 flex items-center justify-center">
            <div className="text-4xl">👤</div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-foreground truncate">{firstName}</h1>
              {team && (
                <p className="text-sm text-muted-foreground mt-1">
                  {team.teamName}
                  {team.role === "captain" && " • Team Captain"}
                </p>
              )}
            </div>
            {team?.role === "captain" && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary whitespace-nowrap">
                Captain
              </span>
            )}
          </div>
          {team && (
            <p className="text-xs text-muted-foreground">
              {team.divisionName}
              {team.regionName ? ` • ${team.regionName}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 py-4 border-y border-border/40">
        {/* League Index */}
        {leagueIndex != null && (
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">League Index</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{leagueIndex.toFixed(2)}</p>
          </div>
        )}

        {/* Playtomic Rating */}
        {playtomicRating && (
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Playtomic</p>
            <p className="text-sm font-semibold text-foreground">{playtomicRating}</p>
          </div>
        )}

        {/* Eligible Category */}
        {primaryCategory && (
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Category</p>
            <p className="text-sm font-semibold text-foreground">{primaryCategory}</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard/profile"
          className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg border-2 border-primary text-primary font-semibold text-sm hover:bg-primary/5 transition-colors"
        >
          Edit Profile
        </Link>
        {team && (
          <Link
            href={`/teams/${team.teamId}`}
            className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-background font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            View Team
          </Link>
        )}
      </div>
    </section>
  )
}

import Link from "next/link"
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react"
import type { SeasonReadiness } from "@/lib/team-readiness"
import { cn } from "@/lib/utils"

// Compact season-readiness strip for the admin dashboard. Surfaces how many
// teams are League Ready at a glance and links through to the Payments page for
// the full per-team breakdown.
export function SeasonReadinessSummary({ readiness }: { readiness: SeasonReadiness }) {
  const { totalTeams, readyTeams, rosterCompleteTeams, feesSettledTeams, playersOutstanding } = readiness
  const allReady = totalTeams > 0 && readyTeams === totalTeams
  const pct = totalTeams > 0 ? Math.round((readyTeams / totalTeams) * 100) : 0

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {allReady ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Season Readiness</h2>
        </div>
        <Link
          href="/admin/billing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
        >
          Open Payments
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {readyTeams}
            <span className="text-lg font-medium text-muted-foreground">/{totalTeams}</span>
          </p>
          <p className="text-xs text-muted-foreground">Teams League Ready</p>
        </div>
        <ReadinessMetric label="Rosters complete" value={`${rosterCompleteTeams}/${totalTeams}`} />
        <ReadinessMetric label="Fees settled" value={`${feesSettledTeams}/${totalTeams}`} />
        <ReadinessMetric
          label="Players owing fees"
          value={String(playersOutstanding)}
          warn={playersOutstanding > 0}
        />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", allReady ? "bg-primary" : "bg-amber-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  )
}

function ReadinessMetric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className={cn("text-xl font-bold tabular-nums", warn ? "text-amber-500" : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

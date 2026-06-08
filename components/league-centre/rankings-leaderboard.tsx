import Link from "next/link"
import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCRanking } from "@/lib/queries-league-centre"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

function Movement({ tpr, highestTpr }: { tpr: number; highestTpr: number }) {
  // Without week-over-week snapshots we approximate momentum from the gap to a
  // team's peak rating: at peak = climbing, well below = sliding.
  const gap = highestTpr - tpr
  if (gap <= 1)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
        <ArrowUp className="h-3.5 w-3.5" />
      </span>
    )
  if (gap >= 15)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
        <ArrowDown className="h-3.5 w-3.5" />
      </span>
    )
  return (
    <span className="inline-flex items-center text-xs text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
    </span>
  )
}

export function RankingsLeaderboard({ rows }: { rows: LCRanking[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Team rankings will populate once teams are placed and matches begin.
      </p>
    )
  }
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const pos = i + 1
        const podium = pos <= 3
        return (
          <li
            key={r.teamId}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/40 sm:px-4",
              podium && "border-primary/40",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums",
                pos === 1
                  ? "bg-primary text-primary-foreground"
                  : podium
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {pos}
            </span>
            <Crest name={r.teamName} logoUrl={r.teamLogo} size="md" />
            <div className="min-w-0 flex-1">
              <Link href={`/teams/${r.teamId}`} className="truncate text-sm font-semibold hover:text-primary">
                {r.teamName}
              </Link>
              <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                {[r.regionName, r.divisionName].filter(Boolean).join(" · ") || r.orgName}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span className="heading text-xl tabular-nums">{Math.round(r.tpr)}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">TPR</span>
            </div>
            <Movement tpr={r.tpr} highestTpr={r.highestTpr} />
          </li>
        )
      })}
    </ol>
  )
}

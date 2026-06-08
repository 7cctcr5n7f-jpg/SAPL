import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCStanding } from "@/lib/queries-league-centre"

export function StandingsTable({ rows }: { rows: LCStanding[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Standings will appear once results are recorded for this division.
      </p>
    )
  }
  const total = rows.length
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="hidden grid-cols-[2.5rem_1fr_repeat(7,2.5rem)_3.5rem] items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:grid">
        <span className="text-center">#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span className="text-center">SW</span>
        <span className="text-center">SL</span>
        <span className="text-center">Pts</span>
        <span className="text-center" title="Team Power Rating">TPR</span>
      </div>
      <ul>
        {rows.map((r, i) => {
          const pos = r.rank ?? i + 1
          const promo = pos <= 2
          const playoff = pos <= 4 && !promo
          const releg = pos >= total - 1 && total > 4
          return (
            <li
              key={r.teamId}
              className={cn(
                "relative grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[2.5rem_1fr_repeat(7,2.5rem)_3.5rem]",
                promo && "bg-primary/[0.06]",
                releg && "bg-destructive/[0.06]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-0 h-full w-1",
                  promo ? "bg-primary" : playoff ? "bg-foreground/40" : releg ? "bg-destructive" : "bg-transparent",
                )}
              />
              <span className="text-center text-sm font-bold tabular-nums">{pos}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                <Crest name={r.teamName} logoUrl={r.teamLogo ?? r.orgLogo} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.teamName ?? "—"}</p>
                  <p className="truncate text-[11px] text-muted-foreground md:hidden">
                    {r.played}P · {r.wins}W · {r.points}pts
                  </p>
                  {r.orgName ? <p className="hidden truncate text-[11px] text-muted-foreground md:block">{r.orgName}</p> : null}
                </div>
              </div>
              <span className="hidden text-center text-sm tabular-nums md:block">{r.played}</span>
              <span className="hidden text-center text-sm tabular-nums md:block">{r.wins}</span>
              <span className="hidden text-center text-sm tabular-nums md:block">{r.losses}</span>
              <span className="hidden text-center text-sm tabular-nums md:block">{r.setsWon}</span>
              <span className="hidden text-center text-sm tabular-nums md:block">{r.setsLost}</span>
              <span className="hidden text-center text-sm font-bold tabular-nums md:block">{r.points}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-muted-foreground md:text-center">
                {r.tpr != null ? Math.round(r.tpr) : "—"}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Promotion</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-foreground/40" /> Playoff</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Relegation</span>
      </div>
    </div>
  )
}

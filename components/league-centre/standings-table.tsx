import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCStanding } from "@/lib/queries-league-centre"

export function StandingsTable({ rows }: { rows: LCStanding[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Standings will appear once results are recorded for this division.
      </p>
    )
  }
  const total = rows.length
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="hidden grid-cols-[2.5rem_1fr_repeat(9,2.25rem)_3.25rem] items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 md:grid">
        <span className="text-center">#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span className="text-center" title="Sets Won">SW</span>
        <span className="text-center" title="Sets Lost">SL</span>
        <span className="text-center" title="Games For">GF</span>
        <span className="text-center" title="Games Against">GA</span>
        <span className="text-center" title="Points Difference (Games For − Games Against)">+/−</span>
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
                "relative grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0 md:grid-cols-[2.5rem_1fr_repeat(9,2.25rem)_3.25rem] md:px-4",
                promo && "bg-emerald-50/60",
                releg && "bg-red-50/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-0 h-full w-1",
                  promo ? "bg-emerald-500" : playoff ? "bg-slate-300" : releg ? "bg-red-400" : "bg-transparent",
                )}
              />
              <span className="text-center text-sm font-bold tabular-nums text-slate-800">{pos}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                <Crest name={r.teamName} logoUrl={r.teamLogo ?? r.orgLogo} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{r.teamName ?? "—"}</p>
                  <p className="truncate text-[11px] text-slate-500 md:hidden">
                    {r.played}P · {r.wins}W · {r.points}pts
                  </p>
                  {r.orgName ? <p className="hidden truncate text-[11px] text-slate-500 md:block">{r.orgName}</p> : null}
                </div>
              </div>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.played}</span>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.wins}</span>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.losses}</span>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.setsWon}</span>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.setsLost}</span>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.gamesFor}</span>
              <span className="hidden text-center text-sm tabular-nums text-slate-700 md:block">{r.gamesAgainst}</span>
              <span
                className={cn(
                  "hidden text-center text-sm font-semibold tabular-nums md:block",
                  r.pointsDiff > 0 ? "text-emerald-600" : r.pointsDiff < 0 ? "text-red-500" : "text-slate-400",
                )}
              >
                {r.pointsDiff > 0 ? `+${r.pointsDiff}` : r.pointsDiff}
              </span>
              <span className="hidden text-center text-sm font-bold tabular-nums text-slate-900 md:block">{r.points}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-slate-500 md:text-center">
                {r.tpr != null ? Math.round(r.tpr) : "—"}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Promotion</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Playoff</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Relegation</span>
      </div>
    </div>
  )
}

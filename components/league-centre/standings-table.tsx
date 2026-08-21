import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCStanding } from "@/lib/queries-league-centre"

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function StandingsTable({
  rows,
  qualifierByTeamId = new Map<number, "direct" | "wildcard">(),
  qualificationRule,
  showRelegation = false,
}: {
  rows: LCStanding[]
  qualifierByTeamId?: Map<number, "direct" | "wildcard">
  qualificationRule?: string
  showRelegation?: boolean
}) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        No teams have been assigned to this division yet.
      </p>
    )
  }
  const sortedRows = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff
    return a.teamId - b.teamId
  })
  const anyPlayed = rows.some((r) => r.played > 0)
  const total = sortedRows.length
  const hasWildcards = Array.from(qualifierByTeamId.values()).includes("wildcard")
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      {!anyPlayed ? (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          Season has not started yet — standings will update as results are recorded.
        </div>
      ) : qualificationRule ? (
        <div className="border-b border-sky-100 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-800">
          {qualificationRule}
        </div>
      ) : null}
      <div>
        <div className="grid grid-cols-[1.4rem_minmax(6.5rem,1fr)_repeat(7,1.6rem)_2rem] items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-500 md:grid-cols-[2.5rem_minmax(14rem,1fr)_repeat(7,2.5rem)_3.5rem] md:gap-2 md:px-4 md:py-2.5 md:text-[10px] md:tracking-widest">
          <span className="text-center">#</span>
          <span>Team</span>
          <span className="text-center">P</span>
          <span className="text-center">W</span>
          <span className="text-center">D</span>
          <span className="text-center">L</span>
          <span className="text-center" title="Category Matches Won">MW</span>
          <span className="text-center" title="Sets Won">SW</span>
          <span className="text-center" title="Points Difference (Games For − Games Against)">+/−</span>
          <span className="text-center" title="Team points (1 per set won + 1 bonus per category won)">Pts</span>
        </div>
        <ul>
        {sortedRows.map((r, i) => {
          const pos = i + 1
          const qualifier = qualifierByTeamId.get(r.teamId) ?? null
          return (
            <li
              key={r.teamId}
              className={cn(
                "relative grid grid-cols-[1.4rem_minmax(6.5rem,1fr)_repeat(7,1.6rem)_2rem] items-center gap-1 border-b border-slate-50 px-2 py-2.5 last:border-0 md:grid-cols-[2.5rem_minmax(14rem,1fr)_repeat(7,2.5rem)_3.5rem] md:gap-2 md:px-4",
                qualifier && "bg-sky-50/70",
                showRelegation && pos >= total - 1 && total > 4 && "bg-red-50/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-0 h-full w-1",
                  qualifier
                    ? qualifier === "wildcard"
                      ? "bg-violet-500"
                      : "bg-sky-500"
                    : showRelegation && pos >= total - 1 && total > 4
                      ? "bg-red-400"
                      : "bg-transparent",
                )}
              />
              <span className="text-center text-xs font-bold tabular-nums text-slate-800 md:text-sm">{pos}</span>
              <div className="flex min-w-0 items-center gap-1.5 md:gap-2.5">
                <Crest name={r.teamName} logoUrl={r.teamLogo ?? r.venueLogo ?? r.orgLogo} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900 md:text-sm">{r.teamName ?? "—"}</p>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    {r.venueName ? <p className="hidden truncate text-[11px] text-slate-500 md:block">{r.venueName}</p> : null}
                    {qualifier ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide md:px-2 md:text-[10px]",
                          qualifier === "wildcard" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700",
                        )}
                      >
                        <span className="md:hidden">{qualifier === "wildcard" ? "B3" : "PO"}</span>
                        <span className="hidden md:inline">{qualifier === "wildcard" ? "Best 3rd" : "Playoff"}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <span className="text-center text-xs tabular-nums text-slate-700 md:text-sm">{r.played}</span>
              <span className="text-center text-xs tabular-nums text-slate-700 md:text-sm">{r.wins}</span>
              <span className="text-center text-xs tabular-nums text-slate-700 md:text-sm">{r.draws}</span>
              <span className="text-center text-xs tabular-nums text-slate-700 md:text-sm">{r.losses}</span>
              <span className="text-center text-xs tabular-nums text-slate-700 md:text-sm">{r.matchesWon}</span>
              <span className="text-center text-xs tabular-nums text-slate-700 md:text-sm">{r.setsWon}</span>
              <span
                className={cn(
                  "text-center text-xs font-semibold tabular-nums md:text-sm",
                  r.pointsDiff > 0 ? "text-emerald-600" : r.pointsDiff < 0 ? "text-red-500" : "text-slate-400",
                )}
              >
                {r.pointsDiff > 0 ? `+${r.pointsDiff}` : r.pointsDiff}
              </span>
              <span className="text-center text-xs font-bold tabular-nums text-slate-900 md:text-sm">{formatPoints(r.points)}</span>
            </li>
          )
        })}
        </ul>
      </div>
      {anyPlayed && showRelegation && (
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Playoff qualification</span>
          {hasWildcards ? (
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Wildcard qualification</span>
          ) : null}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Relegation</span>
        </div>
      )}
    </div>
  )
}

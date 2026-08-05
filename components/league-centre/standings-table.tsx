import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCStanding } from "@/lib/queries-league-centre"

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
  const anyPlayed = rows.some((r) => r.played > 0)
  const total = rows.length
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
          const qualifier = qualifierByTeamId.get(r.teamId) ?? null
          return (
            <li
              key={r.teamId}
              className={cn(
                "relative grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0 md:grid-cols-[2.5rem_1fr_repeat(9,2.25rem)_3.25rem] md:px-4",
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
              <span className="text-center text-sm font-bold tabular-nums text-slate-800">{pos}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                <Crest name={r.teamName} logoUrl={r.teamLogo ?? r.orgLogo} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{r.teamName ?? "—"}</p>
                  <p className="truncate text-[11px] text-slate-500 md:hidden">
                    {r.played}P · {r.wins}W · {r.points}pts
                  </p>
                  <div className="hidden items-center gap-2 md:flex">
                    {r.orgName ? <p className="truncate text-[11px] text-slate-500">{r.orgName}</p> : null}
                    {qualifier ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          qualifier === "wildcard" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700",
                        )}
                      >
                        {qualifier === "wildcard" ? "Best 3rd in line" : "In playoff places"}
                      </span>
                    ) : null}
                  </div>
                  {qualifier ? (
                    <p className="text-[11px] text-sky-700 md:hidden">
                      {qualifier === "wildcard" ? "Best 3rd in line" : "In playoff places"}
                    </p>
                  ) : null}
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

"use client"

import { useMemo, useState, useTransition } from "react"
import { ExternalLink, MapPin, Clock, Building2, ChevronDown } from "lucide-react"
import { setFixtureCheckerPlayerJoined } from "@/lib/actions/fixture-checker"
import type { FixtureCheckerEntry } from "@/lib/queries-admin"
import { cn } from "@/lib/utils"

type SeasonOption = { id: number; name: string; isCurrent: boolean }

function normalizeOpenUrl(raw: string | null): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (/^playtomic\.io\//i.test(value)) return `https://${value}`
  return null
}

export function FixtureCheckerPanel({
  seasons,
  entriesBySeason,
}: {
  seasons: SeasonOption[]
  entriesBySeason: Record<number, FixtureCheckerEntry[]>
}) {
  const defaultSeasonId = seasons.find((season) => season.isCurrent)?.id ?? seasons[0]?.id ?? 0
  const [seasonId, setSeasonId] = useState<number>(defaultSeasonId)
  const [week, setWeek] = useState<number | "all">("all")
  const [hideCompleted, setHideCompleted] = useState(true)
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({})
  const [localEntries, setLocalEntries] = useState<Record<number, FixtureCheckerEntry[]>>(entriesBySeason)
  const [pending, startTransition] = useTransition()

  const seasonEntries = useMemo(() => localEntries[seasonId] ?? [], [localEntries, seasonId])
  const weeks = useMemo(
    () => [...new Set(seasonEntries.map((entry) => entry.week))].sort((a, b) => a - b),
    [seasonEntries],
  )

  const filtered = useMemo(
    () =>
      seasonEntries.filter((entry) => {
        if (week !== "all" && entry.week !== week) return false
        const expected = entry.players.length
        const joined = entry.players.filter((player) => player.checked).length
        if (hideCompleted && expected > 0 && joined >= expected) return false
        return true
      }),
    [seasonEntries, week, hideCompleted],
  )

  function togglePlayer(entry: FixtureCheckerEntry, playerId: string, joined: boolean) {
    setLocalEntries((previous) => ({
      ...previous,
      [seasonId]: (previous[seasonId] ?? []).map((item) =>
        item.key !== entry.key
          ? item
          : {
              ...item,
              players: item.players.map((player) =>
                player.id === playerId ? { ...player, checked: joined } : player,
              ),
            },
      ),
    }))

    startTransition(async () => {
      const result = await setFixtureCheckerPlayerJoined({
        seasonId,
        fixtureId: entry.fixtureId,
        category: entry.category,
        playerId,
        joined,
      })
      if (!result.ok) {
        setLocalEntries(entriesBySeason)
      }
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Season</label>
          <select
            value={seasonId}
            onChange={(event) => setSeasonId(Number(event.target.value))}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
                {season.isCurrent ? " (Current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Week</label>
          <select
            value={week}
            onChange={(event) => setWeek(event.target.value === "all" ? "all" : Number(event.target.value))}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="all">All weeks</option>
            {weeks.map((weekNumber) => (
              <option key={weekNumber} value={weekNumber}>
                Week {weekNumber}
              </option>
            ))}
          </select>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => setHideCompleted(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Hide completed (4/4)
        </label>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {filtered.length} open entr{filtered.length === 1 ? "y" : "ies"}
        {pending ? " · saving..." : ""}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No open fixture checks for this filter.
          </div>
        ) : (
          filtered.map((entry) => {
            const joined = entry.players.filter((player) => player.checked).length
            const expected = entry.players.length
            const isComplete = expected > 0 && joined >= expected
            const isExpanded = !!expandedCompleted[entry.key]
            const openUrl = normalizeOpenUrl(entry.link)
            const homePlayers = entry.players.filter((player) => player.side === "home")
            const awayPlayers = entry.players.filter((player) => player.side === "away")
            return (
              <div
                key={entry.key}
                className={cn(
                  "rounded-lg border p-2.5",
                  isComplete ? "border-emerald-300 bg-emerald-50/70" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">
                    Week {entry.week} · {entry.homeTeam} vs {entry.awayTeam}
                  </div>
                  <div className="text-[11px] font-semibold text-primary">
                    {joined}/{expected || 0} joined
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {entry.category}
                  </span>
                  {entry.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {entry.venue}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {entry.time ?? entry.timeslot ?? "TBD"}
                    {entry.court ? ` · Court ${entry.court}` : ""}
                  </span>
                  {openUrl ? (
                    <a
                      href={openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Join link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Link missing
                    </span>
                  )}
                  {isComplete && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCompleted((prev) => ({
                          ...prev,
                          [entry.key]: !prev[entry.key],
                        }))
                      }
                      className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 hover:bg-emerald-200"
                    >
                      {isExpanded ? "Collapse" : "Expand"}
                      <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  )}
                </div>

                {(!isComplete || isExpanded) && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {entry.players.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No players assigned yet.</div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Home</div>
                        {homePlayers.map((player) => (
                          <label
                            key={`${entry.key}-${player.id}`}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                              player.checked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border text-foreground",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={player.checked}
                              onChange={(event) => togglePlayer(entry, player.id, event.target.checked)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="font-medium leading-tight">{player.name}</span>
                            {player.invitePending && (
                              <span className="ml-auto rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                                Pending
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Away</div>
                        {awayPlayers.map((player) => (
                          <label
                            key={`${entry.key}-${player.id}`}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                              player.checked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border text-foreground",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={player.checked}
                              onChange={(event) => togglePlayer(entry, player.id, event.target.checked)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="font-medium leading-tight">{player.name}</span>
                            {player.invitePending && (
                              <span className="ml-auto rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                                Pending
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

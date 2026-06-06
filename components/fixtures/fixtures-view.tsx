"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { FixtureRow } from "@/lib/queries"
import { DivisionTag } from "@/components/brand/bits"
import { cn } from "@/lib/utils"
import { MapPin } from "lucide-react"

function fmtDate(d: Date | string | null) {
  if (!d) return "TBD"
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })
}

const ALL_TEAMS = "__all__"

export function FixturesView({ fixtures }: { fixtures: FixtureRow[]; weeks?: number[] }) {
  // Regions present in the schedule.
  const regions = useMemo(() => {
    const seen: string[] = []
    for (const f of fixtures) {
      const r = f.saplRegion ?? "Other"
      if (!seen.includes(r)) seen.push(r)
    }
    return seen.sort()
  }, [fixtures])

  const [region, setRegion] = useState(regions[0])
  const [team, setTeam] = useState<string>(ALL_TEAMS)

  // Fixtures within the active region.
  const regionFixtures = useMemo(
    () => fixtures.filter((f) => (f.saplRegion ?? "Other") === region),
    [fixtures, region],
  )

  // Team options for the active region.
  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of regionFixtures) {
      if (f.homeTeamName) set.add(f.homeTeamName)
      if (f.awayTeamName) set.add(f.awayTeamName)
    }
    return Array.from(set).sort()
  }, [regionFixtures])

  // Apply team filter.
  const filtered = useMemo(
    () =>
      team === ALL_TEAMS
        ? regionFixtures
        : regionFixtures.filter((f) => f.homeTeamName === team || f.awayTeamName === team),
    [regionFixtures, team],
  )

  const weeks = useMemo(
    () => Array.from(new Set(filtered.map((f) => f.week))).sort((a, b) => a - b),
    [filtered],
  )
  const [week, setWeek] = useState<number | null>(null)
  const activeWeek = week !== null && weeks.includes(week) ? week : weeks[0] ?? null
  const shown = useMemo(() => filtered.filter((f) => f.week === activeWeek), [filtered, activeWeek])

  function selectRegion(r: string) {
    setRegion(r)
    setTeam(ALL_TEAMS)
    setWeek(null)
  }

  return (
    <div>
      {/* Region + team filters */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        {regions.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <button
                key={r}
                onClick={() => selectRegion(r)}
                className={cn(
                  "px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors",
                  region === r
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Team</span>
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value)
              setWeek(null)
            }}
            className="border border-border bg-card px-3 py-2 text-sm font-semibold focus:border-primary focus:outline-none"
          >
            <option value={ALL_TEAMS}>All teams</option>
            {teamOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Week tabs */}
      {weeks.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {weeks.map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={cn(
                "px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors",
                w === activeWeek
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Week {w}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {shown.map((f) => {
          const done = f.status === "completed"
          const homeWon = f.winnerTeamId === f.homeTeamId
          return (
            <div key={f.id} className="border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                <span>{f.divisionName ? <DivisionTag name={f.divisionName} /> : null}</span>
                <span>{done ? "Final" : fmtDate(f.matchDate)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link
                  href={`/teams/${f.homeTeamId}`}
                  className={cn("font-semibold hover:text-primary", done && !homeWon && "text-muted-foreground")}
                >
                  {f.homeTeamName}
                </Link>
                {done ? (
                  <span className={cn("heading text-lg tabular-nums", homeWon && "text-primary")}>{f.homePoints}</span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <Link
                  href={`/teams/${f.awayTeamId}`}
                  className={cn("font-semibold hover:text-primary", done && homeWon && "text-muted-foreground")}
                >
                  {f.awayTeamName}
                </Link>
                {done ? (
                  <span className={cn("heading text-lg tabular-nums", !homeWon && "text-primary")}>{f.awayPoints}</span>
                ) : null}
              </div>
              {f.venue ? (
                <div className="mt-3 flex items-center gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {f.venue}
                </div>
              ) : null}
            </div>
          )
        })}
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fixtures match these filters.</p>
        ) : null}
      </div>
    </div>
  )
}

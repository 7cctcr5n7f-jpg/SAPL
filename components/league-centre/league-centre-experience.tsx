"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { MatchRow, MatchList, MatchGroupHeader } from "@/components/league-centre/match-row"
import { StandingsTable } from "@/components/league-centre/standings-table"
import { RankingsLeaderboard } from "@/components/league-centre/rankings-leaderboard"
import type { LeagueCentreData, LCFixture } from "@/lib/queries-league-centre"
import { MapPin, ListOrdered, CalendarDays, Search, Radio, Activity, BarChart3 } from "lucide-react"

type ContentTab = "standings" | "fixtures" | "rankings"

const DIVISION_ORDER = ["Premier", "Championship", "Shield", "Challenge"]

export function LeagueCentreExperience({ data }: { data: LeagueCentreData }) {
  const firstRegion = data.regions[0]?.id ?? null
  const [regionId, setRegionId] = useState<number | null>(firstRegion)
  const regionDivisions = useMemo(
    () =>
      data.divisions
        .filter((d) => d.regionId === regionId)
        .sort((a, b) => DIVISION_ORDER.indexOf(a.name) - DIVISION_ORDER.indexOf(b.name) || a.level - b.level),
    [data.divisions, regionId],
  )
  const [divisionId, setDivisionId] = useState<number | null>(regionDivisions[0]?.id ?? null)
  const [tab, setTab] = useState<ContentTab>("standings")

  // Keep the selected division valid when the region changes.
  function selectRegion(id: number) {
    setRegionId(id)
    const divs = data.divisions
      .filter((d) => d.regionId === id)
      .sort((a, b) => DIVISION_ORDER.indexOf(a.name) - DIVISION_ORDER.indexOf(b.name) || a.level - b.level)
    setDivisionId(divs[0]?.id ?? null)
  }

  const activeDivision = regionDivisions.find((d) => d.id === divisionId) ?? regionDivisions[0] ?? null
  const activeDivisionId = activeDivision?.id ?? null

  const divisionStandings = useMemo(
    () => data.standings.filter((s) => s.divisionId === activeDivisionId),
    [data.standings, activeDivisionId],
  )
  const divisionFixtures = useMemo(
    () => data.fixtures.filter((f) => f.divisionId === activeDivisionId),
    [data.fixtures, activeDivisionId],
  )
  const regionRankings = useMemo(
    () => data.rankings.filter((r) => r.regionId === regionId),
    [data.rankings, regionId],
  )

  if (!data.regions.length) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-16 text-center">
        <h2 className="heading text-2xl">No live regions yet</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Regions appear here as soon as a season goes live. Check back once the schedule has been generated.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* My Matches rail */}
      {data.authed && data.myMatches.length > 0 ? <MyMatches matches={data.myMatches} /> : null}

      {/* Region selector — compact chips */}
      <section>
        <SectionLabel icon={<MapPin className="h-3.5 w-3.5" />} text="Region" />
        <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {data.regions.map((r) => {
            const active = r.id === regionId
            return (
              <button
                key={r.id}
                onClick={() => selectRegion(r.id)}
                className={cn(
                  "flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span className={cn("heading text-sm", active ? "text-foreground" : "text-foreground")}>{r.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground tabular-nums">
                  {r.teamCount} teams &middot; {r.clubCount} clubs
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Division selector */}
      {regionDivisions.length > 0 ? (
        <section>
          <SectionLabel icon={<ListOrdered className="h-3.5 w-3.5" />} text="Division" />
          <div className="-mx-1 mt-2 flex flex-wrap gap-2 px-1">
            {regionDivisions.map((d) => {
              const active = d.id === activeDivisionId
              return (
                <button
                  key={d.id}
                  onClick={() => setDivisionId(d.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {d.name}
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px] tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-secondary",
                    )}
                  >
                    {d.teamCount}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Competition overview tabs */}
      <section>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          <TabButton active={tab === "standings"} onClick={() => setTab("standings")} icon={<ListOrdered className="h-4 w-4" />}>
            Standings
          </TabButton>
          <TabButton active={tab === "fixtures"} onClick={() => setTab("fixtures")} icon={<CalendarDays className="h-4 w-4" />}>
            Fixtures &amp; Results
          </TabButton>
          <TabButton active={tab === "rankings"} onClick={() => setTab("rankings")} icon={<BarChart3 className="h-4 w-4" />}>
            Rankings
          </TabButton>
        </div>

        <div className="mt-4">
          {tab === "standings" ? (
            <StandingsTable rows={divisionStandings} />
          ) : tab === "fixtures" ? (
            <FixturesTimeline fixtures={divisionFixtures} />
          ) : (
            <RankingsLeaderboard rows={regionRankings} />
          )}
        </div>
      </section>
    </div>
  )
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
      {icon}
      {text}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold uppercase tracking-wide transition-colors sm:text-sm",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

function MyMatches({ matches }: { matches: LCFixture[] }) {
  return (
    <section className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        <Radio className="h-3.5 w-3.5" />
        My Upcoming Matches
      </div>
      <MatchList>
        {matches.slice(0, 6).map((f) => (
          <MatchRow key={f.id} fixture={f} showMeta />
        ))}
      </MatchList>
    </section>
  )
}

function FixturesTimeline({ fixtures }: { fixtures: LCFixture[] }) {
  const [query, setQuery] = useState("")
  const [venue, setVenue] = useState("all")
  const [view, setView] = useState<"upcoming" | "results">("upcoming")

  const venues = useMemo(
    () => Array.from(new Set(fixtures.map((f) => f.venue).filter(Boolean))) as string[],
    [fixtures],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return fixtures.filter((f) => {
      if (venue !== "all" && f.venue !== venue) return false
      if (!q) return true
      return [f.homeName, f.awayName, f.venue].some((v) => v?.toLowerCase().includes(q))
    })
  }, [fixtures, query, venue])

  const upcoming = filtered
    .filter((f) => f.status !== "completed")
    .sort((a, b) => dateVal(a.matchDate) - dateVal(b.matchDate))
  const results = filtered
    .filter((f) => f.status === "completed")
    .sort((a, b) => dateVal(b.matchDate) - dateVal(a.matchDate))

  const active = view === "upcoming" ? upcoming : results
  const grouped = useMemo(() => groupByWeek(active), [active])

  if (!fixtures.length) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Fixtures for this division will appear once the schedule is generated.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Upcoming / Results toggle */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setView("upcoming")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
            view === "upcoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Upcoming
          <span className={cn("rounded px-1 text-[10px] tabular-nums", view === "upcoming" ? "bg-primary-foreground/20" : "bg-secondary")}>
            {upcoming.length}
          </span>
        </button>
        <button
          onClick={() => setView("results")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
            view === "results" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Results
          <span className={cn("rounded px-1 text-[10px] tabular-nums", view === "results" ? "bg-primary-foreground/20" : "bg-secondary")}>
            {results.length}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams or venues..."
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {venues.length > 0 ? (
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All venues</option>
            {venues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Grouped match list */}
      {active.length ? (
        <MatchList>
          {grouped.map(({ week, matches }) => (
            <div key={week}>
              <MatchGroupHeader label={`Week ${week}`} sub={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`} />
              <div className="divide-y divide-border">
                {matches.map((f) => (
                  <MatchRow key={f.id} fixture={f} showMeta />
                ))}
              </div>
            </div>
          ))}
        </MatchList>
      ) : (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {view === "upcoming" ? "No upcoming fixtures match your filters." : "No completed results yet."}
        </p>
      )}
    </div>
  )
}

export function LiveExperienceShowcase() {
  const items = [
    { icon: <Radio className="h-5 w-5" />, title: "Live Scores", desc: "Set-by-set scoring streamed to every device as rubbers finish." },
    { icon: <Activity className="h-5 w-5" />, title: "Match Events", desc: "A live feed of court-by-court swings, comebacks and clinchers." },
    { icon: <BarChart3 className="h-5 w-5" />, title: "Live Standings", desc: "The table re-orders in real time as feature-court results land." },
  ]
  return (
    <section className="overflow-hidden rounded-xl border border-primary/30 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <h3 className="heading text-base">Live Match Experience</h3>
        </div>
        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          Coming Soon
        </span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-lg border border-border bg-background/40 p-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {it.icon}
            </span>
            <h4 className="mt-2 text-sm font-bold uppercase tracking-wide">{it.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function groupByWeek(fixtures: LCFixture[]) {
  const map = new Map<number, LCFixture[]>()
  for (const f of fixtures) {
    const arr = map.get(f.week) ?? []
    arr.push(f)
    map.set(f.week, arr)
  }
  return Array.from(map.entries())
    .map(([week, matches]) => ({ week, matches }))
    .sort((a, b) => a.week - b.week)
}

function dateVal(iso: string | null) {
  return iso ? Date.parse(iso) : Number.MAX_SAFE_INTEGER
}

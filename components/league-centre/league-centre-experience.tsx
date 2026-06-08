"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { MatchCard } from "@/components/league-centre/match-card"
import { StandingsTable } from "@/components/league-centre/standings-table"
import { RankingsLeaderboard } from "@/components/league-centre/rankings-leaderboard"
import type { LeagueCentreData, LCFixture } from "@/lib/queries-league-centre"
import { MapPin, Trophy, ListOrdered, CalendarDays, Search, Radio, Activity, BarChart3 } from "lucide-react"

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
    <div className="flex flex-col gap-10">
      {/* My Matches rail */}
      {data.authed && data.myMatches.length > 0 ? <MyMatches matches={data.myMatches} /> : null}

      {/* Region selector */}
      <section>
        <SectionLabel icon={<MapPin className="h-4 w-4" />} text="Select Region" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.regions.map((r) => {
            const active = r.id === regionId
            return (
              <button
                key={r.id}
                onClick={() => selectRegion(r.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/50 hover:bg-card/80",
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 opacity-[0.05] transition-opacity",
                    active ? "opacity-[0.12]" : "group-hover:opacity-[0.08]",
                  )}
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, var(--color-primary) 0, var(--color-primary) 2px, transparent 2px, transparent 12px)",
                  }}
                />
                <span className="relative block text-[11px] font-bold uppercase tracking-widest text-primary">
                  Region
                </span>
                <span className="relative mt-1 block heading text-xl">{r.name}</span>
                <div className="relative mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span><strong className="text-foreground tabular-nums">{r.teamCount}</strong> Teams</span>
                  <span><strong className="text-foreground tabular-nums">{r.clubCount}</strong> Clubs</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Division selector */}
      {regionDivisions.length > 0 ? (
        <section>
          <SectionLabel icon={<Trophy className="h-4 w-4" />} text="Select Division" />
          <div className="mt-4 flex flex-wrap gap-2">
            {regionDivisions.map((d) => {
              const active = d.id === activeDivisionId
              return (
                <button
                  key={d.id}
                  onClick={() => setDivisionId(d.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {d.name}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
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
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          <TabButton active={tab === "standings"} onClick={() => setTab("standings")} icon={<ListOrdered className="h-4 w-4" />}>
            Standings
          </TabButton>
          <TabButton active={tab === "fixtures"} onClick={() => setTab("fixtures")} icon={<CalendarDays className="h-4 w-4" />}>
            Fixtures &amp; Results
          </TabButton>
          <TabButton active={tab === "rankings"} onClick={() => setTab("rankings")} icon={<BarChart3 className="h-4 w-4" />}>
            Team Rankings
          </TabButton>
        </div>

        <div className="mt-6">
          {tab === "standings" ? (
            <StandingsTable rows={divisionStandings} />
          ) : tab === "fixtures" ? (
            <FixturesTimeline
              fixtures={divisionFixtures}
              regionName={activeDivision?.regionId === regionId ? data.regions.find((r) => r.id === regionId)?.name ?? null : null}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <RankingsLeaderboard rows={regionRankings} />
              <LiveExperienceShowcase />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
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
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors sm:flex-none sm:px-5",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  )
}

function MyMatches({ matches }: { matches: LCFixture[] }) {
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
        <Radio className="h-4 w-4" />
        My Upcoming Matches
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {matches.slice(0, 6).map((f) => (
          <MatchCard key={f.id} fixture={f} />
        ))}
      </div>
    </section>
  )
}

function FixturesTimeline({ fixtures, regionName }: { fixtures: LCFixture[]; regionName: string | null }) {
  const [query, setQuery] = useState("")
  const [venue, setVenue] = useState("all")

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

  if (!fixtures.length) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Fixtures for this division will appear once the schedule is generated.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams or venues..."
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All venues</option>
          {venues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Upcoming */}
      <div>
        <TimelineHeading label="Upcoming" count={upcoming.length} accent />
        {upcoming.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No upcoming fixtures match your filters.</p>
        )}
      </div>

      {/* Results */}
      <div>
        <TimelineHeading label="Results" count={results.length} />
        {results.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No completed results yet.</p>
        )}
      </div>
      {regionName ? <span className="sr-only">{regionName}</span> : null}
    </div>
  )
}

function TimelineHeading({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("h-3 w-3 rounded-full", accent ? "bg-primary" : "bg-muted-foreground")} />
      <h3 className="heading text-xl">{label}</h3>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
        {count}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function LiveExperienceShowcase() {
  const items = [
    { icon: <Radio className="h-5 w-5" />, title: "Live Scores", desc: "Set-by-set scoring streamed to every device as rubbers finish." },
    { icon: <Activity className="h-5 w-5" />, title: "Match Events", desc: "A live feed of court-by-court swings, comebacks and clinchers." },
    { icon: <BarChart3 className="h-5 w-5" />, title: "Live Standings", desc: "The table re-orders in real time as feature-court results land." },
  ]
  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <h3 className="heading text-lg">Live Match Experience</h3>
        </div>
        <span className="rounded-full border border-primary/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          Coming Soon
        </span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border border-border bg-background/40 p-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {it.icon}
            </span>
            <h4 className="mt-3 text-sm font-bold uppercase tracking-wide">{it.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function dateVal(iso: string | null) {
  return iso ? Date.parse(iso) : Number.MAX_SAFE_INTEGER
}

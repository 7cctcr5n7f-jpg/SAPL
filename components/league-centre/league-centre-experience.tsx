"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { StandingsTable } from "@/components/league-centre/standings-table"
import { Crest } from "@/components/league-centre/crest"
import type { LeagueCentreData, LCFixture } from "@/lib/queries-league-centre"
import { CATEGORY_RULES } from "@/lib/constants"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Clock,
  MapPin,
  CalendarDays,
  ListOrdered,
  Radio,
} from "lucide-react"
import Link from "next/link"

type ContentTab = "fixtures" | "results" | "standings"

const DIVISION_ORDER = ["Premier", "Championship", "Shield", "Challenge"]

// ─── helpers ────────────────────────────────────────────────────────────────

function timeLabel(iso: string | null, timeslot: string | null) {
  if (timeslot) return timeslot
  if (!iso) return "TBD"
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
}

function shortDate(iso: string | null) {
  if (!iso) return null
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))
}

// ─── Main experience ────────────────────────────────────────────────────────

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
  const [tab, setTab] = useState<ContentTab>("fixtures")
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)

  function selectRegion(id: number) {
    setRegionId(id)
    const divs = data.divisions
      .filter((d) => d.regionId === id)
      .sort((a, b) => DIVISION_ORDER.indexOf(a.name) - DIVISION_ORDER.indexOf(b.name) || a.level - b.level)
    setDivisionId(divs[0]?.id ?? null)
    setSelectedWeek(null)
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

  const allWeeks = useMemo(() => {
    const weeks = new Set<number>()
    divisionFixtures.forEach((f) => weeks.add(f.week))
    return Array.from(weeks).sort((a, b) => a - b)
  }, [divisionFixtures])

  const activeWeek = selectedWeek ?? allWeeks[0] ?? 1

  const weekFixtures = useMemo(
    () =>
      divisionFixtures
        .filter((f) => f.week === activeWeek)
        .sort((a, b) =>
          a.matchDate && b.matchDate ? new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() : 0,
        ),
    [divisionFixtures, activeWeek],
  )

  const upcomingFixtures = useMemo(() => weekFixtures.filter((f) => f.status !== "completed"), [weekFixtures])
  const completedFixtures = useMemo(() => weekFixtures.filter((f) => f.status === "completed"), [weekFixtures])

  if (!data.regions.length) {
    return (
      <div className="rounded-2xl border border-border bg-white px-6 py-20 text-center shadow-sm">
        <h2 className="text-2xl font-bold text-foreground">No live regions yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Regions appear here as soon as a season goes live. Check back once the schedule has been generated.
        </p>
      </div>
    )
  }

  const activeFixtures = tab === "fixtures" ? upcomingFixtures : completedFixtures

  return (
    <div style={{ backgroundColor: "rgb(245,248,255)" }} className="min-h-screen pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6">

        {/* ── My Matches rail ─────────────────────────────────────────── */}
        {data.authed && data.myMatches.length > 0 && (
          <MyMatchesRail matches={data.myMatches} />
        )}

        {/* ── Region Selector ──────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionLabel icon={<MapPin className="h-3.5 w-3.5" />} text="Region" />
          <div className="mt-3 flex flex-wrap gap-3">
            {data.regions.map((r) => {
              const active = r.id === regionId
              return (
                <button
                  key={r.id}
                  onClick={() => selectRegion(r.id)}
                  className={cn(
                    "rounded-2xl border px-5 py-3 text-left transition-all",
                    active
                      ? "border-red-600 bg-red-600 text-white shadow-md"
                      : "border-slate-200 bg-white text-foreground shadow-sm hover:border-red-300 hover:shadow-md",
                  )}
                >
                  <span className="block text-sm font-bold">{r.name}</span>
                  <span
                    className={cn(
                      "block text-[11px] tabular-nums",
                      active ? "text-red-100" : "text-muted-foreground",
                    )}
                  >
                    {r.teamCount} teams &middot; {r.clubCount} clubs
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Division Selector ────────────────────────────────────────── */}
        {regionDivisions.length > 0 && (
          <section className="mb-6">
            <SectionLabel icon={<ListOrdered className="h-3.5 w-3.5" />} text="Division" />
            <div className="mt-3 flex flex-wrap gap-2">
              {regionDivisions.map((d) => {
                const active = d.id === activeDivisionId
                return (
                  <button
                    key={d.id}
                    onClick={() => setDivisionId(d.id)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-semibold transition-all",
                      active
                        ? "border-red-600 bg-red-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-muted-foreground shadow-sm hover:border-red-300 hover:text-foreground",
                    )}
                  >
                    {d.name}
                    <span
                      className={cn(
                        "ml-2 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                        active ? "bg-red-500 text-white" : "bg-slate-100 text-muted-foreground",
                      )}
                    >
                      {d.teamCount}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Content Tabs ─────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100">
          {/* Tab strip */}
          <div className="flex border-b border-slate-100">
            {(["fixtures", "results", "standings"] as ContentTab[]).map((t) => {
              const labels: Record<ContentTab, string> = {
                fixtures: "Fixtures",
                results: "Results",
                standings: "Standings",
              }
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 py-3.5 text-sm font-semibold tracking-wide transition-colors",
                    tab === t
                      ? "border-b-2 border-red-600 text-red-600"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {labels[t]}
                </button>
              )
            })}
          </div>

          {/* Week Selector — Fixtures & Results */}
          {tab !== "standings" && allWeeks.length > 0 && (
            <WeekSelector
              weeks={allWeeks}
              activeWeek={activeWeek}
              onSelect={setSelectedWeek}
            />
          )}

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            {tab === "standings" ? (
              <StandingsTable rows={divisionStandings} />
            ) : (
              <FixturesByCategory fixtures={activeFixtures} isResults={tab === "results"} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Week Selector ───────────────────────────────────────────────────────────

function WeekSelector({
  weeks,
  activeWeek,
  onSelect,
}: {
  weeks: number[]
  activeWeek: number
  onSelect: (w: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-3 md:px-6">
      <button
        onClick={() => {
          const idx = weeks.indexOf(activeWeek)
          if (idx > 0) onSelect(weeks[idx - 1])
        }}
        disabled={activeWeek === weeks[0]}
        aria-label="Previous week"
        className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-muted-foreground transition-colors hover:border-slate-300 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => (
          <button
            key={w}
            onClick={() => onSelect(w)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all",
              w === activeWeek
                ? "bg-red-600 text-white shadow-sm"
                : "bg-slate-50 text-muted-foreground hover:bg-slate-100 hover:text-foreground",
            )}
          >
            Week {w}
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          const idx = weeks.indexOf(activeWeek)
          if (idx < weeks.length - 1) onSelect(weeks[idx + 1])
        }}
        disabled={activeWeek === weeks[weeks.length - 1]}
        aria-label="Next week"
        className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-muted-foreground transition-colors hover:border-slate-300 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Fixtures grouped by category ────────────────────────────────────────────

function FixturesByCategory({
  fixtures,
  isResults,
}: {
  fixtures: LCFixture[]
  isResults: boolean
}) {
  // Group by divisionName (the category for this division)
  // We use CATEGORY_RULES order but also capture any divisionName not in the list
  const categoryOrder = CATEGORY_RULES.map((r) => r.name)

  const byCategory = useMemo(() => {
    const map = new Map<string, LCFixture[]>()
    for (const f of fixtures) {
      const key = f.divisionName ?? "Other"
      const arr = map.get(key) ?? []
      arr.push(f)
      map.set(key, arr)
    }
    // Sort categories by CATEGORY_RULES order
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = categoryOrder.indexOf(a)
      const bi = categoryOrder.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [fixtures])

  if (fixtures.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {isResults ? "No results recorded for this week yet." : "No fixtures scheduled for this week."}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {byCategory.map(([category, cats]) => (
        <CategorySection key={category} category={category} fixtures={cats} isResults={isResults} />
      ))}
    </div>
  )
}

function CategorySection({
  category,
  fixtures,
  isResults,
}: {
  category: string
  fixtures: LCFixture[]
  isResults: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100" style={{ backgroundColor: "rgb(254,254,255)" }}>
      {/* Category header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">{category}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {fixtures.length}
        </span>
      </div>
      {/* Fixture cards */}
      <div className="divide-y divide-slate-50">
        {fixtures.map((f) => (
          <FixtureCard key={f.id} fixture={f} isResults={isResults} />
        ))}
      </div>
    </div>
  )
}

// ─── Individual Fixture Card ──────────────────────────────────────────────────

function FixtureCard({ fixture, isResults }: { fixture: LCFixture; isResults: boolean }) {
  const isCompleted = fixture.status === "completed"
  const isLive = fixture.status === "live"
  const homeWon = fixture.winnerTeamId != null && fixture.winnerTeamId === fixture.homeTeamId
  const awayWon = fixture.winnerTeamId != null && fixture.winnerTeamId === fixture.awayTeamId
  const hasScore = isCompleted || isLive

  // Get players for the fixture's own division category
  const category = fixture.divisionName ?? ""
  const homePlayers = fixture.homePlayers?.[category] ?? []
  const awayPlayers = fixture.awayPlayers?.[category] ?? []

  return (
    <div className="px-4 py-5 md:px-6 transition-colors hover:bg-slate-50/60">
      {/* Date / Venue row */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {fixture.matchDate && (
          <span className="inline-flex items-center gap-1 font-medium">
            <CalendarDays className="h-3 w-3" />
            {shortDate(fixture.matchDate)}
          </span>
        )}
        {fixture.timeslot && (
          <span className="inline-flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            {fixture.timeslot}
          </span>
        )}
        {fixture.venue && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {fixture.venue}
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1 font-bold text-red-600">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Main match layout */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
        {/* Home team */}
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2.5">
            <Crest name={fixture.homeName} logoUrl={fixture.homeLogo} size="md" />
            <span
              className={cn(
                "text-sm font-bold leading-tight md:text-base",
                hasScore && awayWon ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {fixture.homeName ?? "TBD"}
            </span>
          </div>
          {homePlayers.length > 0 && (
            <div className="ml-[2.75rem] mt-0.5 space-y-0.5">
              {homePlayers.map((p) => (
                <p key={p} className="text-[11px] text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center gap-1">
          {hasScore ? (
            <div className="flex items-center gap-2 tabular-nums">
              <span
                className={cn(
                  "text-3xl font-extrabold leading-none",
                  homeWon ? "text-red-600" : "text-foreground",
                )}
              >
                {fixture.homePoints ?? 0}
              </span>
              <span className="text-lg font-bold text-slate-300">-</span>
              <span
                className={cn(
                  "text-3xl font-extrabold leading-none",
                  awayWon ? "text-red-600" : "text-foreground",
                )}
              >
                {fixture.awayPoints ?? 0}
              </span>
            </div>
          ) : (
            <span className="text-xl font-bold text-slate-300">VS</span>
          )}
          {!hasScore && fixture.timeslot && (
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{fixture.timeslot}</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-row-reverse items-center gap-2.5">
            <Crest name={fixture.awayName} logoUrl={fixture.awayLogo} size="md" />
            <span
              className={cn(
                "text-right text-sm font-bold leading-tight md:text-base",
                hasScore && homeWon ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {fixture.awayName ?? "TBD"}
            </span>
          </div>
          {awayPlayers.length > 0 && (
            <div className="mr-[2.75rem] mt-0.5 space-y-0.5 text-right">
              {awayPlayers.map((p) => (
                <p key={p} className="text-[11px] text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons — only for logged-in players in this fixture */}
      {fixture.mine && !isCompleted && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {fixture.joinUrl ? (
            <a
              href={fixture.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md"
            >
              <ExternalLink className="h-4 w-4" />
              Join Game
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm"
            >
              <Clock className="h-4 w-4" />
              Link Coming Soon
            </button>
          )}
          <Link
            href={`/league-centre/match/${fixture.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-all hover:bg-red-50 hover:border-red-300"
          >
            Enter Score
          </Link>
        </div>
      )}

      {/* Results: view match details */}
      {isCompleted && (
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={`/league-centre/match/${fixture.id}`}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-red-600"
          >
            View match details &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── My Matches rail ─────────────────────────────────────────────────────────

function MyMatchesRail({ matches }: { matches: LCFixture[] }) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-red-50 bg-red-50/60 px-4 py-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">My Upcoming Matches</span>
      </div>
      <div className="divide-y divide-slate-50">
        {matches.slice(0, 5).map((f) => (
          <MyMatchRow key={f.id} fixture={f} />
        ))}
      </div>
    </section>
  )
}

function MyMatchRow({ fixture }: { fixture: LCFixture }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-14 shrink-0 text-center">
        <p className="text-xs font-semibold tabular-nums text-foreground">
          {timeLabel(fixture.matchDate, fixture.timeslot)}
        </p>
        <p className="text-[10px] text-muted-foreground">{shortDate(fixture.matchDate) ?? "TBD"}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Crest name={fixture.homeName} logoUrl={fixture.homeLogo} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {fixture.homeName ?? "TBD"}
        </span>
        <span className="text-xs font-bold text-muted-foreground">vs</span>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-foreground">
          {fixture.awayName ?? "TBD"}
        </span>
        <Crest name={fixture.awayName} logoUrl={fixture.awayLogo} size="sm" />
      </div>
      {fixture.joinUrl && (
        <a
          href={fixture.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-red-700"
        >
          Join
        </a>
      )}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-red-600">
      {icon}
      {text}
    </div>
  )
}

// ─── Exports kept for backwards compatibility ─────────────────────────────────

export function LiveExperienceShowcase() {
  return null
}

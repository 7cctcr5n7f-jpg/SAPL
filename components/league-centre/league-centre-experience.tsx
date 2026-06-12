"use client"

import { useMemo, useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import { StandingsTable } from "@/components/league-centre/standings-table"
import { Crest } from "@/components/league-centre/crest"
import type { LeagueCentreData, LCFixture, LCRubber } from "@/lib/queries-league-centre"
import { CATEGORY_RULES } from "@/lib/constants"
import { ResultEntry } from "@/components/captain/result-entry"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Clock,
  MapPin,
  CalendarDays,
  ListOrdered,
  Radio,
  Users,
} from "lucide-react"
import Link from "next/link"

type ContentTab = "schedule" | "standings"

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
  const [tab, setTab] = useState<ContentTab>("schedule")
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [expandedFixtureId, setExpandedFixtureId] = useState<number | null>(null)

  function toggleFixture(id: number) {
    setExpandedFixtureId((prev) => (prev === id ? null : id))
  }

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
      <div className="rounded-2xl border border-slate-100 bg-white px-6 py-20 text-center shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">No live regions yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Regions appear here as soon as a season goes live. Check back once the schedule has been generated.
        </p>
      </div>
    )
  }

  const activeFixtures = weekFixtures

  return (
    <div style={{ backgroundColor: "rgb(245,248,255)" }} className="min-h-screen pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6">

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
                      : "border-slate-200 bg-white text-slate-800 shadow-sm hover:border-red-300 hover:shadow-md",
                  )}
                >
                  <span className="block text-sm font-bold">{r.name}</span>
                  <span
                    className={cn(
                      "block text-[11px] tabular-nums",
                      active ? "text-red-100" : "text-slate-500",
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
                        : "border-slate-200 bg-white text-slate-500 shadow-sm hover:border-red-300 hover:text-slate-800",
                    )}
                  >
                    {d.name}
                    <span
                      className={cn(
                        "ml-2 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                        active ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500",
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
            {(["schedule", "standings"] as ContentTab[]).map((t) => {
              const labels: Record<ContentTab, string> = {
                schedule: "Matches",
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
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {labels[t]}
                </button>
              )
            })}
          </div>

          {/* Week Selector — Schedule only */}
          {tab === "schedule" && allWeeks.length > 0 && (
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
              <FixturesByCategory
                fixtures={activeFixtures}
                expandedFixtureId={expandedFixtureId}
                onToggleFixture={toggleFixture}
                currentPlayerId={data.currentPlayerId}
              />
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
        className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-slate-300 disabled:opacity-40"
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
                : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800",
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
        className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-slate-300 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Fixtures grouped by category ────────────────────────────────────────────

function FixturesByCategory({
  fixtures,
  expandedFixtureId,
  onToggleFixture,
  currentPlayerId,
}: {
  fixtures: LCFixture[]
  expandedFixtureId: number | null
  onToggleFixture: (id: number) => void
  currentPlayerId: number | null
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
      <div className="py-16 text-center text-sm text-slate-400">
        {"No fixtures scheduled for this week."}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {byCategory.map(([category, cats]) => (
        <CategorySection
          key={category}
          category={category}
          fixtures={cats}
          expandedFixtureId={expandedFixtureId}
          onToggleFixture={onToggleFixture}
          currentPlayerId={currentPlayerId}
        />
      ))}
    </div>
  )
}

function CategorySection({
  category,
  fixtures,
  expandedFixtureId,
  onToggleFixture,
  currentPlayerId,
}: {
  category: string
  fixtures: LCFixture[]
  expandedFixtureId: number | null
  onToggleFixture: (id: number) => void
  currentPlayerId: number | null
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100" style={{ backgroundColor: "rgb(254,254,255)" }}>
      {/* Category header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-red-600">{category}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
          {fixtures.length}
        </span>
      </div>
      {/* Fixture cards */}
      <div className="divide-y divide-slate-50">
        {fixtures.map((f) => (
          <FixtureCard
            key={f.id}
            fixture={f}
            isExpanded={expandedFixtureId === f.id}
            onToggle={() => onToggleFixture(f.id)}
            currentPlayerId={currentPlayerId}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Individual Fixture Card ──────────────────────────────────────────────────

function FixtureCard({
  fixture,
  isExpanded,
  onToggle,
  currentPlayerId,
}: {
  fixture: LCFixture
  isExpanded: boolean
  onToggle: () => void
  currentPlayerId: number | null
}) {
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
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
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
                hasScore && awayWon ? "text-slate-400" : "text-slate-900",
              )}
            >
              {fixture.homeName ?? "TBD"}
            </span>
          </div>
          {homePlayers.length > 0 && (
            <div className="ml-[2.75rem] mt-0.5 space-y-0.5">
              {homePlayers.map((p) => (
                <p key={p} className="text-[11px] text-slate-500">
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
                homeWon ? "text-red-600" : "text-slate-900",
              )}
              >
                {fixture.homePoints ?? 0}
              </span>
              <span className="text-lg font-bold text-slate-300">-</span>
              <span
              className={cn(
                "text-3xl font-extrabold leading-none",
                awayWon ? "text-red-600" : "text-slate-900",
              )}
              >
                {fixture.awayPoints ?? 0}
              </span>
            </div>
          ) : (
            <span className="text-xl font-bold text-slate-300">VS</span>
          )}
          {!hasScore && fixture.timeslot && (
            <span className="text-xs font-semibold tabular-nums text-slate-500">{fixture.timeslot}</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-row-reverse items-center gap-2.5">
            <Crest name={fixture.awayName} logoUrl={fixture.awayLogo} size="md" />
            <span
              className={cn(
                "text-right text-sm font-bold leading-tight md:text-base",
                hasScore && homeWon ? "text-slate-400" : "text-slate-900",
              )}
            >
              {fixture.awayName ?? "TBD"}
            </span>
          </div>
          {awayPlayers.length > 0 && (
            <div className="mr-[2.75rem] mt-0.5 space-y-0.5 text-right">
              {awayPlayers.map((p) => (
                <p key={p} className="text-[11px] text-slate-500">
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results: view match details */}
      {isCompleted && (
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={`/league-centre/match/${fixture.id}`}
            className="text-xs font-semibold text-slate-500 transition-colors hover:text-red-600"
          >
            View match details &rarr;
          </Link>
        </div>
      )}

      {/* Team vs Team breakdown toggle */}
      <button
        onClick={onToggle}
        className={cn(
          "mt-4 flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition-all",
          isExpanded
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-800",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {fixture.homeName ?? "Home"} vs {fixture.awayName ?? "Away"} — Individual Matches
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </button>

      {/* Expanded breakdown */}
      {isExpanded && (
        <FixtureBreakdown fixture={fixture} currentPlayerId={currentPlayerId} />
      )}
    </div>
  )
}

// ─── Fixture Breakdown (team vs team, per category) ──────────────────────────

const RUBBER_CATEGORY_ORDER = ["Mens Beginner", "Mens Intermediate", "Mens Open", "Ladies Open"]

function FixtureBreakdown({
  fixture,
  currentPlayerId,
}: {
  fixture: LCFixture
  currentPlayerId: number | null
}) {
  const isCompleted = fixture.status === "completed"
  const [scoreRubber, setScoreRubber] = useState<LCRubber | null>(null)

  // Build a map of existing rubbers by category
  const rubberByCategory = new Map<string, LCRubber>()
  for (const r of fixture.rubbers) {
    rubberByCategory.set(r.category, r)
  }

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {fixture.homeName}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</span>
          <span className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {fixture.awayName}
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {RUBBER_CATEGORY_ORDER.map((category) => {
            const rubber = rubberByCategory.get(category)
            const homePair = fixture.homePlayers?.[category] ?? []
            const awayPair = fixture.awayPlayers?.[category] ?? []
            const homeWon = rubber?.winnerTeamId != null && rubber.winnerTeamId === fixture.homeTeamId
            const awayWon = rubber?.winnerTeamId != null && rubber.winnerTeamId === fixture.awayTeamId
            const hasScore = !!rubber && isCompleted

            // Determine if the current player is assigned to this rubber.
            // Primary: check rubber's playerIds (when pairings are set).
            // Fallback: fixture.mine + player name appears in homePlayers/awayPlayers for this category.
            const myIds = rubber
              ? [...(rubber.homePlayerIds ?? []), ...(rubber.awayPlayerIds ?? [])]
              : []
            const iMyRubber =
              currentPlayerId != null &&
              (myIds.includes(currentPlayerId) ||
                (fixture.mine && (homePair.length > 0 || awayPair.length > 0)))

            // Join URL — only if player is in this rubber and match not yet completed
            const showJoin = fixture.mine && !isCompleted && iMyRubber && !!fixture.joinUrl
            // Enter Score — shown whenever the player is in this rubber (upcoming OR completed)
            const showScore = fixture.mine && iMyRubber

            return (
              <div key={category} className="px-4 py-3">
                {/* Category label */}
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                    {category}
                  </span>
                  {rubber?.scoreDetail && (
                    <span className="text-[10px] text-slate-400">{rubber.scoreDetail}</span>
                  )}
                </div>

                {/* Players vs Score vs Players */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {/* Home pair */}
                  <div className="space-y-0.5">
                    {homePair.length > 0 ? (
                      homePair.map((name) => (
                        <p
                          key={name}
                          className={cn(
                            "text-xs font-semibold leading-tight",
                            hasScore && awayWon ? "text-slate-400" : "text-slate-800",
                            hasScore && homeWon && "text-red-600",
                          )}
                        >
                          {name}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">TBD</p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {hasScore ? (
                      <>
                        <span className={cn("text-lg font-extrabold", homeWon ? "text-red-600" : "text-slate-700")}>
                          {rubber!.homeSetsWon}
                        </span>
                        <span className="text-sm text-slate-300">-</span>
                        <span className={cn("text-lg font-extrabold", awayWon ? "text-red-600" : "text-slate-700")}>
                          {rubber!.awaySetsWon}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-slate-300">vs</span>
                    )}
                  </div>

                  {/* Away pair */}
                  <div className="space-y-0.5 text-right">
                    {awayPair.length > 0 ? (
                      awayPair.map((name) => (
                        <p
                          key={name}
                          className={cn(
                            "text-xs font-semibold leading-tight",
                            hasScore && homeWon ? "text-slate-400" : "text-slate-800",
                            hasScore && awayWon && "text-red-600",
                          )}
                        >
                          {name}
                        </p>
                      ))
                    ) : (
                      <p className="text-right text-xs text-slate-400">TBD</p>
                    )}
                  </div>
                </div>

                {/* Per-rubber action buttons — only for the player assigned to THIS rubber */}
                {(showJoin || showScore) && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {showJoin && (
                      <a
                        href={fixture.joinUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Join Now
                      </a>
                    )}
                    {showScore && rubber && (
                      <button
                        onClick={() => setScoreRubber(rubber)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
                      >
                        {isCompleted ? "Edit Score" : "Enter Score"}
                      </button>
                    )}
                    {showScore && !rubber && (
                      <button
                        onClick={() => {
                          // No rubber row yet — create a placeholder to open the dialog
                          setScoreRubber({
                            id: 0,
                            category,
                            session: 1,
                            isFeatureCourt: false,
                            homeSetsWon: 0,
                            awaySetsWon: 0,
                            scoreDetail: null,
                            winnerTeamId: null,
                            homePlayerIds: [],
                            awayPlayerIds: [],
                          })
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
                      >
                        Enter Score
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Inline score entry dialog */}
      <Dialog open={!!scoreRubber} onOpenChange={(open) => !open && setScoreRubber(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Score · {scoreRubber?.category}</DialogTitle>
          </DialogHeader>
          {scoreRubber && (
            <ResultEntry
              fixtureId={fixture.id}
              homeName={fixture.homeName ?? "Home"}
              awayName={fixture.awayName ?? "Away"}
              categories={[{
                category: scoreRubber.category,
                session: scoreRubber.session,
                isFeatureCourt: scoreRubber.isFeatureCourt,
              }]}
              onDone={() => setScoreRubber(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
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

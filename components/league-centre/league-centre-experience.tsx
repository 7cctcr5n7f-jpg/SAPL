"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { StandingsTable } from "@/components/league-centre/standings-table"
import { Crest } from "@/components/league-centre/crest"
import type { LeagueCentreData, LCFixture, LCRubber, FormItem } from "@/lib/queries-league-centre"
import { computeDivisionPlayoffQualifiers } from "@/lib/engine/playoffs"
import { parseScoreDetail, tallySets } from "@/lib/engine/scoring"
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

type ContentTab = "schedule" | "standings"

const DIVISION_ORDER = ["Premier", "Championship", "Shield", "Challenge"]

function playoffQualificationRule(regionCount: number) {
  if (regionCount <= 1) return "Top 8 qualify for the playoff weekend."
  if (regionCount === 2) return "Top 4 from each region qualify for quarter-finals."
  if (regionCount === 3) return "Top 2 from each region plus the best two 3rd-place teams qualify for quarter-finals."
  if (regionCount === 4) return "Top 2 from each region qualify for quarter-finals."
  const base = Math.floor(8 / regionCount)
  const extra = 8 % regionCount
  return extra > 0
    ? `Top ${base} from each region plus ${extra} wildcard team${extra === 1 ? "" : "s"} qualify for quarter-finals.`
    : `Top ${base} from each region qualify for quarter-finals.`
}

// ─── helpers ────────────────────────────────────────────────────────────────

function shortDate(iso: string | null) {
  if (!iso) return null
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))
}

function slotTimeValue(value: string | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const [hour, minute] = value.split(":").map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER
  return hour * 60 + minute
}

function courtSortValue(value: string | null | undefined) {
  const court = Number(value)
  return Number.isFinite(court) ? court : Number.MIN_SAFE_INTEGER
}

function averagePairRating(players: { rating: number | null }[]) {
  const ratings = players
    .map((player) => player.rating)
    .filter((rating): rating is number => rating != null && Number.isFinite(rating))
  if (ratings.length === 0) return null
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
}

function computeFixtureTeamPoints(fixture: LCFixture) {
  if (fixture.rubbers.length === 0) {
    return {
      home: fixture.homePoints ?? 0,
      away: fixture.awayPoints ?? 0,
    }
  }
  return fixture.rubbers.reduce(
    (acc, rubber) => {
      const rubberPoints = computeRubberTeamPoints(rubber)
      acc.home += rubberPoints.home
      acc.away += rubberPoints.away
      return acc
    },
    { home: 0, away: 0 },
  )
}

function computeRubberTeamPoints(rubber: LCRubber | null | undefined) {
  if (!rubber) return { home: 0, away: 0 }
  const parsedSets = parseScoreDetail(rubber.scoreDetail)
  const tally = parsedSets.length > 0 ? tallySets(parsedSets) : null
  const homeSetsWon = tally?.homeSetsWon ?? rubber.homeSetsWon
  const awaySetsWon = tally?.awaySetsWon ?? rubber.awaySetsWon
  const splitSets = tally?.splitSets ?? 0
  const homeBonus = homeSetsWon > awaySetsWon ? 1 : 0
  const awayBonus = awaySetsWon > homeSetsWon ? 1 : 0
  // Category tied on completed sets (e.g. 1-1): split only the category bonus
  // point (0.5 each). Any unfinished deciding set is already split below.
  const tiedSplitBonus = homeSetsWon > 0 && homeSetsWon === awaySetsWon ? 0.5 : 0
  return {
    home: homeSetsWon + homeBonus + splitSets * 0.5 + tiedSplitBonus,
    away: awaySetsWon + awayBonus + splitSets * 0.5 + tiedSplitBonus,
  }
}

function isCompletedSet(home: number, away: number) {
  if (home === away) return false
  return Math.max(home, away) >= 6
}

function renderScoreDetail(scoreDetail: string | null | undefined) {
  const sets = parseScoreDetail(scoreDetail)
  if (sets.length === 0) return null
  return (
    <span className="flex flex-col items-center gap-0.5 text-[11px] font-medium leading-tight">
      {sets.map((set, index) => {
        const completed = isCompletedSet(set.home, set.away)
        const homeClass = completed && set.home > set.away ? "lc-score-win" : "lc-score-neutral"
        const awayClass = completed && set.away > set.home ? "lc-score-win" : "lc-score-neutral"
        return (
          <span key={`${set.home}-${set.away}-${index}`} className="tabular-nums">
            <span className={cn("font-semibold", homeClass)}>{set.home}</span>
            <span className="text-slate-500">-</span>
            <span className={cn("font-semibold", awayClass)}>{set.away}</span>
            {index < sets.length - 1 ? null : null}
          </span>
        )
      })}
    </span>
  )
}

function renderTooltipScoreDetail(scoreDetail: string) {
  const sets = parseScoreDetail(scoreDetail)
  if (sets.length === 0) return null
  return (
    <span className="ml-1 tabular-nums">
      {sets.map((set, index) => {
        const completed = isCompletedSet(set.home, set.away)
        const homeClass = completed && set.home > set.away ? "lc-tooltip-win" : "lc-tooltip-text"
        const awayClass = completed && set.away > set.home ? "lc-tooltip-win" : "lc-tooltip-text"
        return (
          <span key={`${set.home}-${set.away}-${index}`}>
            <span className={homeClass}>{set.home}</span>
            <span className="text-slate-400">-</span>
            <span className={awayClass}>{set.away}</span>
            {index < sets.length - 1 ? <span className="text-slate-400">, </span> : null}
          </span>
        )
      })}
    </span>
  )
}

function fixtureDisplayTime(fixture: LCFixture) {
  const categoryTimes = Object.values(fixture.courtInfoByCategory ?? {})
    .map((entry) => entry?.time ?? null)
    .filter((time): time is string => Boolean(time))
    .sort((a, b) => slotTimeValue(a) - slotTimeValue(b))
  return categoryTimes[0] ?? fixture.timeslot
}

function normalizeCategoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bmen\b/g, "mens")
    .replace(/\bbegineer\b/g, "beginner")
    .replace(/\s+/g, " ")
}

const FIXTURE_CATEGORY_ORDER = ["mens beginner", "mens intermediate", "mens open", "ladies open"] as const

function categorySortRank(category: string): number {
  const normalized = normalizeCategoryKey(category)
    .replace(/[^\w\s]/g, " ")
    .replace(/\bbegineer\b/g, "beginner")
    .replace(/\bmen\b/g, "mens")
    .replace(/\s+/g, " ")
    .trim()
  const index = FIXTURE_CATEGORY_ORDER.indexOf(normalized as (typeof FIXTURE_CATEGORY_ORDER)[number])
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function linkForCategory(links: Record<string, string> | undefined, category: string): string | null {
  if (!links) return null
  const direct = links[category]
  if (direct) return direct
  const target = normalizeCategoryKey(category)
  for (const [key, url] of Object.entries(links)) {
    if (normalizeCategoryKey(key) === target && url) return url
  }
  return null
}

function utcDateOnly(iso: string): number | null {
  const datePart = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  const ts = Date.parse(`${datePart}T00:00:00Z`)
  return Number.isFinite(ts) ? ts : null
}

function weekFromDate(matchDate: string | null, firstRegularDate: string | null): number | null {
  if (!matchDate || !firstRegularDate) return null
  const matchTs = utcDateOnly(matchDate)
  const firstTs = utcDateOnly(firstRegularDate)
  if (matchTs == null || firstTs == null) return null
  const deltaDays = Math.max(0, Math.floor((matchTs - firstTs) / 86_400_000))
  return 1 + Math.floor(deltaDays / 7)
}

function shortRegionLabel(name: string) {
  return name
    .replace(/\s*conference\s*/i, "")
    .replace(/\s*tshwane\s*/i, "")
    .trim()
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

  const playoffQualification = useMemo(() => {
    if (!activeDivision) return { byTeamId: new Map<number, "direct" | "wildcard">(), rule: "" }
    const sameLevelDivisions = data.divisions.filter((d) => d.level === activeDivision.level && d.regionId != null)
    const byDivisionId = new Map(sameLevelDivisions.map((d) => [d.id, d]))
    const qualifiers = computeDivisionPlayoffQualifiers(
      data.standings
        .filter((row) => byDivisionId.has(row.divisionId))
        .map((row) => {
          const division = byDivisionId.get(row.divisionId)!
          return {
            divisionId: row.divisionId,
            divisionLevel: division.level,
            divisionName: division.name,
            regionId: division.regionId,
            regionName: null,
            teamId: row.teamId,
            teamName: row.teamName,
            rank: row.rank,
            points: row.points,
            matchesWon: row.matchesWon,
            setsWon: row.setsWon,
            pointsDiff: row.pointsDiff,
          }
        }),
    )
    return {
      byTeamId: new Map(qualifiers.map((q) => [q.teamId, q.qualificationType])),
      rule: playoffQualificationRule(sameLevelDivisions.length),
    }
  }, [activeDivision, data.divisions, data.standings])

  const divisionFixtures = useMemo(
    () => data.fixtures.filter((f) => f.divisionId === activeDivisionId),
    [data.fixtures, activeDivisionId],
  )

  const resolvedWeekByFixtureId = useMemo(() => {
    const regularFixtures = divisionFixtures.filter((fixture) => (fixture.divisionName ?? "").toLowerCase() !== "playoff")
    const firstRegularDate =
      regularFixtures
        .map((fixture) => fixture.matchDate)
        .filter((matchDate): matchDate is string => Boolean(matchDate))
        .sort((a, b) => (utcDateOnly(a) ?? 0) - (utcDateOnly(b) ?? 0))[0] ?? null

    let maxRegularWeek = 0
    const byFixtureId = new Map<number, number>()

    for (const fixture of regularFixtures) {
      const storedWeek = Number.isInteger(fixture.week) && fixture.week > 0 ? fixture.week : null
      const datedWeek = weekFromDate(fixture.matchDate, firstRegularDate)
      const resolvedWeek = Math.max(storedWeek ?? 0, datedWeek ?? 0)
      if (resolvedWeek > 0) {
        byFixtureId.set(fixture.id, resolvedWeek)
        maxRegularWeek = Math.max(maxRegularWeek, resolvedWeek)
      }
    }

    const playoffWeekFloor = Math.max(data.season.weeks, maxRegularWeek + 1)
    for (const fixture of divisionFixtures) {
      if ((fixture.divisionName ?? "").toLowerCase() === "playoff") {
        const storedWeek = Number.isInteger(fixture.week) && fixture.week > 0 ? fixture.week : playoffWeekFloor
        byFixtureId.set(fixture.id, Math.max(storedWeek, playoffWeekFloor))
      }
    }

    return byFixtureId
  }, [divisionFixtures, data.season.weeks])

  const allWeeks = useMemo(() => {
    const weeks = new Set<number>()
    divisionFixtures.forEach((f) => {
      const week = resolvedWeekByFixtureId.get(f.id) ?? null
      if (week != null) weeks.add(week)
    })
    return Array.from(weeks).sort((a, b) => a - b)
  }, [divisionFixtures, resolvedWeekByFixtureId])

  const finalsWeek = useMemo(() => {
    const playoffWeeks = divisionFixtures
      .filter((fixture) => (fixture.divisionName ?? "").toLowerCase() === "playoff")
      .map((fixture) => resolvedWeekByFixtureId.get(fixture.id) ?? null)
      .filter((week): week is number => week != null)
    if (!playoffWeeks.length) return null
    return Math.max(...playoffWeeks)
  }, [divisionFixtures, resolvedWeekByFixtureId])

  const defaultWeek = useMemo(() => {
    if (!allWeeks.length) return 1
    const regularFixtures = divisionFixtures.filter((fixture) => (fixture.divisionName ?? "").toLowerCase() !== "playoff")
    const firstRegularDate =
      regularFixtures
        .map((fixture) => fixture.matchDate)
        .filter((matchDate): matchDate is string => Boolean(matchDate))
        .sort((a, b) => (utcDateOnly(a) ?? 0) - (utcDateOnly(b) ?? 0))[0] ?? null
    const todayIso = new Date().toISOString().slice(0, 10)
    const inferredWeek = weekFromDate(todayIso, firstRegularDate)
    if (inferredWeek == null) return allWeeks[0]
    if (allWeeks.includes(inferredWeek)) return inferredWeek
    const priorWeek = [...allWeeks].reverse().find((week) => week <= inferredWeek)
    return priorWeek ?? allWeeks[0]
  }, [allWeeks, divisionFixtures])

  const activeWeek = selectedWeek != null && allWeeks.includes(selectedWeek) ? selectedWeek : defaultWeek

  const weekFixtures = useMemo(
    () =>
      divisionFixtures
        .filter((f) => (resolvedWeekByFixtureId.get(f.id) ?? null) === activeWeek)
        .sort((a, b) =>
          slotTimeValue(a.timeslot) - slotTimeValue(b.timeslot) ||
          courtSortValue(b.courtInfoByCategory?.[b.divisionName ?? ""]?.court) - courtSortValue(a.courtInfoByCategory?.[a.divisionName ?? ""]?.court) ||
          (a.matchDate && b.matchDate ? new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() : 0),
        ),
    [divisionFixtures, activeWeek, resolvedWeekByFixtureId],
  )

  const byeTeams = useMemo(() => {
    const scheduledTeamIds = new Set<number>()
    weekFixtures.forEach((fixture) => {
      if (fixture.homeTeamId != null) scheduledTeamIds.add(fixture.homeTeamId)
      if (fixture.awayTeamId != null) scheduledTeamIds.add(fixture.awayTeamId)
    })
    return divisionStandings.filter((team) => !scheduledTeamIds.has(team.teamId))
  }, [weekFixtures, divisionStandings])

  const activeFixtures = weekFixtures
  const finalsFixtures = activeFixtures.filter((fixture) => (fixture.divisionName ?? "").toLowerCase() === "playoff")
  const showingFinalsBracket = finalsWeek != null && activeWeek === finalsWeek && finalsFixtures.length > 0

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

  return (
    <div style={{ backgroundColor: "rgb(245,248,255)", WebkitTextSizeAdjust: "100%", textSizeAdjust: "100%" }} className="min-h-screen pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6">

        {/* ── Region Selector ──────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionLabel icon={<MapPin className="h-3.5 w-3.5" />} text="Region" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {data.regions.map((r) => {
              const active = r.id === regionId
              return (
                <button
                  key={r.id}
                  onClick={() => selectRegion(r.id)}
                  className={cn(
                    "min-w-0 rounded-2xl border px-2 py-2.5 text-center transition-all max-[360px]:rounded-xl max-[360px]:px-1.5 max-[360px]:py-2",
                    active
                      ? "border-red-600 bg-red-600 text-white shadow-md"
                      : "border-slate-200 bg-white text-slate-800 shadow-sm hover:border-red-300 hover:shadow-md",
                  )}
                >
                  <span className="block truncate whitespace-nowrap text-[clamp(0.65rem,2.8vw,0.95rem)] font-bold">
                    <span className="hidden min-[420px]:inline">{r.name}</span>
                    <span className="min-[420px]:hidden">{shortRegionLabel(r.name)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Division Selector ────────────────────────────────────────── */}
        {regionDivisions.length > 1 && (
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
              finalsWeek={finalsWeek}
              onSelect={setSelectedWeek}
            />
          )}

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            {tab === "standings" ? (
              <StandingsTable
                rows={divisionStandings}
                qualifierByTeamId={playoffQualification.byTeamId}
                qualificationRule={playoffQualification.rule}
              />
            ) : (
              <div className="space-y-5">
                {finalsWeek != null && activeWeek === finalsWeek ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
                    Finals weekend is shown <span className="font-semibold">as is</span> based on current standings and can still change before lock-in.
                  </div>
                ) : null}
                {!showingFinalsBracket && byeTeams.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                        Bye week
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {byeTeams.map((team) => (
                          <div
                            key={team.teamId}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-sm text-amber-950"
                          >
                            <Crest
                              name={team.teamName}
                              logoUrl={team.teamLogo ?? team.venueLogo ?? team.orgLogo}
                              size="sm"
                            />
                            <span className="font-medium">{team.teamName ?? "Unknown team"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {showingFinalsBracket ? (
                  <FinalsBracket fixtures={finalsFixtures} />
                ) : (
                  <FixturesByCategory
                    fixtures={activeFixtures}
                    expandedFixtureId={expandedFixtureId}
                    onToggleFixture={toggleFixture}
                    currentPlayerId={data.currentPlayerId}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FinalsBracket({ fixtures }: { fixtures: LCFixture[] }) {
  const sorted = useMemo(
    () =>
      [...fixtures].sort(
        (a, b) =>
          (a.matchDate && b.matchDate ? new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() : 0) ||
          slotTimeValue(a.timeslot) - slotTimeValue(b.timeslot) ||
          (a.id - b.id),
      ),
    [fixtures],
  )

  const round = (fixture: LCFixture): "quarter" | "semi" | "third" | "final" => {
    if (fixture.playoffBracketPosition != null) {
      if (fixture.playoffBracketPosition >= 1 && fixture.playoffBracketPosition <= 4) return "quarter"
      if (fixture.playoffBracketPosition >= 5 && fixture.playoffBracketPosition <= 6) return "semi"
      if (fixture.playoffBracketPosition === 7) return "third"
      if (fixture.playoffBracketPosition === 8) return "final"
    }
    const label = `${fixture.homeName ?? ""} ${fixture.awayName ?? ""}`.toLowerCase()
    if (label.includes("sf1 loser") || label.includes("sf2 loser") || label.includes("3rd")) return "third"
    if (label.includes("sf1 winner") || label.includes("sf2 winner")) return "final"
    if (label.includes("qf") && label.includes("winner")) return "semi"
    return "quarter"
  }

  const quarters = sorted.filter((fixture) => round(fixture) === "quarter")
  const semis = sorted.filter((fixture) => round(fixture) === "semi")
  const thirdPlace = sorted.filter((fixture) => round(fixture) === "third")
  const final = sorted.filter((fixture) => round(fixture) === "final")

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <BracketColumn title="Quarter-finals" fixtures={quarters} />
      <BracketColumn title="Semi-finals" fixtures={semis} />
      <div className="space-y-4">
        <BracketColumn title="3rd Place Playoff" fixtures={thirdPlace} />
        <BracketColumn title="Final" fixtures={final} />
      </div>
    </div>
  )
}

function BracketColumn({ title, fixtures }: { title: string; fixtures: LCFixture[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-center">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-red-600">{title}</h3>
      <div className="space-y-2.5">
        {fixtures.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">TBD</p>
        ) : (
          fixtures.map((fixture) => <BracketMatchCard key={fixture.id} fixture={fixture} />)
        )}
      </div>
    </section>
  )
}

function BracketMatchCard({ fixture }: { fixture: LCFixture }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
      <div className="mb-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {fixture.matchDate ? <span>{shortDate(fixture.matchDate)}</span> : null}
        {fixture.timeslot ? <span>{fixture.timeslot}</span> : null}
      </div>
      <div className="space-y-1 text-sm font-semibold text-slate-800">
        <p>{fixture.homeName ?? "TBD"}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">vs</p>
        <p>{fixture.awayName ?? "TBD"}</p>
      </div>
      {fixture.venue ? <p className="mt-1.5 text-[11px] text-slate-500">{fixture.venue}</p> : null}
    </article>
  )
}

// ─── Week Selector ───────────────────────────────────────────────────────────

function WeekSelector({
  weeks,
  activeWeek,
  finalsWeek,
  onSelect,
}: {
  weeks: number[]
  activeWeek: number
  finalsWeek: number | null
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
            {w === finalsWeek ? "Finals" : `Week ${w}`}
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
  const byCategory = useMemo(() => {
    const map = new Map<string, LCFixture[]>()
    for (const f of fixtures) {
      const key = f.divisionName ?? "Other"
      const arr = map.get(key) ?? []
      arr.push(f)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = categorySortRank(a)
      const bi = categorySortRank(b)
      if (ai === bi) return a.localeCompare(b)
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
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 max-[360px]:px-2.5 max-[360px]:py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-red-600 max-[360px]:text-[10px]">{category}</span>
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-slate-500 max-[360px]:px-1 max-[360px]:text-[8px]">
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
  const hasRecordedRubber = fixture.rubbers.some(
    (rubber) => rubber.homeSetsWon > 0 || rubber.awaySetsWon > 0 || Boolean(rubber.scoreDetail),
  )
  const hasScore = isCompleted || isLive || hasRecordedRubber
  const teamPoints = computeFixtureTeamPoints(fixture)
  const homeTeamScoreClass = teamPoints.home > teamPoints.away ? "lc-score-win" : "lc-score-neutral"
  const awayTeamScoreClass = teamPoints.away > teamPoints.home ? "lc-score-win" : "lc-score-neutral"
  const displayTime = fixtureDisplayTime(fixture)

  // Get players for the fixture's own division category
  const category = fixture.divisionName ?? ""
  const categoryJoinUrl = category ? linkForCategory(fixture.joinUrlByCategory, category) : null
  const playerIsShownInCategory =
    currentPlayerId != null &&
    fixture.rubbers.some((rubber) =>
      rubber.category === category &&
      [...(rubber.homePlayerIds ?? []), ...(rubber.awayPlayerIds ?? [])].includes(currentPlayerId),
    )
  const joinUrl =
    categoryJoinUrl && (playerIsShownInCategory || fixture.myCategories.includes(category))
      ? categoryJoinUrl
      : fixture.myCategories.map((myCategory) => fixture.joinUrlByCategory?.[myCategory]).find(Boolean) ?? fixture.joinUrl ?? null
  const homePlayers = fixture.homePlayers?.[category] ?? []
  const awayPlayers = fixture.awayPlayers?.[category] ?? []

  return (
    <div className="px-3 py-4 transition-colors hover:bg-slate-50/60 max-[360px]:px-2.5 max-[360px]:py-3 md:px-6 md:py-5">
      {/* Date / Venue row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-tight text-slate-500 max-[360px]:mb-2.5 max-[360px]:gap-x-2 max-[360px]:text-[10px] max-[340px]:text-[9px]">
        {fixture.matchDate && (
          <span className="inline-flex items-center gap-1 font-medium">
            <CalendarDays className="h-3 w-3" />
            {shortDate(fixture.matchDate)}
          </span>
        )}
        {displayTime && (
          <span className="inline-flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            {displayTime}
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
      <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] items-start gap-2 max-[380px]:grid-cols-[minmax(0,1fr)_78px_minmax(0,1fr)] max-[360px]:grid-cols-[minmax(0,1fr)_70px_minmax(0,1fr)] max-[360px]:gap-1 md:grid-cols-[1fr_108px_1fr] md:gap-6">
        {/* Home team */}
        <div className="flex min-w-0 flex-col items-start gap-1">
          <div className="flex items-center gap-2 max-[360px]:gap-1.5">
            <Crest name={fixture.homeName} logoUrl={fixture.homeLogo} size="md" className="h-10 w-10 max-[380px]:h-9 max-[380px]:w-9 max-[360px]:h-8 max-[360px]:w-8" />
            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[clamp(0.75rem,2.5vw,1rem)] font-bold leading-tight [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden",
                  hasScore && awayWon ? "text-slate-400" : "text-slate-900",
                )}>
                  {fixture.homeName ?? "TBD"}
                </span>
              </div>
              <FormDots items={fixture.homeFormItems} align="left" />
            </div>
          </div>
          {homePlayers.length > 0 && (
            <div className="ml-10 mt-0.5 space-y-0.5 max-[380px]:ml-9 max-[360px]:ml-8">
              {homePlayers.map((p) => (
                <p key={p.name} className="text-[10px] leading-tight text-slate-500 max-[360px]:text-[9px]">{p.name}</p>
              ))}
            </div>
          )}
        </div>

        {/* Score / VS */}
        <div className="flex min-h-[4.25rem] self-center flex-col items-center justify-center gap-1 max-[360px]:min-h-[3.9rem]">
          {hasScore ? (
            <div className="flex min-w-[88px] items-center justify-center gap-2 whitespace-nowrap tabular-nums max-[380px]:min-w-[78px] max-[380px]:gap-1.5 max-[360px]:min-w-[70px]">
              <span
              className={cn("text-[clamp(1.8rem,8vw,2.25rem)] font-extrabold leading-none", homeTeamScoreClass)}
              >
                {teamPoints.home}
              </span>
              <span className="text-[clamp(1rem,3.5vw,1.125rem)] font-bold text-slate-300">-</span>
              <span
              className={cn("text-[clamp(1.8rem,8vw,2.25rem)] font-extrabold leading-none", awayTeamScoreClass)}
              >
                {teamPoints.away}
              </span>
            </div>
          ) : (
            <span className="text-xl font-bold text-slate-300">VS</span>
          )}
          {!hasScore && displayTime && (
            <span className="text-xs font-semibold tabular-nums text-slate-500">{displayTime}</span>
          )}
          {!hasScore && fixture.assignedToFixture && fixture.mine && !joinUrl ? (
            <span className="max-w-[11rem] text-center text-[10px] font-semibold leading-tight text-slate-400">
              Booking link pending. Playtomic non-premium accounts can usually only join within 12 days.
            </span>
          ) : null}
        </div>

        {/* Away team */}
        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className="flex flex-row-reverse items-center gap-2 max-[360px]:gap-1.5">
            <Crest name={fixture.awayName} logoUrl={fixture.awayLogo} size="md" className="h-10 w-10 max-[380px]:h-9 max-[380px]:w-9 max-[360px]:h-8 max-[360px]:w-8" />
            <div className="min-w-0 flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-right text-[clamp(0.75rem,2.5vw,1rem)] font-bold leading-tight [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden",
                  "break-words",
                  hasScore && homeWon ? "text-slate-400" : "text-slate-900",
                )}>
                  {fixture.awayName ?? "TBD"}
                </span>
              </div>
              <FormDots items={fixture.awayFormItems} align="right" />
            </div>
          </div>
          {awayPlayers.length > 0 && (
            <div className="mr-10 mt-0.5 space-y-0.5 text-right max-[380px]:mr-9 max-[360px]:mr-8">
              {awayPlayers.map((p) => (
                <p key={p.name} className="text-[10px] leading-tight text-slate-500 max-[360px]:text-[9px]">{p.name}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team vs Team breakdown toggle */}
      <button
        onClick={onToggle}
        className={cn(
          "mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-semibold leading-snug transition-all max-[360px]:px-2.5 max-[360px]:py-1.5 max-[360px]:text-[10px]",
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

/** Coloured dots showing recent form. Hover shows opponent + score. */
function FormDots({
  items,
  align = "left",
}: {
  items: FormItem[]
  align?: "left" | "right"
}) {
  if (!items.length) return null
  return (
    <div className={cn("flex items-center gap-1", align === "right" && "flex-row-reverse")}>
      {items.map((item, i) => {
        const scoreLabel = item.isHome
          ? `${item.homeScore}–${item.awayScore}`
          : `${item.awayScore}–${item.homeScore}`
        return (
          <div key={i} className="group relative">
            <span
              className={cn(
                "block h-2.5 w-2.5 rounded-full cursor-default transition-transform group-hover:scale-125",
                item.result === "W" ? "bg-emerald-500" : "bg-red-400",
              )}
            />
            {/* Tooltip */}
            <div className={cn(
              "lc-tooltip pointer-events-none absolute top-full z-50 mt-1.5 whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100",
              align === "right" ? "right-0" : "left-0",
            )}>
              <span className={cn("font-bold", item.result === "W" ? "lc-tooltip-win" : "lc-tooltip-loss")}>
                {item.result === "W" ? "W" : "L"}
              </span>
              <span className="lc-tooltip-text">{" · "}{item.opponentName}</span>
              {renderTooltipScoreDetail(scoreLabel)}
              {/* Caret */}
              <span className={cn(
                "absolute bottom-full h-0 w-0 border-x-4 border-b-4 border-x-transparent border-b-slate-900",
                align === "right" ? "right-2" : "left-2",
              )} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryDot({
  result,
  opponent,
  scoreLabel,
  align = "left",
}: {
  result: "W" | "L" | "D"
  opponent: string
  scoreLabel?: string | null
  align?: "left" | "right"
}) {
  return (
    <div className={cn("group relative flex items-center", align === "right" && "justify-end")}>
      <span
        className={cn(
          "block h-2.5 w-2.5 rounded-full cursor-default transition-transform group-hover:scale-125",
          result === "W" ? "bg-emerald-500" : result === "L" ? "bg-red-400" : "bg-slate-500",
        )}
      />
      <div
        className={cn(
          "lc-tooltip pointer-events-none absolute top-full z-50 mt-1.5 max-w-52 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-medium leading-snug opacity-0 shadow-lg transition-opacity group-hover:opacity-100",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        <span
          className={cn(
            "font-bold",
            result === "W" ? "lc-tooltip-win" : result === "L" ? "lc-tooltip-loss" : "lc-tooltip-text",
          )}
        >
          {result}
        </span>
        <span className="lc-tooltip-text break-words">{" · "}{opponent}</span>
        {scoreLabel ? renderTooltipScoreDetail(scoreLabel) : null}
        <span
          className={cn(
            "absolute bottom-full h-0 w-0 border-x-4 border-b-4 border-x-transparent border-b-slate-900",
            align === "right" ? "right-2" : "left-2",
          )}
        />
      </div>
    </div>
  )
}

/** Small LI pill — shown inline with team/player name */
function LiBadge({ li, tall = false }: { li: number | null; tall?: boolean }) {
  if (li == null || li === 0 || !Number.isFinite(li)) return null
  return (
    <span
      className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200"
      title="Average pair rating"
      style={tall ? { minHeight: 40, alignSelf: "stretch" } : undefined}
    >
      {li.toFixed(1)}
    </span>
  )
}

function FixtureBreakdown({
  fixture,
  currentPlayerId,
}: {
  fixture: LCFixture
  currentPlayerId: number | null
}) {
  const isCompleted = fixture.status === "completed"
  const [scoreRubber, setScoreRubber] = useState<{
    rubber: LCRubber
    homeLabel: string
    awayLabel: string
  } | null>(null)

  // Build a map of existing rubbers by category
  const rubberByCategory = new Map<string, LCRubber>()
  for (const r of fixture.rubbers) {
    rubberByCategory.set(r.category, r)
  }

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
        {/* Header — team names + form dots */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5 max-[360px]:px-2.5 max-[360px]:py-2">
          {/* Home side */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-slate-700 max-[360px]:text-[9px]">
                {fixture.homeName}
              </span>
            </div>
            <FormDots items={fixture.homeFormItems} align="left" />
          </div>

          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 max-[360px]:text-[8px]">Score</span>

          {/* Away side */}
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-right text-[10px] font-bold uppercase tracking-[0.06em] text-slate-700 max-[360px]:text-[9px]">
                {fixture.awayName}
              </span>
            </div>
            <FormDots items={fixture.awayFormItems} align="right" />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {Object.keys(fixture.courtInfoByCategory)
            .sort((a, b) =>
              categorySortRank(a) - categorySortRank(b) ||
              slotTimeValue(fixture.courtInfoByCategory[a]?.time) - slotTimeValue(fixture.courtInfoByCategory[b]?.time) ||
              courtSortValue(fixture.courtInfoByCategory[b]?.court) - courtSortValue(fixture.courtInfoByCategory[a]?.court) ||
              a.localeCompare(b),
            )
            .map((category) => {
            const rubber = rubberByCategory.get(category)
            const homePair = fixture.homePlayers?.[category] ?? []
            const awayPair = fixture.awayPlayers?.[category] ?? []
            const homePlayerLabel = homePair.length > 0
              ? homePair.map((player) => player.name).join(" / ")
              : (fixture.homeName ?? "Home")
            const awayPlayerLabel = awayPair.length > 0
              ? awayPair.map((player) => player.name).join(" / ")
              : (fixture.awayName ?? "Away")
            const homeWon = rubber?.winnerTeamId != null && rubber.winnerTeamId === fixture.homeTeamId
            const awayWon = rubber?.winnerTeamId != null && rubber.winnerTeamId === fixture.awayTeamId
            const hasScore = !!rubber && isCompleted
            const homePairRating = averagePairRating(homePair)
            const awayPairRating = averagePairRating(awayPair)

            // iMyRubber: true when rubber has player assigned, OR when no pairings exist yet
            // but the fixture belongs to the current player's team (fixture.mine).
            const assignedIds = rubber
              ? [...(rubber.homePlayerIds ?? []), ...(rubber.awayPlayerIds ?? [])]
              : []
            const iMyRubber =
              currentPlayerId != null
                ? assignedIds.includes(currentPlayerId) || (assignedIds.length === 0 && fixture.mine)
                : fixture.mine

            const categoryJoinUrl = linkForCategory(fixture.joinUrlByCategory, category)
            const courtInfo = fixture.courtInfoByCategory?.[category]
            const visibleCategoryBelongsToMine =
              fixture.canSeeBookingLinks &&
              // For your own fixture, show published category links even if pairing
              // assignment IDs are stale/mismatched for this user.
              (!fixture.mine || iMyRubber || fixture.myCategories.includes(category) || fixture.mine)
            const showJoin = !isCompleted && !!categoryJoinUrl && visibleCategoryBelongsToMine
            const showScore = fixture.canSubmitAllCategories || (fixture.canSubmitResult && iMyRubber)
            const rubberPoints = computeRubberTeamPoints(rubber)
            const homeRubberPoints = rubberPoints.home
            const awayRubberPoints = rubberPoints.away
            const homeRubberScoreClass = homeRubberPoints > awayRubberPoints ? "lc-score-win" : "lc-score-neutral"
            const awayRubberScoreClass = awayRubberPoints > homeRubberPoints ? "lc-score-win" : "lc-score-neutral"
            const homeCategoryResult: "W" | "L" | "D" =
              homeRubberPoints > awayRubberPoints ? "W" : homeRubberPoints < awayRubberPoints ? "L" : "D"
            const awayCategoryResult: "W" | "L" | "D" =
              awayRubberPoints > homeRubberPoints ? "W" : awayRubberPoints < homeRubberPoints ? "L" : "D"

            return (
              <div key={category} className="px-3 py-2.5 max-[360px]:px-2.5 max-[360px]:py-2">
                {/* Players vs Score vs Players */}
                <div className="grid grid-cols-[minmax(0,1fr)_86px_minmax(0,1fr)] items-center gap-1.5 max-[360px]:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] max-[360px]:gap-1 md:grid-cols-[1fr_104px_1fr] md:gap-3">
                  {/* Home pair */}
                  <div className="min-w-0 space-y-0.5">
                    {homePair.length > 0 ? (
                      <div className="flex min-w-0 items-center gap-2">
                        {homePairRating != null && (
                          <LiBadge li={homePairRating} tall />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          {homePair.map((player) => (
                            <p
                              key={player.name}
                              className={cn(
                                "text-[10px] font-semibold leading-tight [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden max-[360px]:text-[9px] md:text-xs",
                                hasScore && awayWon ? "text-slate-400" : "text-slate-800",
                              )}
                            >
                              {player.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">TBD</p>
                    )}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {hasScore ? (
                        <CategoryDot
                          result={homeCategoryResult}
                          opponent={awayPlayerLabel}
                          scoreLabel={rubber?.scoreDetail ?? null}
                          align="left"
                        />
                      ) : (
                        <FormDots items={fixture.homeFormItems} align="left" />
                      )}
                    </div>
                  </div>

                  {/* Score / vs */}
                  <div className="flex self-stretch flex-col items-center justify-center gap-1 tabular-nums">
                    <div className="flex min-h-[2.2rem] flex-col items-center justify-center gap-0.5">
                      <span className="max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-black max-[360px]:px-1 max-[360px]:text-[8px]">
                        {category}
                      </span>
                      {(courtInfo?.court || courtInfo?.time) && (
                        <span className="text-[9px] font-medium leading-tight text-slate-500 max-[360px]:text-[8px]">
                          {courtInfo.court ? `Court ${courtInfo.court}` : ""}
                          {courtInfo.court && courtInfo.time ? " · " : ""}
                          {courtInfo.time ?? ""}
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-[1.25rem] items-center gap-1.5">
                      {hasScore ? (
                        <>
                          <span className={cn("text-base font-extrabold max-[360px]:text-sm", homeRubberScoreClass)}>
                            {homeRubberPoints}
                          </span>
                          <span className="text-xs text-slate-300">-</span>
                          <span className={cn("text-base font-extrabold max-[360px]:text-sm", awayRubberScoreClass)}>
                            {awayRubberPoints}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-slate-300">vs</span>
                      )}
                    </div>
                    {rubber?.scoreDetail ? renderScoreDetail(rubber.scoreDetail) : null}
                    {(showJoin || showScore) && (
                      <div className="mt-0 hidden flex-col items-center gap-1 md:flex">
                        {showJoin && (
                          <a
                            href={categoryJoinUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Join Match
                          </a>
                        )}
                        {showScore && (
                          <button
                            onClick={() =>
                              setScoreRubber(
                                {
                                  rubber: rubber ?? {
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
                                  },
                                  homeLabel: homePlayerLabel,
                                  awayLabel: awayPlayerLabel,
                                },
                              )
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                              isCompleted
                                ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                : "border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50",
                            )}
                          >
                            {isCompleted ? "Edit Score" : "Enter Score"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Away pair */}
                  <div className="min-w-0 space-y-0.5 text-right">
                    {awayPair.length > 0 ? (
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        <div className="min-w-0 space-y-0.5">
                          {awayPair.map((player) => (
                            <p
                              key={player.name}
                              className={cn(
                                "text-[10px] font-semibold leading-tight [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden max-[360px]:text-[9px] md:text-xs",
                                hasScore && homeWon ? "text-slate-400" : "text-slate-800",
                              )}
                            >
                              {player.name}
                            </p>
                          ))}
                        </div>
                        {awayPairRating != null && (
                          <LiBadge li={awayPairRating} tall />
                        )}
                      </div>
                    ) : (
                      <p className="text-right text-xs text-slate-400">TBD</p>
                    )}
                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      {hasScore ? (
                        <CategoryDot
                          result={awayCategoryResult}
                          opponent={homePlayerLabel}
                          scoreLabel={rubber?.scoreDetail ?? null}
                          align="right"
                        />
                      ) : (
                        <FormDots items={fixture.awayFormItems} align="right" />
                      )}
                    </div>
                  </div>
                </div>

                {(showJoin || showScore) && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 md:hidden">
                    {showJoin && (
                      <a
                        href={categoryJoinUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Join Match
                      </a>
                    )}
                    {showScore && (
                      <button
                        onClick={() =>
                          setScoreRubber(
                            {
                              rubber: rubber ?? {
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
                              },
                              homeLabel: homePlayerLabel,
                              awayLabel: awayPlayerLabel,
                            },
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          isCompleted
                            ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            : "border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50",
                        )}
                      >
                        {isCompleted ? "Edit Score" : "Enter Score"}
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
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Enter Score · {scoreRubber?.rubber.category}</DialogTitle>
          </DialogHeader>
          {scoreRubber && (
            <ResultEntry
              fixtureId={fixture.id}
              homeName={scoreRubber.homeLabel}
              awayName={scoreRubber.awayLabel}
              categories={[{
                category: scoreRubber.rubber.category,
                session: scoreRubber.rubber.session,
                isFeatureCourt: scoreRubber.rubber.isFeatureCourt,
              }]}
              isEdit={isCompleted}
              allowClear={isCompleted}
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

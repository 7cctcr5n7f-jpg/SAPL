"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { LeagueCentreData, LCFixture } from "@/lib/queries-league-centre"
import type { CurrentUser } from "@/lib/session"
import { CATEGORY_RULES } from "@/lib/constants"
import { ChevronLeft, ChevronRight, ExternalLink, Clock } from "lucide-react"
import Link from "next/link"

interface MatchCentreSportsProps {
  data: LeagueCentreData
  user: CurrentUser | null
}

export function MatchCentreSports({ data, user }: MatchCentreSportsProps) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)

  // Compute all weeks from fixtures
  const allWeeks = useMemo(() => {
    const weeks = new Set<number>()
    data.fixtures.forEach((f) => weeks.add(f.week))
    return Array.from(weeks).sort((a, b) => a - b)
  }, [data.fixtures])

  // Default to first week if not selected
  const activeWeek = selectedWeek ?? allWeeks[0] ?? 1

  // Filter fixtures by selected week and sort by date
  const weekFixtures = useMemo(
    () =>
      data.fixtures
        .filter((f) => f.week === activeWeek)
        .sort((a, b) => (a.matchDate && b.matchDate ? new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() : 0)),
    [data.fixtures, activeWeek],
  )

  // Group fixtures by category (distribute across all categories)
  const fixturesByCategory = useMemo(() => {
    const grouped: Record<string, LCFixture[]> = {}

    // Initialize all categories
    CATEGORY_RULES.forEach((rule) => {
      grouped[rule.name] = []
    })

    // Distribute fixtures across categories evenly
    weekFixtures.forEach((fixture, idx) => {
      const categoryIndex = idx % CATEGORY_RULES.length
      const categoryName = CATEGORY_RULES[categoryIndex]?.name
      if (categoryName) {
        grouped[categoryName].push(fixture)
      }
    })

    return grouped
  }, [weekFixtures])

  return (
    <div style={{ backgroundColor: "rgb(245, 248, 255)" }} className="py-6 md:py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Match Centre</h2>
          {data.season && (
            <p className="mt-1 text-sm text-muted-foreground">
              {data.season.name} • Week {activeWeek}
              {data.season.weeks && ` of ${data.season.weeks}`}
            </p>
          )}
        </div>

        {/* Week Selector */}
        {allWeeks.length > 0 && (
          <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => {
                const idx = allWeeks.indexOf(activeWeek)
                if (idx > 0) setSelectedWeek(allWeeks[idx - 1])
              }}
              disabled={activeWeek === allWeeks[0]}
              className="shrink-0 p-2 rounded-lg border border-border hover:bg-white disabled:opacity-50 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex gap-2 overflow-x-auto">
              {allWeeks.map((week) => (
                <button
                  key={week}
                  onClick={() => setSelectedWeek(week)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-lg border font-semibold whitespace-nowrap transition-colors",
                    week === activeWeek ? "bg-red-600 text-white border-red-600" : "bg-white border-border hover:border-red-600 text-foreground",
                  )}
                >
                  Week {week}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const idx = allWeeks.indexOf(activeWeek)
                if (idx < allWeeks.length - 1) setSelectedWeek(allWeeks[idx + 1])
              }}
              disabled={activeWeek === allWeeks[allWeeks.length - 1]}
              className="shrink-0 p-2 rounded-lg border border-border hover:bg-white disabled:opacity-50 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Fixtures by Category — show ALL categories */}
        <div className="space-y-6">
          {CATEGORY_RULES.map((category) => {
            const categoryFixtures = fixturesByCategory[category.name] || []

            return (
              <section key={category.name} style={{ backgroundColor: "rgb(254, 254, 255)" }} className="rounded-xl border border-border overflow-hidden">
                {/* Category Header */}
                <div className="px-4 md:px-6 py-3 border-b border-border bg-gray-50">
                  <h3 className="text-lg font-bold">{category.name}</h3>
                </div>

                {/* Category Content */}
                <div className="divide-y divide-border">
                  {categoryFixtures.length > 0 ? (
                    categoryFixtures.map((fixture) => <FixtureCard key={fixture.id} fixture={fixture} user={user} />)
                  ) : (
                    <div className="px-4 md:px-6 py-8 text-center text-muted-foreground text-sm">
                      No matches scheduled for this category this week.
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface FixtureCardProps {
  fixture: LCFixture
  user: CurrentUser | null
}

function FixtureCard({ fixture, user }: FixtureCardProps) {
  const isPlaying = fixture.mine && user
  const hasJoinLink = !!fixture.joinUrl

  return (
    <div className="px-4 md:px-6 py-4 hover:bg-gray-25 transition-colors">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date/Time/Venue */}
        <div className="flex flex-col justify-center">
          {fixture.matchDate && (
            <div className="text-sm font-semibold text-foreground">
              {new Date(fixture.matchDate).toLocaleDateString("en-ZA", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
          )}
          {fixture.timeslot && <div className="text-sm text-muted-foreground">{fixture.timeslot}</div>}
          {fixture.venue && <div className="text-xs text-muted-foreground mt-1">{fixture.venue}</div>}
        </div>

        {/* Teams */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-center flex-1">
            <div className="font-bold text-base">{fixture.homeName || "TBD"}</div>
            {fixture.homeLogo && (
              <img
                src={fixture.homeLogo}
                alt={fixture.homeName ?? "Home team"}
                className="h-8 w-8 mx-auto mt-1 rounded-full object-cover"
              />
            )}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">vs</div>
          <div className="text-center flex-1">
            <div className="font-bold text-base">{fixture.awayName || "TBD"}</div>
            {fixture.awayLogo && (
              <img
                src={fixture.awayLogo}
                alt={fixture.awayName ?? "Away team"}
                className="h-8 w-8 mx-auto mt-1 rounded-full object-cover"
              />
            )}
          </div>
        </div>

        {/* Actions — visible only for players in this fixture */}
        <div className="flex flex-col gap-2 justify-center">
          {isPlaying ? (
            <>
              {hasJoinLink && fixture.joinUrl && (
                <a
                  href={fixture.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                >
                  Join Game
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {!hasJoinLink && (
                <button disabled className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-semibold cursor-not-allowed text-sm">
                  <Clock className="h-4 w-4" />
                  Link Soon
                </button>
              )}

              {fixture.status !== "completed" && (
                <Link
                  href={`/league-centre/match/${fixture.id}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors text-sm"
                >
                  Enter Score
                </Link>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">Not playing in this match</div>
          )}
        </div>
      </div>
    </div>
  )
}


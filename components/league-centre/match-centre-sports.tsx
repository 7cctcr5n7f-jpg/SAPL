"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { LeagueCentreData, LCFixture, LCMatchDetail } from "@/lib/queries-league-centre"
import type { CurrentUser } from "@/lib/session"
import { CATEGORY_RULES } from "@/lib/constants"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import { getMatchDetail } from "@/lib/queries-league-centre"

export async function LeagueCentreMatchCentre({ data, user }: { data: LeagueCentreData; user: CurrentUser | null }) {
  return <MatchCentreClient data={data} user={user} />
}

function MatchCentreClient({ data, user }: { data: LeagueCentreData; user: CurrentUser | null }) {
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

  // Group fixtures by category (using the rubbers/matches data if available)
  const fixturesByCategory = useMemo(() => {
    const grouped: Record<string, LCFixture[]> = {}
    CATEGORY_RULES.forEach((rule) => {
      grouped[rule.name] = []
    })

    // For now, distribute fixtures evenly across categories
    // In production, this would use match/rubber-level data to determine which categories play in each fixture
    const rubbersPerCategory = Math.ceil(weekFixtures.length / CATEGORY_RULES.length)
    let rubberIndex = 0

    CATEGORY_RULES.forEach((rule) => {
      for (let i = 0; i < rubbersPerCategory && rubberIndex < weekFixtures.length; i++) {
        grouped[rule.name].push(weekFixtures[rubberIndex])
        rubberIndex++
      }
    })

    return grouped
  }, [weekFixtures])

  if (!data.season) {
    return (
      <div className="max-w-6xl mx-auto rounded-xl border border-border bg-white p-8 text-center">
        <h2 className="text-2xl font-bold">No season active</h2>
        <p className="mt-2 text-muted-foreground">A season must be active to display fixtures.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Match Centre</h1>
        <p className="text-lg text-muted-foreground">
          {data.season.name} • Week {activeWeek} of {data.season.weeks}
        </p>
      </div>

      {/* Week Selector */}
      {allWeeks.length > 0 && (
        <div className="mb-8 flex items-center gap-4 overflow-x-auto pb-2">
          <button
            onClick={() => {
              const idx = allWeeks.indexOf(activeWeek)
              if (idx > 0) setSelectedWeek(allWeeks[idx - 1])
            }}
            disabled={activeWeek === allWeeks[0]}
            className="p-2 rounded-lg border border-border hover:bg-white disabled:opacity-50 shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2">
            {allWeeks.map((week) => (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={cn(
                  "px-4 py-2 rounded-lg border font-semibold whitespace-nowrap transition-colors shrink-0",
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
            className="p-2 rounded-lg border border-border hover:bg-white disabled:opacity-50 shrink-0"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Fixtures by Category */}
      <div className="space-y-8">
        {CATEGORY_RULES.map((category) => {
          const categoryFixtures = fixturesByCategory[category.name] || []

          return (
            <div key={category.name} style={{ background: "rgb(254, 254, 255)" }} className="rounded-xl border border-border p-6">
              <h2 className="text-2xl font-bold mb-4">{category.name}</h2>

              {categoryFixtures.length > 0 ? (
                <div className="space-y-3">
                  {categoryFixtures.map((fixture) => (
                    <FixtureCard key={fixture.id} fixture={fixture} user={user} category={category.name} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No matches scheduled for this category this week.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FixtureCard({ fixture, user, category }: { fixture: LCFixture; user: CurrentUser | null; category: string }) {
  const isPlaying = fixture.mine && user

  return (
    <div className="border border-border rounded-lg p-4 bg-white hover:border-red-600 transition-colors">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Match Info */}
        <div className="col-span-1">
          <div className="text-sm text-muted-foreground mb-1">
            {fixture.matchDate &&
              new Date(fixture.matchDate).toLocaleDateString("en-ZA", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            {fixture.timeslot && ` • ${fixture.timeslot}`}
          </div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">{fixture.venue}</div>
        </div>

        {/* Teams */}
        <div className="col-span-1 flex items-center justify-center">
          <div className="text-center">
            <div className="font-bold text-lg">{fixture.homeName || "TBD"}</div>
            <div className="text-sm text-muted-foreground my-1">vs</div>
            <div className="font-bold text-lg">{fixture.awayName || "TBD"}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="col-span-1 flex flex-col gap-2 justify-center">
          {fixture.joinUrl ? (
            <a
              href={fixture.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Join Game
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <button disabled className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg font-semibold cursor-not-allowed text-sm">
              Link Coming
            </button>
          )}

          {isPlaying && fixture.status !== "completed" && (
            <Link
              href={`/league-centre/match/${fixture.id}`}
              className="inline-flex items-center justify-center px-4 py-2 border border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors text-sm"
            >
              Enter Score
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

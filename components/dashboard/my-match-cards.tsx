"use client"

import { useEffect, useState } from "react"
import {
  CalendarDays,
  MapPin,
  ExternalLink,
  ClipboardEdit,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDate } from "@/lib/format"
import { ResultEntry } from "@/components/captain/result-entry"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DashboardFixture } from "@/lib/queries-fixtures"
import type { FixtureDetail, FixtureCategoryDetail } from "@/lib/queries-dashboard"

// ---------------------------------------------------------------------------
// MyMatchCards — shows every rubber the logged-in player is personally
// assigned to. Each card is self-contained: category, fixture context,
// partner + opponents, Join / Playtomic / Enter Score actions.
// ---------------------------------------------------------------------------

type MyMatch = {
  fixture: DashboardFixture
  cat: FixtureCategoryDetail
}

export function MyMatchCards({
  matches,
  details,
  isCaptain,
}: {
  matches: DashboardFixture[]
  details: Record<number, FixtureDetail>
  isCaptain: boolean
}) {
  // Collect only the rubbers where `isMine === true`.
  const myMatches: MyMatch[] = []
  for (const f of matches) {
    const detail = details[f.id]
    if (!detail) continue
    for (const cat of detail.categories) {
      if (cat.isMine) {
        myMatches.push({ fixture: f, cat })
      }
    }
  }

  if (myMatches.length === 0) return null

  // Sort: upcoming/awaiting first (by date), completed last.
  const sorted = [...myMatches].sort((a, b) => {
    const aDate = a.fixture.matchDate ? Date.parse(String(a.fixture.matchDate)) : Infinity
    const bDate = b.fixture.matchDate ? Date.parse(String(b.fixture.matchDate)) : Infinity
    const aCompleted = a.fixture.status === "completed" ? 1 : 0
    const bCompleted = b.fixture.status === "completed" ? 1 : 0
    if (aCompleted !== bCompleted) return aCompleted - bCompleted
    return aDate - bDate
  })

  return (
    <section className="mb-6">
      <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        My Matches
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map(({ fixture: f, cat }) => (
          <MatchCard key={`${f.id}-${cat.category}`} fixture={f} cat={cat} isCaptain={isCaptain} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function MatchCard({
  fixture,
  cat,
  isCaptain,
}: {
  fixture: DashboardFixture
  cat: FixtureCategoryDetail
  isCaptain: boolean
}) {
  const [scoreOpen, setScoreOpen] = useState(false)
  const [nowTs, setNowTs] = useState(0)

  useEffect(() => {
    const initTimer = window.setTimeout(() => setNowTs(Date.now()), 0)
    const minuteTicker = window.setInterval(() => setNowTs(Date.now()), 60_000)
    return () => {
      window.clearTimeout(initTimer)
      window.clearInterval(minuteTicker)
    }
  }, [])

  const isCompleted = fixture.status === "completed"
  const hasScore = isCompleted && cat.homeSetsWon != null && cat.awaySetsWon != null
  const awaiting = !isCompleted && nowTs > 0 && fixture.matchDate && Date.parse(String(fixture.matchDate)) < nowTs

  const venueName = fixture.venueClubName ?? fixture.venue
  const opponentTeam = fixture.awayName ?? fixture.homeName ?? "TBD"

  // Determine win / loss for completed rubbers.
  const myTeamId = fixture.mine ? fixture.homeTeamId : fixture.awayTeamId
  const won = hasScore && cat.winnerTeamId != null && cat.winnerTeamId === myTeamId

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
          isCompleted ? "border-border" : "border-primary/30 bg-primary/[0.02]",
          awaiting && "border-amber-500/40 bg-amber-500/[0.02]",
        )}
      >
        {/* Top row: category pill + status */}
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {cat.category}
          </span>

          {isCompleted ? (
            <span
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                won
                  ? "bg-green-500/15 text-green-600"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              {won ? "Won" : "Completed"}
            </span>
          ) : awaiting ? (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Score needed
            </span>
          ) : (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Upcoming
            </span>
          )}
        </div>

        {/* Fixture meta */}
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">
            vs {opponentTeam}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {fmtDate(fixture.matchDate) ?? "TBD"}
              {fixture.timeslot ? ` · ${fixture.timeslot}` : ""}
            </span>
            {venueName && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[12rem] truncate">{venueName}</span>
              </span>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 font-semibold text-foreground">You</span>
            <span className="text-muted-foreground">&amp;</span>
            <span className="font-medium text-foreground">
              {cat.partner ?? <span className="italic text-muted-foreground">Partner TBD</span>}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-12 shrink-0 font-semibold text-muted-foreground">vs</span>
            <span className="font-medium text-foreground">
              {cat.opponents.length > 0
                ? cat.opponents.join(" & ")
                : <span className="italic text-muted-foreground">Opponents TBD</span>}
            </span>
          </div>
          {hasScore && (
            <div className="mt-2 border-t border-border pt-2 font-mono text-sm font-bold tabular-nums">
              <span className={cn(won ? "text-green-600" : "text-foreground")}>
                {cat.homeSetsWon}
              </span>
              <span className="mx-1 text-muted-foreground">–</span>
              <span className={cn(!won ? "text-primary" : "text-foreground")}>
                {cat.awaySetsWon}
              </span>
              {cat.scoreDetail && (
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">{cat.scoreDetail}</span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isCompleted && cat.courtLink && (
            // After score is entered, show Playtomic link so player can view the game
            <a
              href={cat.courtLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Playtomic
            </a>
          )}
          {!isCompleted && cat.courtLink && (
            <a
              href={cat.courtLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Join Match
            </a>
          )}
          {!isCompleted && !cat.courtLink && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Link coming soon
            </span>
          )}
          {(awaiting || (isCaptain && !isCompleted)) && (
            <button
              onClick={() => setScoreOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-500"
            >
              <ClipboardEdit className="h-3.5 w-3.5" />
              Enter Score
            </button>
          )}
        </div>
      </div>

      {/* Inline score dialog */}
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Score · {cat.category}</DialogTitle>
          </DialogHeader>
          <ResultEntry
            fixtureId={fixture.id}
            homeName={fixture.homeName ?? "Home"}
            awayName={fixture.awayName ?? "Away"}
            categories={[
              {
                category: cat.category,
                session: 1,
                isFeatureCourt: cat.isFeatureCourt,
              },
            ]}
            onDone={() => setScoreOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

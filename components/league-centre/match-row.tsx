"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCFixture } from "@/lib/queries-league-centre"
import { MapPin, ExternalLink, Radio, ChevronRight } from "lucide-react"

function timeLabel(iso: string | null, timeslot: string | null) {
  if (timeslot) return timeslot
  if (!iso) return "TBD"
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
}

function shortDate(iso: string | null) {
  if (!iso) return "TBD"
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short" }).format(new Date(iso))
}

/**
 * Dense, single-row representation of a fixture — modelled on live-score apps.
 * Left rail shows date/time (or status), the centre stacks the two teams with
 * scores, and the right edge surfaces the primary action (join / details).
 */
export function MatchRow({ fixture, showMeta = false }: { fixture: LCFixture; showMeta?: boolean }) {
  const isCompleted = fixture.status === "completed"
  const isLive = fixture.status === "live"
  const homeWon = fixture.winnerTeamId != null && fixture.winnerTeamId === fixture.homeTeamId
  const awayWon = fixture.winnerTeamId != null && fixture.winnerTeamId === fixture.awayTeamId
  const hasScore = isCompleted || isLive

  const href = isCompleted ? `/league-centre/match/${fixture.id}` : undefined

  const body = (
    <div
      className={cn(
        "group flex items-stretch gap-3 px-3 py-2.5 transition-colors",
        fixture.mine && "bg-primary/[0.04]",
        href && "hover:bg-secondary/60",
      )}
    >
      {/* Left rail: status / kickoff */}
      <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-border pr-3 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
        ) : isCompleted ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">FT</span>
        ) : (
          <>
            <span className="text-[11px] font-semibold leading-tight tabular-nums">
              {timeLabel(fixture.matchDate, fixture.timeslot)}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">{shortDate(fixture.matchDate)}</span>
          </>
        )}
      </div>

      {/* Teams */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div className="flex items-center gap-2">
          <Crest name={fixture.homeName} logoUrl={fixture.homeLogo} size="sm" />
          <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", awayWon && "text-muted-foreground")}>
            {fixture.homeName ?? "TBD"}
          </span>
          {hasScore ? (
            <span className={cn("heading w-6 text-right text-base tabular-nums", homeWon ? "text-primary" : "text-foreground")}>
              {fixture.homePoints ?? 0}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Crest name={fixture.awayName} logoUrl={fixture.awayLogo} size="sm" />
          <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", homeWon && "text-muted-foreground")}>
            {fixture.awayName ?? "TBD"}
          </span>
          {hasScore ? (
            <span className={cn("heading w-6 text-right text-base tabular-nums", awayWon ? "text-primary" : "text-foreground")}>
              {fixture.awayPoints ?? 0}
            </span>
          ) : null}
        </div>
        {showMeta && (fixture.divisionName || fixture.venue) ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {fixture.divisionName ? <span className="truncate">{fixture.divisionName}</span> : null}
            {fixture.venue ? (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3" />
                {fixture.venue}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Right action */}
      <div className="flex shrink-0 items-center">
        {!isCompleted && fixture.assignedToFixture && fixture.joinUrl ? (
          <a
            href={fixture.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            Join
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : href ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        ) : null}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    )
  }
  return body
}

/** A divider row for grouping matches (e.g. by week or date). */
export function MatchGroupHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-secondary/50 px-3 py-1.5">
      <span className="heading text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {sub ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

/** Wraps a set of rows in a bordered, divided container. */
export function MatchList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-lg border border-border bg-card", className)}>
      {children}
    </div>
  )
}

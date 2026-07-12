"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
import type { LCFixture } from "@/lib/queries-league-centre"
import { MapPin, Clock, ExternalLink, Radio } from "lucide-react"

const STATUS_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  planned: { label: "Planned", className: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground" },
  scheduled: { label: "Scheduled", className: "bg-secondary text-foreground", dot: "bg-foreground" },
  live: { label: "Live", className: "bg-primary text-primary-foreground", dot: "bg-primary-foreground" },
  completed: { label: "Full Time", className: "bg-foreground text-background", dot: "bg-background" },
}

function dayLabel(iso: string | null) {
  if (!iso) return "Date TBD"
  const d = new Date(iso)
  return new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long" }).format(d)
}

function timeLabel(iso: string | null, timeslot: string | null) {
  if (timeslot) return timeslot
  if (!iso) return "TBD"
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
}

function useCountdown(iso: string | null) {
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    if (!iso) return
    function tick() {
      const diff = new Date(iso as string).getTime() - Date.now()
      if (diff <= 0) {
        setLabel(null)
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      if (days >= 1) setLabel(`${days} Day${days > 1 ? "s" : ""} To Go`)
      else if (hours >= 1) setLabel(`${hours}h ${mins}m To Go`)
      else setLabel(`${mins}m To Go`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [iso])
  return label
}

export function MatchCard({ fixture }: { fixture: LCFixture }) {
  const status = STATUS_STYLES[fixture.status] ?? STATUS_STYLES.scheduled
  const countdown = useCountdown(fixture.status === "completed" ? null : fixture.matchDate)
  const isCompleted = fixture.status === "completed"
  const isLive = fixture.status === "live"
  const homeWon = fixture.winnerTeamId != null && fixture.winnerTeamId === fixture.homeTeamId
  const awayWon = fixture.winnerTeamId != null && fixture.winnerTeamId === fixture.awayTeamId

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-colors",
        isLive ? "border-primary/60" : "hover:border-primary/40",
      )}
    >
      {/* branded corner accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rotate-45 bg-primary/10"
      />

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {fixture.regionName ? <span className="truncate">{fixture.regionName}</span> : null}
          {fixture.divisionName ? (
            <>
              <span className="text-border">/</span>
              <span className="truncate text-foreground">{fixture.divisionName}</span>
            </>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
            status.className,
          )}
        >
          {isLive ? <Radio className="h-3 w-3 animate-pulse" /> : <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />}
          {status.label}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 text-center">
            <Crest name={fixture.homeName} logoUrl={fixture.homeLogo} size="lg" />
            <span className={cn("line-clamp-2 text-sm font-semibold", awayWon && "text-muted-foreground")}>
              {fixture.homeName ?? "TBD"}
            </span>
          </div>

          {/* Centre: score or VS */}
          <div className="flex flex-col items-center gap-1 px-1">
            {isCompleted || isLive ? (
              <div className="flex items-center gap-2 tabular-nums">
                <span className={cn("heading text-3xl", homeWon ? "text-primary" : "text-foreground")}>
                  {fixture.homePoints ?? 0}
                </span>
                <span className="text-muted-foreground">-</span>
                <span className={cn("heading text-3xl", awayWon ? "text-primary" : "text-foreground")}>
                  {fixture.awayPoints ?? 0}
                </span>
              </div>
            ) : (
              <span className="heading text-2xl text-muted-foreground">VS</span>
            )}
            {countdown ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {countdown}
              </span>
            ) : null}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 text-center">
            <Crest name={fixture.awayName} logoUrl={fixture.awayLogo} size="lg" />
            <span className={cn("line-clamp-2 text-sm font-semibold", homeWon && "text-muted-foreground")}>
              {fixture.awayName ?? "TBD"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {dayLabel(fixture.matchDate)} &middot; {timeLabel(fixture.matchDate, fixture.timeslot)}
          </span>
          {fixture.venue ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {fixture.venue}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {isCompleted ? (
            <Link
              href={`/league-centre/match/${fixture.id}`}
              className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
            >
              View Match Details
            </Link>
          ) : (
            <span className="text-[11px] uppercase tracking-wider">Week {fixture.week}</span>
          )}

          {fixture.assignedToFixture && fixture.joinUrl ? (
            <a
              href={fixture.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              Join On Playtomic
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : fixture.assignedToFixture && fixture.mine && !isCompleted ? (
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Booking link pending</span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

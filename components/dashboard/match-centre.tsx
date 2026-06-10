"use client"

import Link from "next/link"
import type { LCFixture } from "@/lib/queries-league-centre"
import type { FixtureDetail } from "@/lib/queries-dashboard"
import { Crest } from "@/components/league-centre/crest"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowRight, ExternalLink, ClipboardEdit, Eye, ChevronRight } from "lucide-react"

// ---------------------------------------------------------------------------
// Player Match Centre — a dense, sports-app style view of the player's own
// fixtures (Flashscore/Sofascore feel). Sections: To Do (actions required) and
// Team Fixtures (compact, static rows that link to the fixture detail page).
// ---------------------------------------------------------------------------

type FixtureGroup = "upcoming" | "awaiting" | "completed" | "disputed"

/** Bucket a fixture into one of the player-facing groups. */
function groupOf(f: LCFixture): FixtureGroup {
  if (f.status === "completed") return "completed"
  // Anything past kickoff with no result is treated as "awaiting score".
  const kickoff = f.matchDate ? Date.parse(f.matchDate) : null
  if (kickoff != null && kickoff < Date.now()) return "awaiting"
  return "upcoming"
}

function fmtParts(iso: string | null, timeslot: string | null) {
  if (!iso) return { day: "Date TBD", time: timeslot ?? "TBD" }
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "2-digit", month: "short" }).format(d)
  const time =
    timeslot ?? new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return { day, time }
}

const STATUS_LABEL: Record<FixtureGroup, string> = {
  upcoming: "Upcoming",
  awaiting: "Awaiting Score",
  completed: "Completed",
  disputed: "Disputed",
}

function StatusBadge({ group, className }: { group: FixtureGroup; className?: string }) {
  const styles: Record<FixtureGroup, string> = {
    upcoming: "bg-primary/10 text-primary",
    awaiting: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
    completed: "bg-secondary text-muted-foreground",
    disputed: "bg-destructive/15 text-destructive",
  }
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        styles[group],
        className,
      )}
    >
      {STATUS_LABEL[group]}
    </span>
  )
}

// --- Action buttons --------------------------------------------------------

function JoinButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
    >
      Join Match
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

function ScoreButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-500"
    >
      <ClipboardEdit className="h-3 w-3" />
      {label}
    </Link>
  )
}

// --- Compact fixture row (static link to the fixture detail page) ----------

function FixtureRow({ f }: { f: LCFixture }) {
  const group = groupOf(f)
  const { day, time } = fmtParts(f.matchDate, f.timeslot)
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const awayWon = f.winnerTeamId != null && f.winnerTeamId === f.awayTeamId
  const hasScore = group === "completed" || group === "disputed"

  return (
    <Link
      href={`/league-centre/match/${f.id}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40"
    >
      {/* Date / time */}
      <div className="flex w-16 shrink-0 flex-col">
        <span className="text-xs font-bold tabular-nums">{day}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{time}</span>
      </div>

      {/* Teams */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Crest name={f.homeName} logoUrl={f.homeLogo} size="sm" />
          <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", awayWon && "text-muted-foreground")}>
            {f.homeName ?? "TBD"}
          </span>
          {hasScore ? (
            <span className={cn("tabular-nums", homeWon && "font-bold text-primary")}>{f.homePoints ?? 0}</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Crest name={f.awayName} logoUrl={f.awayLogo} size="sm" />
          <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", homeWon && "text-muted-foreground")}>
            {f.awayName ?? "TBD"}
          </span>
          {hasScore ? (
            <span className={cn("tabular-nums", awayWon && "font-bold text-primary")}>{f.awayPoints ?? 0}</span>
          ) : null}
        </div>
      </div>

      {/* Status + chevron */}
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge group={group} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  )
}

// --- Main ------------------------------------------------------------------

export function MatchCentre({
  matches,
  isCaptain,
  captainHref = "/dashboard/captain",
}: {
  matches: LCFixture[]
  // Kept for API compatibility with the dashboard page; pairing detail is now
  // viewed on the fixture detail page rather than inline.
  details?: Record<number, FixtureDetail>
  isCaptain: boolean
  captainHref?: string
}) {
  const sorted = [...matches].sort((a, b) => (a.matchDate ?? "").localeCompare(b.matchDate ?? ""))
  const upcoming = sorted.filter((m) => groupOf(m) === "upcoming")
  const awaiting = sorted.filter((m) => groupOf(m) === "awaiting")
  const disputed = sorted.filter((m) => groupOf(m) === "disputed")
  const completed = sorted.filter((m) => groupOf(m) === "completed").reverse()

  // To Do: every non-completed match the player still needs to join (has a join
  // link), regardless of whether kickoff has passed, plus score actions for captains.
  const joinActions = sorted.filter((m) => groupOf(m) !== "completed" && m.joinUrl)
  const scoreActions = isCaptain ? [...awaiting, ...disputed] : []
  const hasActions = joinActions.length > 0 || scoreActions.length > 0

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p>No scheduled matches yet. Your fixtures appear here once the season draw is published.</p>
        <Link href="/league-centre" className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
          Explore the League Centre <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* SECTION 1 — To Do (actions required) */}
      {hasActions && (
        <section>
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            To Do
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/[0.03]">
            {scoreActions.map((f) => (
              <ActionItem
                key={`score-${f.id}`}
                title={groupOf(f) === "disputed" ? "Resolve Dispute" : "Submit Score"}
                detail={`${f.homeName ?? "TBD"} vs ${f.awayName ?? "TBD"}`}
                action={<ScoreButton href={captainHref} label="Open" />}
              />
            ))}
            {joinActions.map((f) => (
              <ActionItem
                key={`join-${f.id}`}
                title="Join Match"
                detail={`${f.homeName ?? "TBD"} vs ${f.awayName ?? "TBD"} · ${fmtParts(f.matchDate, f.timeslot).day}`}
                action={f.joinUrl ? <JoinButton url={f.joinUrl} /> : null}
              />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2 — Team Fixtures (compact, static rows) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Team Fixtures</h2>
          <Link href="/league-centre" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            League Centre <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {awaiting.length > 0 && (
            <FixtureGroupList label="Awaiting Score" count={awaiting.length}>
              {awaiting.map((f) => (
                <FixtureRow key={f.id} f={f} />
              ))}
            </FixtureGroupList>
          )}
          {disputed.length > 0 && (
            <FixtureGroupList label="Disputed" count={disputed.length}>
              {disputed.map((f) => (
                <FixtureRow key={f.id} f={f} />
              ))}
            </FixtureGroupList>
          )}
          {upcoming.length > 0 && (
            <FixtureGroupList label="Upcoming" count={upcoming.length}>
              {upcoming.map((f) => (
                <FixtureRow key={f.id} f={f} />
              ))}
            </FixtureGroupList>
          )}
          {completed.length > 0 && (
            <FixtureGroupList label="Completed" count={completed.length}>
              {completed.slice(0, 6).map((f) => (
                <FixtureRow key={f.id} f={f} />
              ))}
            </FixtureGroupList>
          )}
        </div>
      </section>
    </div>
  )
}

function ActionItem({ title, detail, action }: { title: string; detail: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function FixtureGroupList({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between bg-secondary/50 px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{count}</span>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

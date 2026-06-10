"use client"

import { useState } from "react"
import Link from "next/link"
import type { LCFixture } from "@/lib/queries-league-centre"
import type { FixtureDetail, FixtureCategoryDetail } from "@/lib/queries-dashboard"
import { Crest } from "@/components/league-centre/crest"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  MapPin,
  ClipboardEdit,
  Eye,
  ChevronDown,
  Users,
  Clock,
  CalendarDays,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Player Match Centre — a dense, sports-app style view of the player's own
// fixtures (Flashscore/Sofascore feel). Sections: Actions Required, Next Match,
// My Fixtures (expandable per-category rows). Replaces the old card-heavy view.
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

function JoinButton({ url, full = false }: { url: string; full?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90",
        full && "w-full px-4 py-2.5 text-xs",
      )}
    >
      Join Match
      <ExternalLink className={cn("h-3 w-3", full && "h-3.5 w-3.5")} />
    </a>
  )
}

function ViewButton({ id, full = false }: { id: number; full?: boolean }) {
  return (
    <Link
      href={`/league-centre/match/${id}`}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-secondary",
        full && "w-full px-4 py-2.5 text-xs",
      )}
    >
      <Eye className={cn("h-3 w-3", full && "h-3.5 w-3.5")} />
      View Fixture
    </Link>
  )
}

function ScoreButton({ href, label, full = false }: { href: string; label: string; full?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-500",
        full && "w-full px-4 py-2.5 text-xs",
      )}
    >
      <ClipboardEdit className={cn("h-3 w-3", full && "h-3.5 w-3.5")} />
      {label}
    </Link>
  )
}

// --- Per-category detail ---------------------------------------------------

function MatchActions({
  cat,
  group,
  fixtureJoinUrl,
  canSubmit,
  captainHref,
  fixtureId,
}: {
  cat: FixtureCategoryDetail
  group: FixtureGroup
  fixtureJoinUrl: string | null
  canSubmit: boolean
  captainHref: string
  fixtureId: number
}) {
  const join = cat.courtLink ?? fixtureJoinUrl
  if (group === "completed" || group === "disputed") {
    return <ViewButton id={fixtureId} />
  }
  if (group === "awaiting") {
    return canSubmit ? <ScoreButton href={captainHref} label="Submit Score" /> : <ViewButton id={fixtureId} />
  }
  return join ? <JoinButton url={join} /> : null
}

function CategoryRow({
  cat,
  group,
  fixtureJoinUrl,
  canSubmit,
  captainHref,
  fixtureId,
}: {
  cat: FixtureCategoryDetail
  group: FixtureGroup
  fixtureJoinUrl: string | null
  canSubmit: boolean
  captainHref: string
  fixtureId: number
}) {
  const hasLineup = cat.homePlayers.length > 0 || cat.awayPlayers.length > 0
  const played = cat.scoreDetail != null || cat.homeSetsWon != null

  return (
    <div className={cn("px-3 py-3", cat.isMine && "bg-primary/[0.04]")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold">{cat.category}</span>
          {cat.isFeatureCourt ? (
            <span className="rounded bg-secondary px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Feature
            </span>
          ) : null}
          {cat.isMine ? (
            <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
              My Match
            </span>
          ) : null}
        </div>
        {played && (cat.homeSetsWon != null || cat.awaySetsWon != null) ? (
          <span className="font-mono text-xs font-bold tabular-nums">
            {cat.homeSetsWon ?? 0}&ndash;{cat.awaySetsWon ?? 0}
          </span>
        ) : null}
      </div>

      {/* Player detail. If the player is in this category, show partner/opponents;
          otherwise show both line-ups. Falls back to a hint when unset. */}
      {cat.isMine ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-muted-foreground">Partner</p>
            <p className="font-medium">{cat.partner ?? "To be confirmed"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Opponents</p>
            <p className="font-medium">{cat.opponents.length ? cat.opponents.join(" & ") : "To be confirmed"}</p>
          </div>
        </div>
      ) : hasLineup ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <p className="truncate font-medium">{cat.homePlayers.join(" & ") || "TBC"}</p>
          <p className="truncate text-right font-medium">{cat.awayPlayers.join(" & ") || "TBC"}</p>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Line-up to be confirmed by the captain.</p>
      )}

      {cat.scoreDetail ? (
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">{cat.scoreDetail}</p>
      ) : null}

      <div className="mt-2 flex justify-end">
        <MatchActions
          cat={cat}
          group={group}
          fixtureJoinUrl={fixtureJoinUrl}
          canSubmit={canSubmit}
          captainHref={captainHref}
          fixtureId={fixtureId}
        />
      </div>
    </div>
  )
}

// --- Fixture row (expandable) ---------------------------------------------

function FixtureRow({
  f,
  detail,
  canSubmit,
  captainHref,
  defaultOpen = false,
}: {
  f: LCFixture
  detail: FixtureDetail | undefined
  canSubmit: boolean
  captainHref: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const group = groupOf(f)
  const { day, time } = fmtParts(f.matchDate, f.timeslot)
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const awayWon = f.winnerTeamId != null && f.winnerTeamId === f.awayTeamId
  const hasScore = group === "completed" || group === "disputed"
  const cats = detail?.categories ?? []

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
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
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open ? (
        <div className="border-t border-border bg-background/40">
          {f.venue ? (
            <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {f.venue}
            </p>
          ) : null}
          {cats.length ? (
            <div className="divide-y divide-border">
              {cats.map((cat) => (
                <CategoryRow
                  key={cat.category}
                  cat={cat}
                  group={group}
                  fixtureJoinUrl={f.joinUrl}
                  canSubmit={canSubmit}
                  captainHref={captainHref}
                  fixtureId={f.id}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <p className="text-[11px] text-muted-foreground">Category line-ups not published yet.</p>
              <div className="flex gap-2">
                {group === "upcoming" && f.joinUrl ? <JoinButton url={f.joinUrl} /> : null}
                <ViewButton id={f.id} />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// --- Next Match panel ------------------------------------------------------

function NextMatch({
  f,
  detail,
  canSubmit,
  captainHref,
}: {
  f: LCFixture
  detail: FixtureDetail | undefined
  canSubmit: boolean
  captainHref: string
}) {
  const { day, time } = fmtParts(f.matchDate, f.timeslot)
  const group = groupOf(f)
  const mine = detail?.categories.find((c) => c.isMine) ?? null

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">My Next Match</h2>
      <div className="overflow-hidden rounded-xl border border-primary/30 bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.04] px-4 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {day}
            <span className="text-border">|</span>
            <Clock className="h-3.5 w-3.5" />
            {time}
          </span>
          <StatusBadge group={group} />
        </div>

        {/* Teams */}
        <div className="flex items-center justify-center gap-4 px-4 py-4">
          <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <Crest name={f.homeName} logoUrl={f.homeLogo} size="md" />
            <span className="text-sm font-semibold leading-tight text-balance">{f.homeName ?? "TBD"}</span>
          </div>
          <span className="font-serif text-base font-bold text-muted-foreground">vs</span>
          <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <Crest name={f.awayName} logoUrl={f.awayLogo} size="md" />
            <span className="text-sm font-semibold leading-tight text-balance">{f.awayName ?? "TBD"}</span>
          </div>
        </div>

        {/* Context line */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {f.divisionName ? <span className="font-medium text-foreground">{f.divisionName}</span> : null}
          {f.venue ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {f.venue}
            </span>
          ) : null}
        </div>

        {/* My match detail (category, partner, opponents) */}
        {mine ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs sm:grid-cols-3">
            <Detail label="Category" value={mine.category} />
            <Detail label="Partner" value={mine.partner ?? "To be confirmed"} />
            <Detail label="Opponents" value={mine.opponents.length ? mine.opponents.join(" & ") : "To be confirmed"} />
          </div>
        ) : (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Your line-up will appear here once the captain selects the team.
            </span>
          </div>
        )}

        {/* Primary actions */}
        <div className="grid grid-cols-1 gap-2 border-t border-border p-3 sm:grid-cols-2">
          {f.joinUrl ? <JoinButton url={f.joinUrl} full /> : null}
          {group === "awaiting" && canSubmit ? (
            <ScoreButton href={captainHref} label="Submit Score" full />
          ) : null}
          <ViewButton id={f.id} full />
        </div>
      </div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  )
}

// --- Main ------------------------------------------------------------------

export function MatchCentre({
  matches,
  details,
  isCaptain,
  captainHref = "/dashboard/captain",
}: {
  matches: LCFixture[]
  details: Record<number, FixtureDetail>
  isCaptain: boolean
  captainHref?: string
}) {
  const sorted = [...matches].sort((a, b) => (a.matchDate ?? "").localeCompare(b.matchDate ?? ""))
  const upcoming = sorted.filter((m) => groupOf(m) === "upcoming")
  const awaiting = sorted.filter((m) => groupOf(m) === "awaiting")
  const disputed = sorted.filter((m) => groupOf(m) === "disputed")
  const completed = sorted.filter((m) => groupOf(m) === "completed").reverse()

  const next = upcoming[0] ?? null

  // Actions required: fixtures the player needs to act on right now.
  const joinActions = upcoming.filter((m) => m.joinUrl)
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
      {/* SECTION 2 — Actions Required */}
      {hasActions && (
        <section>
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            Actions Required
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
            {joinActions.slice(0, 3).map((f) => (
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

      {/* SECTION 1 — Next Match */}
      {next && <NextMatch f={next} detail={details[next.id]} canSubmit={isCaptain} captainHref={captainHref} />}

      {/* SECTION 3 — My Fixtures (compact, expandable) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">My Fixtures</h2>
          <Link href="/league-centre" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            League Centre <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {awaiting.length > 0 && (
            <FixtureGroupList label="Awaiting Score" count={awaiting.length}>
              {awaiting.map((f) => (
                <FixtureRow key={f.id} f={f} detail={details[f.id]} canSubmit={isCaptain} captainHref={captainHref} />
              ))}
            </FixtureGroupList>
          )}
          {disputed.length > 0 && (
            <FixtureGroupList label="Disputed" count={disputed.length}>
              {disputed.map((f) => (
                <FixtureRow key={f.id} f={f} detail={details[f.id]} canSubmit={isCaptain} captainHref={captainHref} />
              ))}
            </FixtureGroupList>
          )}
          {upcoming.length > 0 && (
            <FixtureGroupList label="Upcoming" count={upcoming.length}>
              {upcoming.map((f, i) => (
                <FixtureRow
                  key={f.id}
                  f={f}
                  detail={details[f.id]}
                  canSubmit={isCaptain}
                  captainHref={captainHref}
                  defaultOpen={i === 0}
                />
              ))}
            </FixtureGroupList>
          )}
          {completed.length > 0 && (
            <FixtureGroupList label="Completed" count={completed.length}>
              {completed.slice(0, 6).map((f) => (
                <FixtureRow key={f.id} f={f} detail={details[f.id]} canSubmit={isCaptain} captainHref={captainHref} />
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

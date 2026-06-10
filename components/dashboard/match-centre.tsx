import Link from "next/link"
import type { LCFixture } from "@/lib/queries-league-centre"
import { Crest } from "@/components/league-centre/crest"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowRight, ExternalLink, MapPin, ClipboardEdit, Eye } from "lucide-react"

// ---------------------------------------------------------------------------
// Player Match Centre — a dense, sports-app style view of the player's own
// fixtures, modelled on Flashscore/Sofascore. Replaces the old card-heavy
// overview. Sections: Actions Required, Next Match, My Fixtures.
// ---------------------------------------------------------------------------

type FixtureGroup = "upcoming" | "awaiting" | "completed" | "disputed"

/** Bucket a fixture into one of the player-facing groups. */
function groupOf(f: LCFixture): FixtureGroup {
  if (f.status === "completed") return "completed"
  // The schema status union is scheduled | completed | disputed; LCStatus also
  // exposes live/planned. Treat anything past kickoff with no result as
  // "awaiting score".
  const kickoff = f.matchDate ? Date.parse(f.matchDate) : null
  if (kickoff != null && kickoff < Date.now()) return "awaiting"
  return "upcoming"
}

function fmtDay(iso: string | null, timeslot: string | null) {
  if (!iso) return { day: "Date TBD", time: timeslot ?? "" }
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "2-digit", month: "short" }).format(d)
  const time =
    timeslot ?? new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
  return { day, time }
}

const STATUS_LABEL: Record<FixtureGroup, string> = {
  upcoming: "Upcoming",
  awaiting: "Awaiting score",
  completed: "Completed",
  disputed: "Disputed",
}

function StatusBadge({ group }: { group: FixtureGroup }) {
  const styles: Record<FixtureGroup, string> = {
    upcoming: "bg-primary/10 text-primary",
    awaiting: "bg-amber-500/15 text-amber-500",
    completed: "bg-secondary text-muted-foreground",
    disputed: "bg-destructive/15 text-destructive",
  }
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", styles[group])}>
      {STATUS_LABEL[group]}
    </span>
  )
}

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
      Join Fixture
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
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-500 transition-colors hover:bg-amber-500/20",
        full && "w-full px-4 py-2.5 text-xs",
      )}
    >
      <ClipboardEdit className={cn("h-3 w-3", full && "h-3.5 w-3.5")} />
      {label}
    </Link>
  )
}

/** Compact, single-row fixture entry. */
function FixtureRow({
  f,
  canSubmit,
  captainHref,
}: {
  f: LCFixture
  canSubmit: boolean
  captainHref: string
}) {
  const group = groupOf(f)
  const { day, time } = fmtDay(f.matchDate, f.timeslot)
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const awayWon = f.winnerTeamId != null && f.winnerTeamId === f.awayTeamId
  const hasScore = group === "completed"

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      {/* Left rail: date / time */}
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-20 sm:flex-col sm:items-start sm:gap-0">
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
          {hasScore ? <span className={cn("tabular-nums", homeWon && "font-bold text-primary")}>{f.homePoints ?? 0}</span> : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Crest name={f.awayName} logoUrl={f.awayLogo} size="sm" />
          <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", homeWon && "text-muted-foreground")}>
            {f.awayName ?? "TBD"}
          </span>
          {hasScore ? <span className={cn("tabular-nums", awayWon && "font-bold text-primary")}>{f.awayPoints ?? 0}</span> : null}
        </div>
        {f.venue ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{f.venue}</span>
          </p>
        ) : null}
      </div>

      {/* Right: status + actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
        <StatusBadge group={group} />
        {group === "completed" ? (
          <ViewButton id={f.id} />
        ) : group === "awaiting" && canSubmit ? (
          <ScoreButton href={captainHref} label="Submit Score" />
        ) : group === "awaiting" ? (
          <ViewButton id={f.id} />
        ) : (
          <>
            {f.joinUrl ? <JoinButton url={f.joinUrl} /> : null}
            <ViewButton id={f.id} />
          </>
        )}
      </div>
    </div>
  )
}

export function MatchCentre({
  matches,
  isCaptain,
  captainHref = "/dashboard/captain",
}: {
  matches: LCFixture[]
  isCaptain: boolean
  captainHref?: string
}) {
  const sorted = [...matches].sort((a, b) => (a.matchDate ?? "").localeCompare(b.matchDate ?? ""))
  const upcoming = sorted.filter((m) => groupOf(m) === "upcoming")
  const awaiting = sorted.filter((m) => groupOf(m) === "awaiting")
  const completed = sorted.filter((m) => groupOf(m) === "completed").reverse()

  const next = upcoming[0] ?? null

  // Actions required: fixtures the player needs to act on right now.
  const joinActions = upcoming.filter((m) => m.joinUrl)
  const scoreActions = isCaptain ? awaiting : []
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
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            Actions Required
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/[0.03]">
            {scoreActions.map((f) => (
              <ActionItem
                key={`score-${f.id}`}
                title="Submit Score"
                detail={`${f.homeName ?? "TBD"} vs ${f.awayName ?? "TBD"}`}
                action={<ScoreButton href={captainHref} label="Submit" />}
              />
            ))}
            {joinActions.slice(0, 3).map((f) => (
              <ActionItem
                key={`join-${f.id}`}
                title="Join Fixture"
                detail={`${f.homeName ?? "TBD"} vs ${f.awayName ?? "TBD"} · ${fmtDay(f.matchDate, f.timeslot).day}`}
                action={f.joinUrl ? <JoinButton url={f.joinUrl} /> : null}
              />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3 — Next Match */}
      {next && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">Next Match</h2>
          <div className="overflow-hidden rounded-lg border border-primary/30 bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {fmtDay(next.matchDate, next.timeslot).day} · {fmtDay(next.matchDate, next.timeslot).time}
              </span>
              <StatusBadge group={groupOf(next)} />
            </div>
            <div className="flex items-center justify-center gap-4 px-4 py-4">
              <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <Crest name={next.homeName} logoUrl={next.homeLogo} size="md" />
                <span className="text-sm font-semibold leading-tight text-balance">{next.homeName ?? "TBD"}</span>
              </div>
              <span className="font-serif text-base font-bold text-muted-foreground">vs</span>
              <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <Crest name={next.awayName} logoUrl={next.awayLogo} size="md" />
                <span className="text-sm font-semibold leading-tight text-balance">{next.awayName ?? "TBD"}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              {next.divisionName ? <span className="font-medium">{next.divisionName}</span> : null}
              {next.venue ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {next.venue}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 border-t border-border p-3 sm:grid-cols-2">
              {next.joinUrl ? <JoinButton url={next.joinUrl} full /> : null}
              <ViewButton id={next.id} full />
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4 — My Fixtures (compact) */}
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
                <FixtureRow key={f.id} f={f} canSubmit={isCaptain} captainHref={captainHref} />
              ))}
            </FixtureGroupList>
          )}
          {upcoming.length > 0 && (
            <FixtureGroupList label="Upcoming" count={upcoming.length}>
              {upcoming.map((f) => (
                <FixtureRow key={f.id} f={f} canSubmit={isCaptain} captainHref={captainHref} />
              ))}
            </FixtureGroupList>
          )}
          {completed.length > 0 && (
            <FixtureGroupList label="Completed" count={completed.length}>
              {completed.slice(0, 6).map((f) => (
                <FixtureRow key={f.id} f={f} canSubmit={isCaptain} captainHref={captainHref} />
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

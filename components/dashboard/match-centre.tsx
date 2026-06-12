"use client"

import { useState } from "react"
import Link from "next/link"
import type { DashboardFixture } from "@/lib/queries-fixtures"
import type { FixtureDetail } from "@/lib/queries-dashboard"
import { Crest } from "@/components/league-centre/crest"
import { CATEGORY_RULES } from "@/lib/constants"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ResultEntry } from "@/components/captain/result-entry"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ClipboardEdit,
  ChevronDown,
  Clock,
  MapPin,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Player Match Centre. Two sections:
//   1. To Do  — every non-completed fixture the player still needs to join
//               (i.e. has at least one Playtomic court booking link), plus
//               score actions for captains.
//   2. Team Fixtures — an expandable list mirroring the Fixtures management
//               view: "Team vs Team" summary that expands to the per-court
//               "Player vs Player" line-ups.
// Booking links are stored per court on `fixtures.courtLinks` (set on the
// Fixtures management page), so we read them from there rather than the
// fixture-level Playtomic URL.
// ---------------------------------------------------------------------------

// The four courts played each match night, in running order.
const COURTS = [...CATEGORY_RULES].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.name)

type FixtureGroup = "upcoming" | "awaiting" | "completed"

function groupOf(f: DashboardFixture): FixtureGroup {
  if (f.status === "completed") return "completed"
  const kickoff = f.matchDate ? Date.parse(f.matchDate as string) : null
  if (kickoff != null && kickoff < Date.now()) return "awaiting"
  return "upcoming"
}

function courtLinksOf(f: DashboardFixture): Record<string, string> {
  return (f.courtLinks ?? {}) as Record<string, string>
}

/** The booking link most relevant to the player: their own court, else the first available. */
function primaryJoinLink(f: DashboardFixture, detail?: FixtureDetail): string | null {
  const links = courtLinksOf(f)
  if (detail?.myCategory && links[detail.myCategory]) return links[detail.myCategory]
  for (const c of COURTS) if (links[c]) return links[c]
  return null
}

function teamLabel(name: string | null, slot: number | null) {
  if (name) return { text: name, placeholder: false }
  if (slot) return { text: `Slot ${slot}`, placeholder: true }
  return { text: "TBD", placeholder: true }
}

const STATUS_LABEL: Record<FixtureGroup, string> = {
  upcoming: "Upcoming",
  awaiting: "Awaiting Score",
  completed: "Completed",
}

const STATUS_STYLE: Record<FixtureGroup, string> = {
  upcoming: "bg-primary/10 text-primary",
  awaiting: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
  completed: "bg-secondary text-muted-foreground",
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

// --- Expandable team-fixture row (mirrors the Fixtures management view) -----

function FixtureRow({ f, detail }: { f: DashboardFixture; detail?: FixtureDetail }) {
  const [open, setOpen] = useState(false)
  const group = groupOf(f)
  const done = group === "completed"
  const home = teamLabel(f.homeName, f.homeSlot)
  const away = teamLabel(f.awayName, f.awaySlot)
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const venueName = f.venueClubName ?? f.venue
  const links = courtLinksOf(f)
  const byCategory = new Map(detail?.categories.map((c) => [c.category, c]) ?? [])

  return (
    <div className={cn("border-b border-border last:border-b-0", f.mine && "bg-primary/[0.03]")}>
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
          <Crest name={f.homeName} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn("truncate text-sm font-semibold", home.placeholder && "italic text-muted-foreground")}>
                {home.text}
              </span>
              <span className="text-xs text-muted-foreground">vs</span>
              <span className={cn("truncate text-sm font-semibold", away.placeholder && "italic text-muted-foreground")}>
                {away.text}
              </span>
              {done && (
                <span className="font-mono text-sm font-bold tabular-nums">
                  <span className={cn(homeWon && "text-primary")}>{f.homePoints ?? 0}</span>
                  <span className="text-muted-foreground">–</span>
                  <span className={cn(!homeWon && "text-primary")}>{f.awayPoints ?? 0}</span>
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {f.divisionName && <span>{f.regionName ? `${f.regionName} · ${f.divisionName}` : f.divisionName}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {f.timeslot ?? "Time TBD"}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="max-w-[12rem] truncate">{venueName ?? "Venue TBD"}</span>
              </span>
              <span>{done ? "Final" : fmtDate(f.matchDate)}</span>
            </div>
          </div>
        </button>

        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            STATUS_STYLE[group],
          )}
        >
          {STATUS_LABEL[group]}
        </span>
      </div>

      {/* Expanded courts — player vs player */}
      {open && (
        <div className="border-t border-border/60 bg-secondary/20 px-4 py-3">
          <ul className="space-y-1.5">
            {COURTS.map((category, i) => {
              const cat = byCategory.get(category)
              const url = links[category]
              const homePlayers = cat?.homePlayers ?? []
              const awayPlayers = cat?.awayPlayers ?? []
              const homeText = homePlayers.length ? homePlayers.join(" / ") : home.text
              const awayText = awayPlayers.length ? awayPlayers.join(" / ") : away.text
              const noLineup = homePlayers.length === 0 && awayPlayers.length === 0
              return (
                <li
                  key={category}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2",
                    cat?.isMine && "border-primary/40 bg-primary/[0.04]",
                  )}
                >
                  <span className="inline-flex h-5 shrink-0 items-center justify-center rounded bg-secondary px-2 text-[10px] font-semibold uppercase text-secondary-foreground">
                    Court {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                      {cat?.isMine && <span className="ml-1.5 text-primary">· You</span>}
                    </span>
                    <span className={cn("font-medium", noLineup && "italic text-muted-foreground")}>{homeText}</span>
                    <span className="mx-1.5 text-muted-foreground">vs</span>
                    <span className={cn("font-medium", noLineup && "italic text-muted-foreground")}>{awayText}</span>
                    {cat?.scoreDetail && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{cat.scoreDetail}</span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Join
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> No link
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// --- Main ------------------------------------------------------------------

export function MatchCentre({
  matches,
  details = {},
  isCaptain,
  captainHref = "/dashboard/captain",
}: {
  matches: DashboardFixture[]
  details?: Record<number, FixtureDetail>
  isCaptain: boolean
  captainHref?: string
}) {
  const [scoreFixture, setScoreFixture] = useState<DashboardFixture | null>(null)

  const sorted = [...matches].sort((a, b) =>
    String(a.matchDate ?? "").localeCompare(String(b.matchDate ?? "")),
  )
  const upcoming = sorted.filter((m) => groupOf(m) === "upcoming")
  const awaiting = sorted.filter((m) => groupOf(m) === "awaiting")
  const completed = sorted.filter((m) => groupOf(m) === "completed").reverse()

  // To Do: every non-completed match gets both a Join and Enter Score action.
  const toDoFixtures = sorted.filter((m) => groupOf(m) !== "completed")
  const hasActions = toDoFixtures.length > 0

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

  const myCategory = scoreFixture ? details[scoreFixture.id]?.myCategory : null

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* SECTION 1 — To Do */}
        {hasActions && (
          <section>
            <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              To Do
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/[0.03]">
              {toDoFixtures.map((f) => {
                const url = primaryJoinLink(f, details[f.id])
                const isAwaiting = groupOf(f) === "awaiting"
                return (
                  <ActionItem
                    key={f.id}
                    title={isAwaiting ? "Score needed" : "Upcoming match"}
                    detail={`${f.homeName ?? "TBD"} vs ${f.awayName ?? "TBD"} · ${fmtDate(f.matchDate)}`}
                    action={
                      <div className="flex items-center gap-2">
                        {url ? (
                          <JoinButton url={url} />
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                            <Clock className="h-3 w-3" />
                            Link soon
                          </span>
                        )}
                        <button
                          onClick={() => setScoreFixture(f)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-500"
                        >
                          <ClipboardEdit className="h-3 w-3" />
                          Enter Score
                        </button>
                      </div>
                    }
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* SECTION 2 — Team Fixtures */}
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
                  <FixtureRow key={f.id} f={f} detail={details[f.id]} />
                ))}
              </FixtureGroupList>
            )}
            {upcoming.length > 0 && (
              <FixtureGroupList label="Upcoming" count={upcoming.length}>
                {upcoming.map((f) => (
                  <FixtureRow key={f.id} f={f} detail={details[f.id]} />
                ))}
              </FixtureGroupList>
            )}
            {completed.length > 0 && (
              <FixtureGroupList label="Completed" count={completed.length}>
                {completed.slice(0, 6).map((f) => (
                  <FixtureRow key={f.id} f={f} detail={details[f.id]} />
                ))}
              </FixtureGroupList>
            )}
          </div>
        </section>
      </div>

      {/* Inline score dialog */}
      <Dialog open={!!scoreFixture} onOpenChange={(open) => !open && setScoreFixture(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Enter Score{myCategory ? ` · ${myCategory}` : ""}
            </DialogTitle>
          </DialogHeader>
          {scoreFixture && (
            <ResultEntry
              fixtureId={scoreFixture.id}
              homeName={scoreFixture.homeName ?? "Home"}
              awayName={scoreFixture.awayName ?? "Away"}
              categories={
                myCategory
                  ? [{ category: myCategory, session: 1, isFeatureCourt: false }]
                  : COURTS.map((c, i) => ({ category: c, session: i + 1, isFeatureCourt: false }))
              }
              onDone={() => setScoreFixture(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
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

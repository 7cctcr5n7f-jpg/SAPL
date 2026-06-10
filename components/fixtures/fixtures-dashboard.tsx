"use client"

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { fmtDate } from "@/lib/format"
import { toast } from "sonner"
import { setFixtureVenue, setFixtureCourtLink, setFixtureTimeslot } from "@/lib/actions/fixtures"
import { CATEGORY_RULES, FIXTURE_TIMESLOTS } from "@/lib/constants"
import type { DashboardFixture, FixtureScope, HostClub } from "@/lib/queries-fixtures"
import {
  CalendarDays,
  MapPin,
  ExternalLink,
  LinkIcon,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Clock,
  ChevronDown,
  Building2,
} from "lucide-react"

const SCOPE_COPY: Record<FixtureScope, string> = {
  all: "Every fixture across all divisions. Set each match night's time, venue and the per-court Playtomic booking links.",
  club: "Fixtures hosted at your club or involving your teams. Add a booking link for each court.",
  team: "Your team's match nights. Tap a court's link to join the booking on Playtomic.",
  none: "No fixtures are available yet.",
}

// The four courts played each match night, in running order.
const COURTS = [...CATEGORY_RULES].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.name)

// The category is shown in full (e.g. "Mens Open", "Ladies Beginner") so the
// match-up reads clearly rather than as a cryptic single letter.
function categoryLabel(name: string) {
  return name
}

function teamLabel(name: string | null, slot: number | null) {
  if (name) return { text: name, placeholder: false }
  if (slot) return { text: `Slot ${slot}`, placeholder: true }
  return { text: "TBD", placeholder: true }
}

type EditState =
  | { fixture: DashboardFixture; mode: "venue" | "timeslot" }
  | { fixture: DashboardFixture; mode: "court"; category: string }

type ClashGroup = {
  key: string
  week: number
  venueClubId: number
  venueName: string
  timeslot: string
  courts: number
  fixtures: DashboardFixture[]
}

// Courts a single fixture (tie) consumes — one per category.
const COURTS_PER_FIXTURE = CATEGORY_RULES.length

export function FixturesDashboard({
  scope,
  seasonName,
  canManageVenue,
  fixtures,
  clubs,
}: {
  scope: FixtureScope
  seasonName: string | null
  canManageVenue: boolean
  fixtures: DashboardFixture[]
  clubs: HostClub[]
}) {
  const canManageLinks = scope === "all" || scope === "club"

  const weeks = useMemo(() => Array.from(new Set(fixtures.map((f) => f.week))).sort((a, b) => a - b), [fixtures])
  const divisionOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; level: number; region: string | null }>()
    for (const f of fixtures) {
      if (f.divisionId && !map.has(f.divisionId)) {
        map.set(f.divisionId, {
          id: f.divisionId,
          name: f.divisionName ?? `Division ${f.divisionId}`,
          level: f.divisionLevel ?? 99,
          region: f.regionName,
        })
      }
    }
    // Group by region, then by division level, so the dropdown reads sensibly.
    return [...map.values()].sort(
      (a, b) => (a.region ?? "").localeCompare(b.region ?? "") || a.level - b.level || a.name.localeCompare(b.name),
    )
  }, [fixtures])

  const venueOptions = useMemo(() => {
    // Seed from the full host-club list so the filter is available even before
    // any fixtures have a venue assigned (venue managers use it to add links),
    // then fold in any venues that already appear on fixtures.
    const map = new Map<number, string>()
    for (const c of clubs) map.set(c.id, c.name)
    for (const f of fixtures) {
      if (f.venueClubId != null && !map.has(f.venueClubId)) {
        map.set(f.venueClubId, f.venueClubName ?? f.venue ?? `Venue ${f.venueClubId}`)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [fixtures, clubs])

  const [week, setWeek] = useState<number>(weeks[0] ?? 1)
  const [divisionId, setDivisionId] = useState<number | "all">("all")
  const [venueId, setVenueId] = useState<number | "all">("all")
  const [onlyMissing, setOnlyMissing] = useState(false)

  // Fixtures for the active week (used for clash detection, before other filters).
  const weekFixtures = useMemo(() => fixtures.filter((f) => f.week === week), [fixtures, week])

  // Court clashes across ALL weeks. Each fixture consumes 4 courts (one per
  // category), so a venue can host floor(courts / 4) fixtures per timeslot.
  // Admins use this aggregated list to resolve every conflict in one place.
  const allClashes = useMemo(() => {
    const groups = new Map<string, ClashGroup>()
    for (const f of fixtures) {
      if (f.venueClubId == null || !f.timeslot) continue
      const key = `${f.week}|${f.venueClubId}|${f.timeslot}`
      const g =
        groups.get(key) ??
        ({
          key,
          week: f.week,
          venueClubId: f.venueClubId,
          venueName: f.venueClubName ?? f.venue ?? "Venue",
          timeslot: f.timeslot,
          courts: f.venueCourts ?? 0,
          fixtures: [],
        } as ClashGroup)
      g.fixtures.push(f)
      groups.set(key, g)
    }
    const out: ClashGroup[] = []
    for (const g of groups.values()) {
      if (g.fixtures.length * COURTS.length > g.courts) out.push(g)
    }
    return out.sort(
      (a, b) => a.week - b.week || a.venueName.localeCompare(b.venueName) || a.timeslot.localeCompare(b.timeslot),
    )
  }, [fixtures])

  // Keys (week|venue|timeslot) that are in conflict, for the per-row badge.
  const clashedKeys = useMemo(() => new Set(allClashes.map((c) => c.key)), [allClashes])

  // Courts already committed per week|venue|timeslot (each fixture = 4 courts),
  // so the time/venue pickers can flag or block slots that have no capacity for
  // another fixture. The fixture being moved is excluded by the caller.
  const slotUsage = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of fixtures) {
      if (f.venueClubId == null || !f.timeslot) continue
      const key = `${f.week}|${f.venueClubId}|${f.timeslot}`
      m.set(key, (m.get(key) ?? 0) + COURTS_PER_FIXTURE)
    }
    return m
  }, [fixtures])

  // Free capacity (in courts) for placing `fixture` into a given venue+timeslot,
  // counting every OTHER fixture already in that slot for the same week.
  function freeCourtsFor(fixture: DashboardFixture, venueClubId: number, courts: number, timeslot: string) {
    const key = `${fixture.week}|${venueClubId}|${timeslot}`
    let used = slotUsage.get(key) ?? 0
    // Don't count the fixture against itself if it's already in this slot.
    if (fixture.venueClubId === venueClubId && fixture.timeslot === timeslot) used -= COURTS_PER_FIXTURE
    return courts - used
  }

  function missingLinks(f: DashboardFixture) {
    return COURTS.filter((c) => !f.courtLinks?.[c]).length
  }

  const missingCount = useMemo(
    () => fixtures.reduce((sum, f) => sum + missingLinks(f), 0),
    [fixtures],
  )

  const shown = useMemo(() => {
    return weekFixtures.filter((f) => {
      if (divisionId !== "all" && f.divisionId !== divisionId) return false
      if (venueId !== "all" && f.venueClubId !== venueId) return false
      if (onlyMissing && missingLinks(f) === 0) return false
      return true
    })
  }, [weekFixtures, divisionId, venueId, onlyMissing])

  const [editing, setEditing] = useState<EditState | null>(null)

  if (fixtures.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {scope === "team"
              ? "You have no scheduled fixtures yet. They'll appear here once the season schedule is published."
              : "No fixtures yet. Generate the season schedule from League Control."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{SCOPE_COPY[scope]}</p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {weeks.map((w) => (
          <button
            key={w}
            onClick={() => setWeek(w)}
            className={cn(
              "rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors",
              w === week
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Week {w}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {divisionOptions.length > 1 && (
            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by division"
            >
              <option value="all">All divisions</option>
              {divisionOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.region ? `${d.region} · ${d.name}` : d.name}
                </option>
              ))}
            </select>
          )}
          {venueOptions.length > 0 && (
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by venue"
            >
              <option value="all">All venues</option>
              {venueOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          {canManageLinks && missingCount > 0 && (
            <button
              onClick={() => setOnlyMissing((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                onlyMissing
                  ? "border-amber-500 bg-amber-500/10 text-amber-600"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {missingCount} court{missingCount === 1 ? "" : "s"} without a link
            </button>
          )}
        </div>
      </div>

      {/* Clash resolution centre — admins only. Aggregates every court clash
          across all weeks so they can be cleared from one place. */}
      {canManageVenue && allClashes.length > 0 && (
        <div className="space-y-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-semibold text-destructive">
              {allClashes.length} court clash{allClashes.length === 1 ? "" : "es"} need resolving
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Each fixture uses {COURTS_PER_FIXTURE} courts. Move a fixture to a free timeslot or another venue to clear
            the conflict.
          </p>
          <ul className="space-y-2.5">
            {allClashes.map((c) => {
              const capacity = Math.floor(c.courts / COURTS_PER_FIXTURE)
              return (
                <li key={c.key} className="rounded-md border border-destructive/30 bg-card p-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Badge variant="outline" className="text-[11px]">
                      Week {c.week}
                    </Badge>
                    <span className="font-semibold">{c.venueName}</span>
                    <span className="text-muted-foreground">at {c.timeslot}</span>
                    <span className="text-destructive">
                      — {c.fixtures.length} fixtures need {c.fixtures.length * COURTS_PER_FIXTURE} courts but venue has{" "}
                      {c.courts} ({capacity === 1 ? "1 fixture" : `${capacity} fixtures`} max).
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {c.fixtures.map((f) => {
                      const home = teamLabel(f.homeName, f.homeSlot)
                      const away = teamLabel(f.awayName, f.awaySlot)
                      return (
                        <li
                          key={f.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-background px-2.5 py-1.5"
                        >
                          <span className="text-xs">
                            <span className="font-medium">{home.text}</span>
                            <span className="mx-1 text-muted-foreground">vs</span>
                            <span className="font-medium">{away.text}</span>
                            {f.divisionName && <span className="ml-1.5 text-muted-foreground">· {f.divisionName}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => setEditing({ fixture: f, mode: "timeslot" })}
                            >
                              <Clock className="mr-1.5 h-3.5 w-3.5" /> Change time
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => setEditing({ fixture: f, mode: "venue" })}
                            >
                              <Building2 className="mr-1.5 h-3.5 w-3.5" /> Change venue
                            </Button>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Fixture list */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[1fr_auto] items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Match night</span>
          <span>Courts</span>
        </div>
        {shown.map((f) => (
          <FixtureRow
            key={f.id}
            f={f}
            canManageLink={canManageLinks && f.canEditLink}
            canManageVenue={canManageVenue}
            missing={missingLinks(f)}
            clashed={f.venueClubId != null && f.timeslot != null && clashedKeys.has(`${f.week}|${f.venueClubId}|${f.timeslot}`)}
            onEditCourt={(category) => setEditing({ fixture: f, mode: "court", category })}
            onEditVenue={() => setEditing({ fixture: f, mode: "venue" })}
            onEditTimeslot={() => setEditing({ fixture: f, mode: "timeslot" })}
          />
        ))}
        {shown.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No fixtures match the current filters.</p>
        )}
      </div>

      <EditDialog
        editing={editing}
        clubs={clubs}
        freeCourtsFor={freeCourtsFor}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function FixtureRow({
  f,
  canManageLink,
  canManageVenue,
  missing,
  clashed,
  onEditCourt,
  onEditVenue,
  onEditTimeslot,
}: {
  f: DashboardFixture
  canManageLink: boolean
  canManageVenue: boolean
  missing: number
  clashed: boolean
  onEditCourt: (category: string) => void
  onEditVenue: () => void
  onEditTimeslot: () => void
}) {
  const [open, setOpen] = useState(false)
  const done = f.status === "completed"
  const home = teamLabel(f.homeName, f.homeSlot)
  const away = teamLabel(f.awayName, f.awaySlot)
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId
  const venueName = f.venueClubName ?? f.venue
  const booked = COURTS.length - missing

  return (
    <div className={cn("border-b border-border last:border-b-0", f.mine && "bg-primary/[0.03]")}>
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
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

        <div className="flex shrink-0 items-center gap-2">
          {f.mine && <Badge className="hidden text-[11px] sm:inline-flex">Your team</Badge>}
          {clashed && (
            <Badge variant="destructive" className="gap-1 text-[11px]">
              <AlertTriangle className="h-3 w-3" /> Clash
            </Badge>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums",
              booked === COURTS.length
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : "border-amber-500/30 bg-amber-500/10 text-amber-600",
            )}
            title={`${booked} of ${COURTS.length} courts booked`}
          >
            {booked === COURTS.length ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {booked}/{COURTS.length}
          </span>
        </div>
      </div>

      {/* Expanded courts */}
      {open && (
        <div className="border-t border-border/60 bg-secondary/20 px-4 py-3">
          {(canManageVenue || canManageLink) && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {canManageVenue && (
                <>
                  <Button size="sm" variant="outline" className="h-7" onClick={onEditTimeslot}>
                    <Clock className="mr-1.5 h-3.5 w-3.5" /> {f.timeslot ? "Change time" : "Set time"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7" onClick={onEditVenue}>
                    <Building2 className="mr-1.5 h-3.5 w-3.5" /> {venueName ? "Change venue" : "Set venue"}
                  </Button>
                </>
              )}
            </div>
          )}
          <ul className="space-y-1.5">
            {COURTS.map((category, i) => {
              const url = f.courtLinks?.[category]
              const short = categoryLabel(category)
              return (
                <li
                  key={category}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="inline-flex h-5 shrink-0 items-center justify-center rounded bg-secondary px-2 text-[10px] font-semibold uppercase text-secondary-foreground">
                    Court {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {short}
                    </span>
                    <span className={cn("font-medium", home.placeholder && "italic text-muted-foreground")}>
                      {home.text}
                    </span>
                    <span className="mx-1.5 text-muted-foreground">vs</span>
                    <span className={cn("font-medium", away.placeholder && "italic text-muted-foreground")}>
                      {away.text}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-7")}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Book court
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> No link
                      </span>
                    )}
                    {canManageLink && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => onEditCourt(category)}
                        aria-label={`${url ? "Edit" : "Add"} link for ${category}`}
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </Button>
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

function EditDialog({
  editing,
  clubs,
  freeCourtsFor,
  onClose,
}: {
  editing: EditState | null
  clubs: HostClub[]
  freeCourtsFor: (fixture: DashboardFixture, venueClubId: number, courts: number, timeslot: string) => number
  onClose: () => void
}) {
  const [pending, start] = useTransition()
  const [url, setUrl] = useState("")
  const [venueClubId, setVenueClubId] = useState<string>("")
  const [timeslot, setTimeslot] = useState<string>("")

  // Sync local state whenever a new target is opened.
  const open = !!editing
  const key = editing
    ? `${editing.fixture.id}-${editing.mode}-${editing.mode === "court" ? editing.category : ""}`
    : ""
  const [lastKey, setLastKey] = useState("")
  if (key !== lastKey) {
    setLastKey(key)
    if (editing?.mode === "court") setUrl(editing.fixture.courtLinks?.[editing.category] ?? "")
    setVenueClubId(editing?.fixture.venueClubId ? String(editing.fixture.venueClubId) : "")
    setTimeslot(editing?.fixture.timeslot ?? "")
  }

  function saveCourt() {
    if (!editing || editing.mode !== "court") return
    start(async () => {
      const res = await setFixtureCourtLink(editing.fixture.id, editing.category, url)
      if (res.ok) {
        toast.success(url.trim() ? "Court link saved" : "Court link cleared")
        onClose()
      } else toast.error(res.error ?? "Failed to save")
    })
  }

  function saveVenue() {
    if (!editing) return
    start(async () => {
      const res = await setFixtureVenue(editing.fixture.id, venueClubId ? Number(venueClubId) : null)
      if (res.ok) {
        toast.success("Venue updated")
        onClose()
      } else toast.error(res.error ?? "Failed to update venue")
    })
  }

  function saveTimeslot() {
    if (!editing) return
    start(async () => {
      const res = await setFixtureTimeslot(editing.fixture.id, timeslot || null)
      if (res.ok) {
        toast.success("Match time updated")
        onClose()
      } else toast.error(res.error ?? "Failed to update time")
    })
  }

  const matchup = editing
    ? `${editing.fixture.homeName ?? `Slot ${editing.fixture.homeSlot}`} vs ${
        editing.fixture.awayName ?? `Slot ${editing.fixture.awaySlot}`
      }`
    : ""

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {editing?.mode === "court" ? (
          <>
            <DialogHeader>
              <DialogTitle>{categoryLabel(editing.category)} court — booking link</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{matchup}</p>
            <Input
              autoFocus
              placeholder="https://playtomic.io/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={saveCourt} disabled={pending}>
                Save link
              </Button>
            </DialogFooter>
          </>
        ) : editing?.mode === "timeslot" ? (
          <>
            <DialogHeader>
              <DialogTitle>Match-night time</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{matchup}</p>
            <select
              value={timeslot}
              onChange={(e) => setTimeslot(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No time set</option>
              {FIXTURE_TIMESLOTS.map((t) => {
                const venueId = editing.fixture.venueClubId
                const courts = editing.fixture.venueCourts ?? 0
                // How many courts remain free in this slot at the fixture's
                // venue, ignoring the fixture itself. Below 4 = no room.
                const free = venueId != null ? freeCourtsFor(editing.fixture, venueId, courts, t) : COURTS_PER_FIXTURE
                const full = venueId != null && free < COURTS_PER_FIXTURE
                return (
                  <option key={t} value={t} disabled={full}>
                    {t}
                    {full ? " — full (no courts free)" : ""}
                  </option>
                )
              })}
            </select>
            {editing.fixture.venueClubId == null && (
              <p className="text-xs text-muted-foreground">Set a venue first to check court availability.</p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={saveTimeslot} disabled={pending}>
                Save time
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change venue</DialogTitle>
            </DialogHeader>
            <select
              value={venueClubId}
              onChange={(e) => setVenueClubId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No venue (TBD)</option>
              {clubs.map((c) => {
                const courts = c.courts ?? 0
                const slot = editing?.fixture.timeslot ?? null
                // When the fixture has a timeslot, show remaining capacity at
                // each venue for that slot so admins don't move into a full one.
                const free = slot && editing ? freeCourtsFor(editing.fixture, c.id, courts, slot) : null
                const full = free != null && free < COURTS_PER_FIXTURE
                return (
                  <option key={c.id} value={c.id} disabled={full}>
                    {c.name}
                    {courts ? ` (${courts} courts)` : ""}
                    {full ? ` — full at ${slot}` : ""}
                  </option>
                )
              })}
            </select>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={saveVenue} disabled={pending}>
                Save venue
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

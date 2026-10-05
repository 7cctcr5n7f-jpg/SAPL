"use client"

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { pullPlayoffTeams, setPlayoffCategoryScheduleBulk, setPlayoffRoundSchedule, setPlayoffSchedule, setPlayoffTeams } from "@/lib/actions/admin"
import { toast } from "sonner"
import { Swords, Trophy, Users, CalendarClock, MapPin } from "lucide-react"

const PLAYOFF_TIMESLOTS = ["08:00", "10:00", "12:00", "14:00"] as const
const PLAYOFF_CATEGORIES = ["Ladies Open", "Mens Open", "Mens Intermediate", "Mens Beginner"] as const
const PLAYOFF_COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"] as const

type Venue = { id: number; name: string; courts: number }
type TeamOption = { id: number; name: string }
type Playoff = {
  id: number
  type: string
  round: string
  divisionId: number | null
  divisionName: string | null
  homeTeamId: number | null
  awayTeamId: number | null
  homeLabel: string | null
  awayLabel: string | null
  homeName: string
  awayName: string
  homeResolved: boolean
  awayResolved: boolean
  homeScore: number | null
  awayScore: number | null
  status: string
  bracketPosition: number | null
  matchDate: string | null
  timeslot: string | null
  court: string | null
  categorySchedule: Record<string, { timeslot: string | null; court: string | null }>
  venueClubId: number | null
  venue: string | null
}

export function PlayoffsManager({
  seasonId,
  seasonName,
  venues,
  teamOptions,
  playoffs,
}: {
  seasonId: number
  seasonName: string
  venues: Venue[]
  teamOptions: TeamOption[]
  playoffs: Playoff[]
}) {
  const [pending, start] = useTransition()

  function pull() {
    const fd = new FormData()
    fd.set("seasonId", String(seasonId))
    start(async () => {
      const res = await pullPlayoffTeams(fd)
      if (res.ok) toast.success(`Pulled teams into ${res.filled} slot${res.filled === 1 ? "" : "s"}`)
      else toast.error(res.error ?? "Failed to pull teams")
    })
  }

  // Division playoffs grouped by division; legacy masters omitted when unused.
  const regional = playoffs.filter((p) => p.type === "regional_final")
  const masters = playoffs.filter((p) => p.type === "tshwane_masters")
  const regionalByDivision = useMemo(() => {
    const map = new Map<number, Playoff[]>()
    for (const p of regional) {
      const key = p.divisionId ?? -1
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()]
  }, [regional])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" /> Playoff brackets — {seasonName}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Brackets are pre-seeded for an 8-team playoff weekend. Pull teams to fill quarter-finals from the live
              standings, then set each match&apos;s date, slot and court.
            </p>
          </div>
          <Button onClick={pull} disabled={pending}>
            <Users className="mr-1 h-4 w-4" /> Pull teams from standings
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          {playoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No playoff fixtures yet. Generate the season to create the bracket placeholders.
            </p>
          ) : (
            <>
              {regionalByDivision.map(([divId, ps]) => (
                <Bracket
                  seasonId={seasonId}
                  key={`div-${divId}`}
                  title={ps[0]?.divisionName ? `${ps[0].divisionName} — Playoffs` : "Playoffs"}
                  playoffs={ps}
                  venues={venues}
                  teamOptions={teamOptions}
                  pending={pending}
                  start={start}
                />
              ))}
              {masters.length > 0 && (
                <Bracket
                  seasonId={seasonId}
                  title="Tshwane Masters"
                  playoffs={masters}
                  venues={venues}
                  teamOptions={teamOptions}
                  pending={pending}
                  start={start}
                  crown
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Bracket({
  seasonId,
  title,
  playoffs,
  venues,
  teamOptions,
  pending,
  start,
  crown,
}: {
  seasonId: number
  title: string
  playoffs: Playoff[]
  venues: Venue[]
  teamOptions: TeamOption[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
  crown?: boolean
}) {
  const quarters = playoffs.filter((p) => p.round === "quarter_final").sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  const semis = playoffs.filter((p) => p.round === "semi_final").sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  const finals = playoffs.filter((p) => p.round === "final")
  const thirdPlace = playoffs.filter((p) => p.round === "third_place")
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold">
        {crown ? <Trophy className="h-4 w-4 text-primary" /> : <Swords className="h-4 w-4 text-primary" />}
        {title}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quarter Finals</p>
            <div className="flex items-center gap-1.5">
              <CategoryTimesDialog playoffs={quarters} pending={pending} start={start} />
              <CourtAllocationDialog playoffs={quarters} pending={pending} start={start} />
              <BulkRoundScheduleDialog
                seasonId={seasonId}
                playoffs={playoffs}
                round="quarter_final"
                venues={venues}
                pending={pending}
                start={start}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            1) Edit teams, 2) set category times, 3) assign courts per time slot.
          </p>
          {quarters.map((p) => (
            <BracketRow key={p.id} p={p} venues={venues} teamOptions={teamOptions} pending={pending} start={start} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semi Finals</p>
            <div className="flex items-center gap-1.5">
              <RoundSchedulerDialog
                title="Schedule semi-finals"
                triggerLabel="Category schedule"
                playoffs={semis}
                occupiedBy={playoffs}
                fixtureLabel={(p) => `Semi-final ${(p.bracketPosition ?? 5) - 4}`}
                pending={pending}
                start={start}
              />
              <BulkRoundScheduleDialog
                seasonId={seasonId}
                playoffs={playoffs}
                round="semi_final"
                venues={venues}
                pending={pending}
                start={start}
              />
            </div>
          </div>
          {semis.map((p) => (
            <BracketRow key={p.id} p={p} venues={venues} teamOptions={teamOptions} pending={pending} start={start} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Trophy className="h-3 w-3" /> Finals
            </p>
            <div className="flex items-center gap-1.5">
              <RoundSchedulerDialog
                title="Schedule 3rd place & final"
                triggerLabel="Category schedule"
                playoffs={[...thirdPlace, ...finals]}
                occupiedBy={playoffs}
                fixtureLabel={(p) => (p.round === "final" ? "Final" : "3rd / 4th place")}
                pending={pending}
                start={start}
              />
              <BulkRoundScheduleDialog
                seasonId={seasonId}
                playoffs={playoffs}
                round="final"
                venues={venues}
                pending={pending}
                start={start}
              />
            </div>
          </div>
          {thirdPlace.map((p) => (
            <BracketRow key={p.id} p={p} venues={venues} teamOptions={teamOptions} pending={pending} start={start} label="3rd / 4th place" />
          ))}
          {finals.map((p) => (
            <BracketRow key={p.id} p={p} venues={venues} teamOptions={teamOptions} pending={pending} start={start} label="Final" />
          ))}
        </div>
      </div>
    </div>
  )
}

function BracketRow({
  p,
  venues,
  teamOptions,
  pending,
  start,
  label,
}: {
  p: Playoff
  venues: Venue[]
  teamOptions: TeamOption[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
  label?: string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      {label && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>}
      <div className="flex items-center justify-between gap-2 text-sm">
        <TeamCell name={p.homeName} resolved={p.homeResolved} />
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {p.homeScore ?? "-"} : {p.awayScore ?? "-"}
        </span>
        <TeamCell name={p.awayName} resolved={p.awayResolved} align="right" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {p.matchDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {new Date(p.matchDate).toLocaleDateString()} {p.timeslot ?? ""} {p.court ? `· ${p.court}` : ""}
          </span>
        )}
        {p.venue && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {p.venue}
          </span>
        )}
        <TeamAssignmentDialog p={p} teamOptions={teamOptions} pending={pending} start={start} />
        <ScheduleDialog p={p} venues={venues} pending={pending} start={start} />
      </div>
    </div>
  )
}

function TeamCell({ name, resolved, align }: { name: string; resolved: boolean; align?: "right" }) {
  return (
    <span className={align === "right" ? "text-right" : ""}>
      <span className={resolved ? "font-medium" : "font-normal italic text-muted-foreground"}>{name}</span>
    </span>
  )
}

function TeamAssignmentDialog({
  p,
  teamOptions,
  pending,
  start,
}: {
  p: Playoff
  teamOptions: TeamOption[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  const [homeTeamId, setHomeTeamId] = useState(p.homeTeamId ? String(p.homeTeamId) : "")
  const [awayTeamId, setAwayTeamId] = useState(p.awayTeamId ? String(p.awayTeamId) : "")

  function save() {
    const fd = new FormData()
    fd.set("playoffId", String(p.id))
    fd.set("homeTeamId", homeTeamId)
    fd.set("awayTeamId", awayTeamId)
    start(async () => {
      const res = await setPlayoffTeams(fd)
      if (res.ok) {
        toast.success("Teams updated")
        setOpen(false)
      } else toast.error(res.error ?? "Failed to update teams")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs">
            Edit teams
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign placeholder teams</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`home-team-${p.id}`}>{p.homeLabel ?? "Home placeholder"}</Label>
            <select
              id={`home-team-${p.id}`}
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Use placeholder</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`away-team-${p.id}`}>{p.awayLabel ?? "Away placeholder"}</Label>
            <select
              id={`away-team-${p.id}`}
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Use placeholder</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save teams
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkRoundScheduleDialog({
  seasonId,
  playoffs,
  round,
  venues,
  pending,
  start,
}: {
  seasonId: number
  playoffs: Playoff[]
  round: "quarter_final" | "semi_final" | "third_place" | "final"
  venues: Venue[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  const sample = playoffs.find((playoff) => playoff.round === round)
  const [date, setDate] = useState(sample?.matchDate ? sample.matchDate.slice(0, 10) : "")
  const [timeslot, setTimeslot] = useState(sample?.timeslot ?? PLAYOFF_TIMESLOTS[0])
  const [venueClubId, setVenueClubId] = useState(sample?.venueClubId ? String(sample.venueClubId) : "")

  function save() {
    const fd = new FormData()
    fd.set("seasonId", String(seasonId))
    fd.set("type", sample?.type ?? "regional_final")
    fd.set("round", round)
    if (sample?.divisionId != null) fd.set("divisionId", String(sample.divisionId))
    fd.set("matchDate", date)
    fd.set("timeslot", timeslot)
    fd.set("venueClubId", venueClubId)
    start(async () => {
      const res = await setPlayoffRoundSchedule(fd)
      if (res.ok) {
        toast.success("Round schedule updated")
        setOpen(false)
      } else toast.error(res.error ?? "Failed to update round schedule")
    })
  }

  if (!sample) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
            Bulk schedule
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk schedule {round.replace("_", " ")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Timeslot</Label>
            <select
              value={timeslot}
              onChange={(e) => setTimeslot(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PLAYOFF_TIMESLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Venue</Label>
            <select
              value={venueClubId}
              onChange={(e) => setVenueClubId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} ({venue.courts} courts)
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryTimesDialog({
  playoffs,
  pending,
  start,
}: {
  playoffs: Playoff[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const categories = ["Ladies Open", "Mens Open", "Mens Intermediate", "Mens Beginner"] as const
  const [open, setOpen] = useState(false)
  const [timesByCategory, setTimesByCategory] = useState<Record<string, string>>(
    categories.reduce((acc, category) => {
      const sample = playoffs.find((playoff) => playoff.categorySchedule?.[category]?.timeslot)?.categorySchedule?.[category]?.timeslot
      acc[category] = sample ?? PLAYOFF_TIMESLOTS[0]
      return acc
    }, {} as Record<string, string>),
  )

  function save() {
    const updates: Array<{ playoffId: number; category: string; timeslot: string | null }> = []
    for (const playoff of playoffs) {
      for (const category of categories) {
        updates.push({ playoffId: playoff.id, category, timeslot: timesByCategory[category] ?? null })
      }
    }
    const fd = new FormData()
    fd.set("updatesJson", JSON.stringify(updates))
    start(async () => {
      const res = await setPlayoffCategoryScheduleBulk(fd)
      if (res.ok) {
        toast.success("Category times saved")
        setOpen(false)
      } else toast.error(res.error ?? "Failed to save category times")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
            Category times
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set category times (all quarter-finals)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category} className="grid gap-2 md:grid-cols-[1fr_180px] md:items-center">
              <p className="text-sm font-medium">{category}</p>
              <select
                value={timesByCategory[category] ?? PLAYOFF_TIMESLOTS[0]}
                onChange={(e) => setTimesByCategory((prev) => ({ ...prev, [category]: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PLAYOFF_TIMESLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save category times
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CourtAllocationDialog({
  playoffs,
  pending,
  start,
}: {
  playoffs: Playoff[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const categories = ["Ladies Open", "Mens Open", "Mens Intermediate", "Mens Beginner"] as const
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<(typeof categories)[number]>("Ladies Open")
  const [courtByFixtureId, setCourtByFixtureId] = useState<Record<number, string>>(
    Object.fromEntries(playoffs.map((playoff) => [playoff.id, playoff.categorySchedule?.["Ladies Open"]?.court ?? ""])),
  )

  const timeslotForCategory = useMemo(() => {
    return playoffs.find((playoff) => playoff.categorySchedule?.[category]?.timeslot)?.categorySchedule?.[category]?.timeslot ?? ""
  }, [category, playoffs])

  function setCategoryAndLoad(categoryName: (typeof categories)[number]) {
    setCategory(categoryName)
    setCourtByFixtureId(
      Object.fromEntries(playoffs.map((playoff) => [playoff.id, playoff.categorySchedule?.[categoryName]?.court ?? ""])),
    )
  }

  function save() {
    const chosen = playoffs.map((playoff) => courtByFixtureId[playoff.id] ?? "")
    const filled = chosen.filter(Boolean)
    const duplicates = new Set<string>()
    const seen = new Set<string>()
    for (const court of filled) {
      if (seen.has(court)) duplicates.add(court)
      seen.add(court)
    }
    if (duplicates.size > 0) {
      toast.error(`Each court can only host one match in the slot. Duplicate: ${[...duplicates].join(", ")}`)
      return
    }

    const updates = playoffs.map((playoff) => ({
      playoffId: playoff.id,
      category,
      timeslot: timeslotForCategory || null,
      court: (courtByFixtureId[playoff.id] || null),
    }))
    const fd = new FormData()
    fd.set("updatesJson", JSON.stringify(updates))
    start(async () => {
      const res = await setPlayoffCategoryScheduleBulk(fd)
      if (res.ok) {
        toast.success("Court allocation saved")
        setOpen(false)
      } else toast.error(res.error ?? "Failed to save court allocation")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
            Court allocation
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign courts by category</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_180px] md:items-center">
            <Label>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategoryAndLoad(e.target.value as (typeof categories)[number])}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Timeslot: <span className="font-semibold">{timeslotForCategory || "Not set yet (set category times first)"}</span>
          </p>
          <div className="space-y-2 rounded-md border border-input p-3">
            {playoffs.map((playoff) => (
              <div key={playoff.id} className="grid gap-2 md:grid-cols-[1fr_140px] md:items-center">
                <p className="text-sm">{playoff.homeName} vs {playoff.awayName}</p>
                <select
                  value={courtByFixtureId[playoff.id] ?? ""}
                  onChange={(e) => setCourtByFixtureId((prev) => ({ ...prev, [playoff.id]: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Court TBD</option>
                  <option value="Court 1">Court 1</option>
                  <option value="Court 2">Court 2</option>
                  <option value="Court 3">Court 3</option>
                  <option value="Court 4">Court 4</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save court allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function playoffDayKey(matchDate: string | null) {
  return matchDate ? new Date(matchDate).toISOString().slice(0, 10) : "no-date"
}

function RoundSchedulerDialog({
  title,
  triggerLabel,
  playoffs,
  occupiedBy,
  fixtureLabel,
  pending,
  start,
}: {
  title: string
  triggerLabel: string
  playoffs: Playoff[]
  occupiedBy: Playoff[]
  fixtureLabel: (p: Playoff) => string
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  type Cell = { timeslot: string; court: string }
  const cellKey = (id: number, category: string) => `${id}|${category}`
  const loadCells = () => {
    const out: Record<string, Cell> = {}
    for (const playoff of playoffs) {
      for (const category of PLAYOFF_CATEGORIES) {
        const entry = playoff.categorySchedule?.[category]
        out[cellKey(playoff.id, category)] = { timeslot: entry?.timeslot ?? "", court: entry?.court ?? "" }
      }
    }
    return out
  }

  const [open, setOpen] = useState(false)
  const [cells, setCells] = useState<Record<string, Cell>>(loadCells)

  function handleOpenChange(next: boolean) {
    if (next) setCells(loadCells())
    setOpen(next)
  }

  function updateCell(id: number, category: string, patch: Partial<Cell>) {
    setCells((prev) => ({ ...prev, [cellKey(id, category)]: { ...prev[cellKey(id, category)], ...patch } }))
  }

  function setCategoryTime(category: string, timeslot: string) {
    setCells((prev) => {
      const next = { ...prev }
      for (const playoff of playoffs) {
        next[cellKey(playoff.id, category)] = { ...next[cellKey(playoff.id, category)], timeslot }
      }
      return next
    })
  }

  // Cells that share the same day, timeslot and court (including other rounds already saved).
  const conflicts = useMemo(() => {
    const users = new Map<string, string[]>()
    const add = (key: string, cell: string) => users.set(key, [...(users.get(key) ?? []), cell])
    const editableIds = new Set(playoffs.map((playoff) => playoff.id))
    for (const playoff of playoffs) {
      for (const category of PLAYOFF_CATEGORIES) {
        const cell = cells[cellKey(playoff.id, category)]
        if (cell?.timeslot && cell?.court) {
          add(`${playoff.divisionId ?? "none"}|${playoffDayKey(playoff.matchDate)}|${cell.timeslot}|${cell.court}`, cellKey(playoff.id, category))
        }
      }
    }
    for (const other of occupiedBy) {
      if (editableIds.has(other.id)) continue
      for (const [category, entry] of Object.entries(other.categorySchedule ?? {})) {
        if (entry?.timeslot && entry?.court) {
          add(`${other.divisionId ?? "none"}|${playoffDayKey(other.matchDate)}|${entry.timeslot}|${entry.court}`, `other|${other.id}|${category}`)
        }
      }
    }
    const conflicted = new Set<string>()
    for (const members of users.values()) {
      if (members.length > 1) members.forEach((member) => conflicted.add(member))
    }
    return conflicted
  }, [cells, occupiedBy, playoffs])

  const missingTime = playoffs.some((playoff) =>
    PLAYOFF_CATEGORIES.some((category) => {
      const cell = cells[cellKey(playoff.id, category)]
      return !!cell?.court && !cell?.timeslot
    }),
  )

  function save() {
    const updates = playoffs.flatMap((playoff) =>
      PLAYOFF_CATEGORIES.map((category) => {
        const cell = cells[cellKey(playoff.id, category)]
        return { playoffId: playoff.id, category, timeslot: cell?.timeslot ?? "", court: cell?.court ?? "" }
      }),
    )
    const fd = new FormData()
    fd.set("updatesJson", JSON.stringify(updates))
    start(async () => {
      const res = await setPlayoffCategoryScheduleBulk(fd)
      if (res.ok) {
        toast.success(`${title} saved`)
        setOpen(false)
      } else toast.error(res.error ?? "Failed to save schedule")
    })
  }

  if (playoffs.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Choose the timeslot and court for each category match. Each court can only host one match per timeslot.
        </p>
        <div className="space-y-4">
          {PLAYOFF_CATEGORIES.map((category) => (
            <div key={category} className="space-y-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{category}</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Time for all
                  <select
                    value=""
                    onChange={(e) => e.target.value && setCategoryTime(category, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Select…</option>
                    {PLAYOFF_TIMESLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {playoffs.map((playoff) => {
                const key = cellKey(playoff.id, category)
                const cell = cells[key] ?? { timeslot: "", court: "" }
                const clash = conflicts.has(key)
                return (
                  <div key={key} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_100px_110px] md:items-center">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{fixtureLabel(playoff)}</p>
                      <p className="truncate text-sm">
                        {playoff.homeName} vs {playoff.awayName}
                      </p>
                    </div>
                    <select
                      value={cell.timeslot}
                      onChange={(e) => updateCell(playoff.id, category, { timeslot: e.target.value })}
                      className={`h-9 w-full rounded-md border bg-background px-2 text-sm ${clash ? "border-destructive" : "border-input"}`}
                    >
                      <option value="">Time TBD</option>
                      {PLAYOFF_TIMESLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cell.court}
                      onChange={(e) => updateCell(playoff.id, category, { court: e.target.value })}
                      className={`h-9 w-full rounded-md border bg-background px-2 text-sm ${clash ? "border-destructive" : "border-input"}`}
                    >
                      <option value="">Court TBD</option>
                      {PLAYOFF_COURTS.map((court) => (
                        <option key={court} value={court}>
                          {court}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {conflicts.size > 0 ? (
          <p className="text-xs font-medium text-destructive">
            Some matches share the same court and timeslot (highlighted in red). Change one of them to continue.
          </p>
        ) : null}
        {missingTime ? (
          <p className="text-xs font-medium text-destructive">Pick a timeslot for every match that has a court.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || conflicts.size > 0 || missingTime}>
            Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleDialog({
  p,
  venues,
  pending,
  start,
}: {
  p: Playoff
  venues: Venue[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(p.matchDate ? p.matchDate.slice(0, 10) : "")
  const categories = ["Ladies Open", "Mens Open", "Mens Intermediate", "Mens Beginner"]
  const [categorySchedule, setCategorySchedule] = useState<Record<string, { timeslot: string | null; court: string | null }>>(
    categories.reduce((acc, category) => {
      acc[category] = {
        timeslot: p.categorySchedule?.[category]?.timeslot ?? null,
        court: p.categorySchedule?.[category]?.court ?? null,
      }
      return acc
    }, {} as Record<string, { timeslot: string | null; court: string | null }>),
  )
  const [venueClubId, setVenueClubId] = useState(p.venueClubId ? String(p.venueClubId) : "")

  function save() {
    const fd = new FormData()
    fd.set("playoffId", String(p.id))
    fd.set("matchDate", date)
    fd.set("timeslot", "")
    fd.set("court", "")
    fd.set("categoryScheduleJson", JSON.stringify(categorySchedule))
    fd.set("venueClubId", venueClubId)
    start(async () => {
      const res = await setPlayoffSchedule(fd)
      if (res.ok) {
        toast.success("Schedule saved")
        setOpen(false)
      } else toast.error(res.error ?? "Failed to save")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs">
            {p.matchDate ? "Edit schedule" : "Schedule"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule fixture</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`date-${p.id}`}>Date</Label>
            <Input id={`date-${p.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Category schedule (per team category)</Label>
            <div className="space-y-2 rounded-md border border-input p-3">
              {categories.map((category) => (
                <div key={category} className="grid gap-2 md:grid-cols-[1fr_160px_140px] md:items-center">
                  <p className="text-sm font-medium">{category}</p>
                  <select
                    value={categorySchedule[category]?.timeslot ?? ""}
                    onChange={(e) =>
                      setCategorySchedule((prev) => ({
                        ...prev,
                        [category]: { ...prev[category], timeslot: e.target.value || null },
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select timeslot</option>
                    {PLAYOFF_TIMESLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  <select
                    value={categorySchedule[category]?.court ?? ""}
                    onChange={(e) =>
                      setCategorySchedule((prev) => ({
                        ...prev,
                        [category]: { ...prev[category], court: e.target.value || null },
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select court</option>
                    <option value="Court 1">Court 1</option>
                    <option value="Court 2">Court 2</option>
                    <option value="Court 3">Court 3</option>
                    <option value="Court 4">Court 4</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`venue-${p.id}`}>Venue</Label>
            <select
              id={`venue-${p.id}`}
              value={venueClubId}
              onChange={(e) => setVenueClubId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.courts} courts)
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

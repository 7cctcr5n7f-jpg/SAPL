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
import { pullPlayoffTeams, setPlayoffSchedule } from "@/lib/actions/admin"
import { FIXTURE_TIMESLOTS } from "@/lib/constants"
import { toast } from "sonner"
import { Swords, Trophy, Users, CalendarClock, MapPin } from "lucide-react"

type Venue = { id: number; name: string; courts: number }
type Playoff = {
  id: number
  type: string
  round: string
  divisionId: number | null
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
  venueClubId: number | null
  venue: string | null
}

export function PlayoffsManager({
  seasonId,
  seasonName,
  venues,
  playoffs,
}: {
  seasonId: number
  seasonName: string
  venues: Venue[]
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

  // Regional finals grouped by division; Tshwane Masters as its own bracket.
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
              Brackets are pre-seeded with placeholders (e.g. Premier 1st vs 4th). Pull teams to fill them from the live
              standings, then set each game&apos;s date, slot and court.
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
                  key={`div-${divId}`}
                  title={ps[0]?.homeName?.split(" ")[0] ? `${bracketDivisionName(ps)} — Regional Final` : "Regional Final"}
                  playoffs={ps}
                  venues={venues}
                  pending={pending}
                  start={start}
                />
              ))}
              {masters.length > 0 && (
                <Bracket
                  title="Tshwane Masters"
                  playoffs={masters}
                  venues={venues}
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

function bracketDivisionName(ps: Playoff[]) {
  // Labels look like "Premier 1st (East)" — take the leading division word(s).
  const label = ps.find((p) => p.round === "semi_final")?.homeName ?? ""
  const m = label.match(/^([A-Za-z0-9 ]+?)\s+\d/)
  return m ? m[1].trim() : "Division"
}

function Bracket({
  title,
  playoffs,
  venues,
  pending,
  start,
  crown,
}: {
  title: string
  playoffs: Playoff[]
  venues: Venue[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
  crown?: boolean
}) {
  const semis = playoffs.filter((p) => p.round === "semi_final").sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  const finals = playoffs.filter((p) => p.round === "final")
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold">
        {crown ? <Trophy className="h-4 w-4 text-primary" /> : <Swords className="h-4 w-4 text-primary" />}
        {title}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semi Finals</p>
          {semis.map((p) => (
            <BracketRow key={p.id} p={p} venues={venues} pending={pending} start={start} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-3 w-3" /> Final
          </p>
          {finals.map((p) => (
            <BracketRow key={p.id} p={p} venues={venues} pending={pending} start={start} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BracketRow({
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
  return (
    <div className="rounded-lg border border-border p-3">
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
            {new Date(p.matchDate).toLocaleDateString()} {p.timeslot ?? ""}
          </span>
        )}
        {p.venue && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {p.venue}
          </span>
        )}
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
  const [timeslot, setTimeslot] = useState(p.timeslot ?? FIXTURE_TIMESLOTS[0])
  const [venueClubId, setVenueClubId] = useState(p.venueClubId ? String(p.venueClubId) : "")

  function save() {
    const fd = new FormData()
    fd.set("playoffId", String(p.id))
    fd.set("matchDate", date)
    fd.set("timeslot", timeslot)
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
            <Label htmlFor={`slot-${p.id}`}>Timeslot</Label>
            <select
              id={`slot-${p.id}`}
              value={timeslot}
              onChange={(e) => setTimeslot(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {FIXTURE_TIMESLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`venue-${p.id}`}>Court / venue</Label>
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

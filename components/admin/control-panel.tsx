"use client"

import React, { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createSeason,
  setCurrentSeason,
  deleteSeason,
  generateSeason,
  finalizeSeasonFixturesFromPlanning,
  updateFixturePlanningPairing,
  setSeasonDivisions,
  validateSeasonAction,
  publishSeasonAction,
  unlockSeasonAction,
  deleteAllSeasonFixturesAction,
  updateSeasonStartDateAction,
} from "@/lib/actions/admin"
import type { SeasonValidation } from "@/lib/engine/validation"
import { DIVISIONS } from "@/lib/constants"
import { normalizeSeasonStatus, seasonStatusLabel } from "@/lib/season-lifecycle"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Crest } from "@/components/league-centre/crest"
import {
  Plus,
  CalendarRange,
  Layers,
  Wand2,
  Check,
  Trash2,
  ShieldCheck,
  Rocket,
  AlertTriangle,
  Undo2,
  CircleCheck,
  Lock,
  LockOpen,
  GripVertical,
} from "lucide-react"

type Division = { id: number; name: string; level: number; maxTeams: number; regionId: number | null }
type Region = { id: number; name: string }
type Season = {
  id: number
  name: string
  status: string
  isCurrent: boolean
  weeks: number
  startDate: Date | string | null
  regions: Region[]
  divisions: Division[]
}
type PlanningDivision = { id: number; name: string; level: number; maxTeams: number; regionId: number | null; regionName: string | null }
type PlanningPairing = {
  id: number
  seasonId: number
  divisionId: number
  round: number
  pairingOrder: number
  week: number | null
  teamAId: number
  teamBId: number
  teamAName: string
  teamBName: string
  teamALogoUrl?: string | null
  teamBLogoUrl?: string | null
  teamAHomeClubName?: string | null
  teamBHomeClubName?: string | null
  teamAHomeClubCourts?: number | null
  teamBHomeClubCourts?: number | null
  homeTeamId: number | null
  awayTeamId: number | null
  timeslot: string | null
}
type SeasonPlanning = { divisions: PlanningDivision[]; pairings: PlanningPairing[] }
function groupDivisions(season: Season) {
  const map = new Map<string, { key: string; region: string; divisions: Division[] }>()
  for (const d of season.divisions) {
    const key = d.regionId == null ? "none" : String(d.regionId)
    const region = d.regionId == null ? "League-wide" : regionName(season.regions, d.regionId)
    if (!map.has(key)) map.set(key, { key, region, divisions: [] })
    map.get(key)!.divisions.push(d)
  }
  return [...map.values()].sort((a, b) => a.region.localeCompare(b.region))
}

export function ControlPanel({
  seasons,
  planningBySeason,
  defaultRegionNames,
  currentSeasonReadiness,
}: {
  seasons: Season[]
  planningBySeason: Record<number, SeasonPlanning>
  defaultRegionNames: string[]
  currentSeasonReadiness: { seasonId: number; incompleteTeams: number; playersOutstanding: number } | null
}) {
  const [pending, start] = useTransition()

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" /> Seasons &amp; Divisions
        </CardTitle>
        <NewSeasonDialog pending={pending} start={start} defaultRegionNames={defaultRegionNames} />
      </CardHeader>
      <CardContent className="space-y-4">
        {seasons.length === 0 && (
          <p className="text-sm text-muted-foreground">No seasons yet. Create one to get started.</p>
        )}
        {seasons.map((s) => {
          const groups = groupDivisions(s)
          const startDt = s.startDate ? new Date(s.startDate) : null
          const hasFixtures = ["fixtures_generated", "league_locked"].includes(normalizeSeasonStatus(s.status))
          // Calculate last pool game and playoff weekend from start date + weeks.
          const lastPoolGameDate = startDt && s.weeks > 0
            ? new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate() + (s.weeks - 1) * 7))
            : null
          const playoffSaturday = lastPoolGameDate
            ? new Date(Date.UTC(lastPoolGameDate.getUTCFullYear(), lastPoolGameDate.getUTCMonth(), lastPoolGameDate.getUTCDate() + 9))
            : null
          const fmtDate = (d: Date) =>
            d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
          return (
            <div key={s.id} className="rounded-xl border border-border p-5">
              {/* Title + status + primary actions */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg font-semibold">{s.name}</span>
                    {s.isCurrent && <Badge>Current</Badge>}
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      {s.divisions.length} division{s.divisions.length === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {s.weeks > 0 ? `${s.weeks} week${s.weeks === 1 ? "" : "s"}` : "Weeks TBD"}
                    </span>
                    {startDt ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground/80">
                        Start: <strong>{fmtDate(startDt)}</strong>
                      </span>
                    ) : (
                      <span className="text-amber-600">⚠ No start date set</span>
                    )}
                    {hasFixtures && lastPoolGameDate && (
                      <span className="inline-flex items-center gap-1.5">
                        Last pool game: <strong>{fmtDate(lastPoolGameDate)}</strong>
                      </span>
                    )}
                    {hasFixtures && playoffSaturday && (
                      <span className="inline-flex items-center gap-1.5">
                        Playoff weekend: <strong>{fmtDate(playoffSaturday)}</strong>
                      </span>
                    )}
                  </div>
                  <StartDateEditor seasonId={s.id} currentDate={startDt} pending={pending} start={start} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!s.isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData()
                        fd.set("seasonId", String(s.id))
                        start(async () => {
                          await setCurrentSeason(fd)
                          toast.success("Season set as current")
                        })
                      }}
                    >
                      Make current
                    </Button>
                  )}
                  <ConfigureDivisionsDialog season={s} pending={pending} start={start} />
                  <DeleteSeasonDialog season={s} pending={pending} start={start} />
                </div>
              </div>

              {/* Divisions, grouped by region for readability */}
              {s.divisions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No divisions configured yet — use <span className="font-medium text-foreground">Divisions</span> to set
                  them up.
                </p>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {groups.map((g) => (
                    <div key={g.key} className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.region}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {g.divisions.map((d) => (
                          <Badge key={d.id} variant="secondary" className="gap-1 font-normal">
                            {d.name}
                            <span className="text-muted-foreground">· {d.maxTeams} max</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lifecycle: Registration Open -> Divisions Finalised -> Fixtures Generated -> League Locked */}
              <SeasonLifecycle
                season={s}
                planning={planningBySeason[s.id] ?? { divisions: [], pairings: [] }}
                readinessWarning={currentSeasonReadiness?.seasonId === s.id ? currentSeasonReadiness : null}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function StartDateEditor({
  seasonId,
  currentDate,
  pending,
  start,
}: {
  seasonId: number
  currentDate: Date | null
  pending: boolean
  start: React.TransitionStartFunction
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(
    currentDate
      ? `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}-${String(currentDate.getUTCDate()).padStart(2, "0")}`
      : "",
  )
  if (!editing) {
    return (
      <button
        type="button"
        className="text-xs text-primary underline-offset-2 hover:underline"
        onClick={() => setEditing(true)}
      >
        {currentDate ? "Change start date" : "Set start date"}
      </button>
    )
  }
  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 rounded border border-border bg-background px-2 text-sm"
      />
      <Button
        size="sm"
        disabled={pending || !value}
        onClick={() => {
          const fd = new FormData()
          fd.set("seasonId", String(seasonId))
          fd.set("startDate", value)
          start(async () => {
            const res = await updateSeasonStartDateAction(fd)
            if (res.ok) {
              toast.success("Start date saved")
              setEditing(false)
            } else {
              toast.error(res.error ?? "Failed to save")
            }
          })
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeSeasonStatus(status)
  const map: Record<string, string> = {
    registration_open: "bg-muted text-muted-foreground",
    registration_closed: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    divisions_finalised: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    fixtures_generated: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    league_locked: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  }
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", map[normalized] ?? map.registration_open)}>
      {seasonStatusLabel(status)}
    </span>
  )
}

/**
 * Lifecycle: Registration Open -> Divisions Finalised -> Fixtures Generated -> League Locked.
 *  - Generate fixtures creates draft fixtures only.
 *  - Validate checks the draft schedule.
 *  - Publish makes fixtures visible to clubs/players/public.
 *  - Unpublish moves the season back to draft fixtures.
 */
function SeasonLifecycle({
  season,
  planning,
  readinessWarning,
}: {
  season: Season
  planning: SeasonPlanning
  readinessWarning: { seasonId: number; incompleteTeams: number; playersOutstanding: number } | null
}) {
  const [pending, start] = useTransition()
  const [report, setReport] = useState<SeasonValidation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const status = normalizeSeasonStatus(season.status)
  const isActive = status === "league_locked"
  const hasFixtures = status === "fixtures_generated" || isActive

  function run<T extends { report?: SeasonValidation }>(
    action: (fd: FormData) => Promise<T & { ok: boolean; error?: string }>,
    okMsg: string,
    mutate?: (fd: FormData) => void,
  ) {
    const fd = new FormData()
    fd.set("seasonId", String(season.id))
    mutate?.(fd)
    start(async () => {
      const res = await action(fd)
      if (res.report) setReport(res.report)
      if (res.ok) toast.success(okMsg)
      else toast.error(res.error ?? "Action failed")
    })
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {isActive && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Lock className="h-4 w-4 shrink-0" />
          League is locked — new team creation, team names, home venues and club slot settings are locked. Players can still join incomplete teams.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || isActive || hasFixtures}
          onClick={() =>
            run(async (fd) => {
              const res = await generateSeason(fd)
              return res.ok ? { ...res } : { ok: false, error: res.error ?? "Failed to generate fixtures" }
            }, "Fixtures generated")
          }
        >
          <Wand2 className="mr-1 h-4 w-4" /> Generate fixtures
        </Button>

        <FixturePlanningDialog season={season} planning={planning} pending={pending} start={start} />

        {!isActive && hasFixtures && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async (fd) => {
                fd.set("force", "1")
                const res = await generateSeason(fd)
                return res.ok ? { ...res } : { ok: false, error: res.error ?? "Failed to regenerate fixtures" }
              }, "Draft fixtures regenerated")
            }
          >
            <Undo2 className="mr-1 h-4 w-4" /> Redo fixture generation
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={pending || !hasFixtures}
          onClick={() => run(validateSeasonAction, "Validation complete")}
        >
          <ShieldCheck className="mr-1 h-4 w-4" /> Validate Fixtures
        </Button>

        {isActive ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(unlockSeasonAction, "Fixtures moved back to draft")}
          >
            <LockOpen className="mr-1 h-4 w-4" /> Unpublish Fixtures
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              disabled={pending || status !== "fixtures_generated"}
              onClick={() => run(publishSeasonAction, "Fixtures published")}
            >
              <Rocket className="mr-1 h-4 w-4" /> Publish Fixtures
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || status !== "fixtures_generated"}
              onClick={() => run(publishSeasonAction, "Fixtures published with warnings", (fd) => fd.set("ignoreWarnings", "1"))}
            >
              <AlertTriangle className="mr-1 h-4 w-4" /> Publish with warnings
            </Button>
          </>
        )}

        {hasFixtures && (
          confirmDelete ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-destructive font-medium">Delete all fixtures?</span>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  setConfirmDelete(false)
                  run(async (fd) => {
                    const res = await deleteAllSeasonFixturesAction(fd)
                    return res.ok
                      ? { ok: true, deleted: res.deleted }
                      : { ok: false, error: res.error ?? "Failed to delete fixtures" }
                  }, "All fixtures deleted — season reset to divisions ready")
                }}
              >
                Yes, delete all
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete all fixtures
            </Button>
          )
        )}
      </div>

      {readinessWarning && (readinessWarning.incompleteTeams > 0 || readinessWarning.playersOutstanding > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {readinessWarning.incompleteTeams > 0 && <div>⚠ {readinessWarning.incompleteTeams} teams are still incomplete.</div>}
          {readinessWarning.playersOutstanding > 0 && <div>⚠ {readinessWarning.playersOutstanding} players still owe league fees.</div>}
          <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">These warnings do not block fixture generation.</div>
        </div>
      )}

      {report && <ValidationReport report={report} />}
    </div>
  )
}

function ValidationReport({ report }: { report: SeasonValidation }) {
  if (report.issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CircleCheck className="h-4 w-4 shrink-0" />
        No issues found — draft fixtures are ready to publish.
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {report.errors} error{report.errors === 1 ? "" : "s"} · {report.warnings} warning
        {report.warnings === 1 ? "" : "s"}
      </p>
      <ul className="space-y-1.5">
        {report.issues.map((i, idx) => (
          <li
            key={idx}
            className={cn(
              "flex items-start gap-2 text-sm",
              i.level === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
            )}
          >
            {i.level === "error" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
            )}
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FixturePlanningDialog({
    season,
    planning,
    pending,
    start,
  }: {
    season: Season
    planning: SeasonPlanning
    pending: boolean
    start: React.TransitionStartFunction
  }) {
    const [open, setOpen] = useState(false)
    const [local, setLocal] = useState<PlanningPairing[]>(planning.pairings)
    const [draggingPairingId, setDraggingPairingId] = useState<number | null>(null)
    const [divisionId, setDivisionId] = useState<number | "all">(
      planning.divisions[0]?.id ?? "all",
    )
    const weekCount = Math.max(season.weeks || 0, ...local.map((pairing) => pairing.round), 1)
    const weeks = Array.from({ length: weekCount }, (_, index) => index + 1)
    const visiblePairings =
      divisionId === "all" ? local : local.filter((pairing) => pairing.divisionId === divisionId)
    const unassigned = visiblePairings.filter((pairing) => pairing.week == null)
    const homeCounts = new Map<number, number>()
    const venueWeekCounts = new Map<string, number>()
    for (const pairing of visiblePairings) {
      const effectiveHomeTeamId = pairing.homeTeamId ?? pairing.teamAId
      const hostingVenue =
        effectiveHomeTeamId === pairing.teamAId
          ? pairing.teamAHomeClubName
          : pairing.teamBHomeClubName
      if (pairing.week != null) {
        if (hostingVenue != null) {
          if (pairing.teamAHomeClubName === hostingVenue) {
            homeCounts.set(pairing.teamAId, (homeCounts.get(pairing.teamAId) ?? 0) + 1)
          }
          if (pairing.teamBHomeClubName === hostingVenue) {
            homeCounts.set(pairing.teamBId, (homeCounts.get(pairing.teamBId) ?? 0) + 1)
          }
          const key = `${pairing.week}:${hostingVenue}`
          venueWeekCounts.set(key, (venueWeekCounts.get(key) ?? 0) + 1)
        }
      }
    }

    function syncPairing(pairingId: number, patch: Partial<Pick<PlanningPairing, "week" | "homeTeamId" | "awayTeamId" | "timeslot">>) {
      const current = local.find((pairing) => pairing.id === pairingId)
      const nextLocal = local.map((pairing) => (pairing.id === pairingId ? { ...pairing, ...patch } : pairing))
      setLocal(nextLocal)
      start(async () => {
        const res = await updateFixturePlanningPairing({
          pairingId,
          week: patch.week !== undefined ? patch.week : current?.week ?? null,
          homeTeamId: patch.homeTeamId !== undefined ? patch.homeTeamId : current?.homeTeamId,
          awayTeamId: patch.awayTeamId !== undefined ? patch.awayTeamId : current?.awayTeamId,
          timeslot:
            patch.timeslot !== undefined
              ? (patch.timeslot as "17:00" | "18:30" | null)
              : ((current?.timeslot as "17:00" | "18:30" | null | undefined) ?? null),
        })
        if (!res.ok) toast.error(res.error ?? "Could not save planning change")
      })
    }

    function swapHomeAway(pairing: PlanningPairing) {
      const nextHome = pairing.awayTeamId ?? pairing.teamBId
      const nextAway = pairing.homeTeamId ?? pairing.teamAId
      syncPairing(pairing.id, { homeTeamId: nextHome, awayTeamId: nextAway })
    }

    function handleDropOnWeek(week: number) {
      if (draggingPairingId == null) return
      syncPairing(draggingPairingId, { week })
      setDraggingPairingId(null)
    }

    function pairingWarnings(pairing: PlanningPairing, week: number) {
      const inWeek = local.filter((item) => item.week === week && item.id !== pairing.id)
      const teamIds = [pairing.homeTeamId ?? pairing.teamAId, pairing.awayTeamId ?? pairing.teamBId]
      const hostingVenue =
        (pairing.homeTeamId ?? pairing.teamAId) === pairing.teamAId
          ? pairing.teamAHomeClubName
          : pairing.teamBHomeClubName
      const conflict = inWeek.some((item) => {
        const otherIds = [item.homeTeamId ?? item.teamAId, item.awayTeamId ?? item.teamBId]
        return teamIds.some((teamId) => otherIds.includes(teamId))
      })
      return {
        teamConflict: conflict,
        duplicate: inWeek.some((item) => {
          const a = [item.teamAId, item.teamBId].sort((x, y) => x - y).join("-")
          const b = [pairing.teamAId, pairing.teamBId].sort((x, y) => x - y).join("-")
          return a === b
        }),
        missingVenue: !hostingVenue,
        venueConflict: false,
        timeConflict:
          hostingVenue != null &&
          pairing.timeslot != null &&
          inWeek.some((item) => {
            const otherVenue =
              (item.homeTeamId ?? item.teamAId) === item.teamAId
                ? item.teamAHomeClubName
                : item.teamBHomeClubName
            return otherVenue === hostingVenue && item.timeslot === pairing.timeslot
          }),
      }
    }

    function getAllowedTimeslots(pairing: PlanningPairing) {
      const effectiveHomeTeamId = pairing.homeTeamId ?? pairing.teamAId
      const homeCourts =
        effectiveHomeTeamId === pairing.teamAId
          ? pairing.teamAHomeClubCourts ?? null
          : pairing.teamBHomeClubCourts ?? null
      return homeCourts != null && homeCourts < 4 ? ["both"] : ["17:00", "18:30"]
    }

    const readyToFinalize =
      local.length > 0 &&
      local.every((pairing) => pairing.week != null && (pairing.homeTeamId ?? pairing.teamAId) != null && (pairing.awayTeamId ?? pairing.teamBId) != null && pairing.timeslot)

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" disabled={pending || planning.pairings.length === 0}>
              <GripVertical className="mr-1 h-4 w-4" /> Fixture planning
            </Button>
          }
        />
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Fixture Planning Wizard — {season.name}</DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[70vh] gap-4 overflow-hidden">
            <div className="w-[250px] shrink-0 space-y-3 overflow-y-auto pr-1">
              <div>
                <p className="text-sm font-medium">Available Pairings</p>
                <p className="text-xs text-muted-foreground">Assign a week, then choose home/away and time.</p>
              </div>
              <select
                className="h-9 rounded border border-border bg-background px-3 text-sm"
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value === "all" ? "all" : Number(e.target.value))}
              >
                <option value="all">All pools</option>
                {planning.divisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.regionName ? `${division.regionName} · ${division.name}` : division.name}
                  </option>
                ))}
              </select>
              <div className="space-y-2">
                {unassigned.map((pairing) => (
                  <PlanningCard
                    key={pairing.id}
                    pairing={pairing}
                    compact
                    draggable
                    onDragStart={() => setDraggingPairingId(pairing.id)}
                    onDragEnd={() => setDraggingPairingId(null)}
                    onWeekChange={(week) => syncPairing(pairing.id, { week })}
                    onSwap={() => swapHomeAway(pairing)}
                  />
                ))}
                {unassigned.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    All pairings for this pool have been assigned.
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 overflow-auto">
              <div className="mb-3 flex min-w-max items-start gap-3 overflow-x-auto pb-1">
                {[...new Map(visiblePairings.flatMap((pairing) => [
                  [pairing.teamAId, { name: pairing.teamAName, logoUrl: pairing.teamALogoUrl ?? null }],
                  [pairing.teamBId, { name: pairing.teamBName, logoUrl: pairing.teamBLogoUrl ?? null }],
                ])).entries()].map(([teamId, team]) => (
                  <div
                    key={`home-${teamId}`}
                    className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-md border border-border/70 bg-secondary/20 px-2 py-2 text-center"
                  >
                    <Crest name={team.name} logoUrl={team.logoUrl} size="sm" />
                    <div className="w-full text-[10px] leading-tight">
                      <div className="truncate font-medium">{team.name}</div>
                      <div className="text-muted-foreground">H {homeCounts.get(teamId) ?? 0}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid min-w-[1820px] gap-4 grid-cols-7">
                {weeks.map((week) => {
                  const items = visiblePairings.filter((pairing) => pairing.week === week)
                  const venuesForWeek = [...new Set(items.map((pairing) => {
                    const homeId = pairing.homeTeamId ?? pairing.teamAId
                    return homeId === pairing.teamAId ? pairing.teamAHomeClubName : pairing.teamBHomeClubName
                  }).filter((value): value is string => Boolean(value)))]
                  return (
                    <div
                      key={week}
                      className={cn(
                        "rounded-xl border p-3 min-w-[250px] transition-colors",
                        draggingPairingId != null && "bg-secondary/10",
                      )}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropOnWeek(week)}
                    >
                      {venuesForWeek.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {venuesForWeek.map((venueName) => (
                            <div
                              key={`${week}-${venueName}`}
                              className="rounded-md border border-border/60 bg-secondary/20 px-2 py-1 text-[11px] text-muted-foreground"
                            >
                              {venueName} · {venueWeekCounts.get(`${week}:${venueName}`) ?? 0}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="font-medium">Week {week}</p>
                        <p className="text-xs text-muted-foreground">
                          {items.length > 0 ? `✓ ${items.length} pairing${items.length === 1 ? "" : "s"} assigned` : "No pairings assigned yet"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {items.map((pairing) => {
                          const warnings = pairingWarnings(pairing, week)
                          return (
                            <div key={pairing.id} className="rounded-lg border bg-secondary/20 p-3">
                              <PlanningCard pairing={pairing} compact onWeekChange={(nextWeek) => syncPairing(pairing.id, { week: nextWeek })} onSwap={() => swapHomeAway(pairing)} />
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                className="h-7 rounded border border-border bg-background px-2 text-xs"
                                value={pairing.timeslot ?? ""}
                                onChange={(e) => syncPairing(pairing.id, { timeslot: e.target.value || null })}
                              >
                                <option value="">Time</option>
                                {getAllowedTimeslots(pairing).map((slot) => (
                                  <option key={slot} value={slot}>
                                    {slot === "both" ? "Both slots" : slot}
                                  </option>
                                ))}
                              </select>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => syncPairing(pairing.id, { week: null })}>
                                  Remove
                              </Button>
                              </div>
                              {(warnings.teamConflict || warnings.duplicate || warnings.missingVenue || warnings.venueConflict || warnings.timeConflict || !pairing.timeslot) && (
                                <div className="mt-2 space-y-1 text-[11px]">
                                  {warnings.teamConflict && <div className="text-amber-600">⚠ Team clash</div>}
                                  {warnings.duplicate && <div className="text-amber-600">⚠ Duplicate</div>}
                                  {warnings.missingVenue && <div className="text-amber-600">⚠ Missing venue</div>}
                                  {warnings.venueConflict && <div className="text-amber-600">⚠ Venue clash across pools</div>}
                                  {warnings.timeConflict && <div className="text-amber-600">⚠ Venue time clash across pools</div>}
                                  {!pairing.timeslot && <div className="text-amber-600">⚠ Missing time</div>}
                                </div>
                              )}
                            </div>
                        )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {readyToFinalize
                ? "Ready to create draft fixtures. Publish still happens later from the existing flow."
                : "Assign every pairing a week, home/away and time before creating fixtures."}
            </div>
            <Button
              disabled={pending || !readyToFinalize}
              onClick={() => {
                const fd = new FormData()
                fd.set("seasonId", String(season.id))
                start(async () => {
                  const res = await finalizeSeasonFixturesFromPlanning(fd)
                  if (res.ok) {
                    toast.success("Draft fixtures created from planning board")
                    setOpen(false)
                  } else {
                    toast.error(res.error ?? "Failed to create fixtures")
                  }
                })
              }}
            >
              Create draft fixtures
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  function PlanningCard({
    pairing,
    compact = false,
    draggable = false,
    onDragStart,
    onDragEnd,
    onWeekChange,
    onSwap,
  }: {
    pairing: PlanningPairing
    compact?: boolean
    draggable?: boolean
    onDragStart?: () => void
    onDragEnd?: () => void
    onWeekChange: (week: number | null) => void
    onSwap: () => void
  }) {
    const homeId = pairing.homeTeamId ?? pairing.teamAId
    const awayId = pairing.awayTeamId ?? pairing.teamBId
    const leftTeam = homeId === pairing.teamAId
      ? { name: pairing.teamAName, logoUrl: pairing.teamALogoUrl ?? null }
      : { name: pairing.teamBName, logoUrl: pairing.teamBLogoUrl ?? null }
    const rightTeam = awayId === pairing.teamAId
      ? { name: pairing.teamAName, logoUrl: pairing.teamALogoUrl ?? null }
      : { name: pairing.teamBName, logoUrl: pairing.teamBLogoUrl ?? null }

    return (
      <div
        className={cn("rounded-lg border bg-background p-2", draggable && "cursor-grab active:cursor-grabbing")}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <div className="min-w-0 space-y-1 text-center">
                <div className="flex justify-center">
                  <Crest name={leftTeam.name} logoUrl={leftTeam.logoUrl} size="sm" />
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{leftTeam.name}</div>
              </div>
              <button
                type="button"
                className="shrink-0 self-center text-[10px] text-muted-foreground transition hover:text-foreground"
                onClick={onSwap}
              >
                vs
              </button>
              <div className="min-w-0 space-y-1 text-center">
                <div className="flex justify-center">
                  <Crest name={rightTeam.name} logoUrl={rightTeam.logoUrl} size="sm" />
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{rightTeam.name}</div>
              </div>
            </div>
            {!compact && <div className="text-[10px] text-muted-foreground">Round {pairing.round}</div>}
          </div>
          {!compact && (
            <select
              className="h-7 rounded border border-border bg-background px-2 text-xs"
              value={pairing.week ?? ""}
              onChange={(e) => onWeekChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Assign week</option>
              {Array.from({ length: Math.max(pairing.round, 12) }, (_, index) => index + 1).map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    )
}

function DeleteSeasonDialog({
  season,
  pending,
  start,
}: {
  season: Season
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {season.name}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the season along with its divisions, placements, fixtures, standings and playoffs.
          Affected teams will be returned to unassigned. This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              const fd = new FormData()
              fd.set("seasonId", String(season.id))
              start(async () => {
                const res = await deleteSeason(fd)
                if (res.ok) {
                  toast.success("Season deleted")
                  setOpen(false)
                } else toast.error(res.error ?? "Failed to delete season")
              })
            }}
          >
            Delete season
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewSeasonDialog({
  pending,
  start,
  defaultRegionNames,
}: {
  pending: boolean
  start: (cb: () => Promise<void>) => void
  defaultRegionNames: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New season
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create season</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            start(async () => {
              const res = await createSeason(fd)
              if (res.ok) {
                toast.success("Season created")
                setOpen(false)
              } else toast.error(res.error ?? "Failed")
            })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="sname">Season name</Label>
            <Input id="sname" name="name" placeholder="e.g. Spring 2026" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="regionNames">Regions</Label>
            <Textarea
              id="regionNames"
              name="regionNames"
              rows={4}
              defaultValue={defaultRegionNames.join("\n")}
              placeholder={"Southern Conference\nEastern Conference\nNorthern Conference"}
            />
            <p className="text-xs text-muted-foreground">
              Enter one region per line. Only these regions will be created for the season.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTeams">Max teams per division</Label>
            <Input id="maxTeams" name="maxTeams" type="number" defaultValue={8} min={2} max={16} />
            <p className="text-xs text-muted-foreground">
              Each selected region gets all four divisions so you can drag teams straight in. Empty divisions are
              removed when you generate fixtures.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="playerFee">Player join fee (R, incl. VAT)</Label>
            <Input id="playerFee" name="playerFee" type="number" defaultValue={500} min={0} step={10} />
            <p className="text-xs text-muted-foreground">
              What each player pays to join the league this season. Teams whose club covers fees are billed the same
              amount per player.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="makeCurrent" className="h-4 w-4 rounded border-input" />
            Set as current season
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create season
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function regionName(regions: Region[], id: number) {
  return regions.find((r) => r.id === id)?.name ?? `Region ${id}`
}

// A region (rows) x division-level (columns) matrix. Tick the cells that should
// be active for the season; saving creates the missing divisions and removes
// the unticked ones that have no teams/fixtures yet.
function ConfigureDivisionsDialog({
  season,
  pending,
  start,
}: {
  season: Season
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  const [maxTeams, setMaxTeams] = useState(8)
  // Rows: regions (or a single league-wide row if no regions exist).
  const rows: { id: number | null; name: string }[] =
    season.regions.length > 0
      ? season.regions.map((r) => ({ id: r.id, name: r.name }))
      : [{ id: null, name: "League-wide" }]

  // Active set, keyed `${regionId}:${level}`.
  const keyOf = (regionId: number | null, level: number) => `${regionId ?? "none"}:${level}`
  const [active, setActive] = useState<Set<string>>(new Set())

  function resetFromSeason() {
    const next = new Set<string>()
    let max = 0
    for (const d of season.divisions) {
      next.add(keyOf(d.regionId, d.level))
      if (d.maxTeams > max) max = d.maxTeams
    }
    setActive(next)
    setMaxTeams(max || 8)
  }

  function toggle(regionId: number | null, level: number) {
    const k = keyOf(regionId, level)
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function toggleRow(regionId: number | null) {
    setActive((prev) => {
      const next = new Set(prev)
      const allOn = DIVISIONS.every((d) => next.has(keyOf(regionId, d.level)))
      for (const d of DIVISIONS) {
        const k = keyOf(regionId, d.level)
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }

  function save() {
    const cells = rows.flatMap((row) =>
      DIVISIONS.map((d) => ({
        regionId: row.id,
        name: d.name,
        level: d.level,
        maxTeams,
        active: active.has(keyOf(row.id, d.level)),
      })),
    )
    start(async () => {
      const res = await setSeasonDivisions({ seasonId: season.id, cells })
      if (res.ok) {
        const parts = [
          res.created ? `${res.created} added` : "",
          res.removed ? `${res.removed} removed` : "",
          res.skipped ? `${res.skipped} kept (in use)` : "",
        ].filter(Boolean)
        toast.success(parts.length ? `Divisions updated: ${parts.join(", ")}` : "Divisions saved")
        setOpen(false)
      } else toast.error("Failed to update divisions")
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) resetFromSeason()
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Layers className="mr-1 h-4 w-4" /> Divisions
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure divisions — {season.name}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Tick which divisions run in each region. Existing divisions with placed teams or fixtures
          are protected and won&apos;t be removed.
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2 text-left font-medium">Region</th>
                {DIVISIONS.map((d) => (
                  <th key={d.level} className="px-2 py-2 text-center font-medium">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id ?? "none"} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleRow(row.id)}
                      className="font-medium text-foreground hover:text-primary"
                      title="Toggle all divisions in this region"
                    >
                      {row.name ?? "No region"}
                    </button>
                  </td>
                  {DIVISIONS.map((d) => {
                    const on = active.has(keyOf(row.id, d.level))
                    return (
                      <td key={d.level} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(row.id, d.level)}
                          aria-pressed={on}
                          aria-label={`${row.name} ${d.name}`}
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-md border transition",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-transparent hover:border-primary/50",
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <Label htmlFor="maxTeams" className="text-sm">
            Max teams per division
          </Label>
          <Input
            id="maxTeams"
            type="number"
            min={2}
            max={20}
            value={maxTeams}
            onChange={(e) => setMaxTeams(Number(e.target.value) || 8)}
            className="w-24"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save divisions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

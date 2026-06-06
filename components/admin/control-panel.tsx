"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import {
  createSeason,
  setCurrentSeason,
  deleteSeason,
  generateSeason,
  setSeasonDivisions,
  validateSeasonAction,
  publishSeasonAction,
  revertSeasonToDraftAction,
} from "@/lib/actions/admin"
import type { SeasonValidation } from "@/lib/engine/validation"
import { DIVISIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
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
} from "lucide-react"

type Division = { id: number; name: string; level: number; maxTeams: number; regionId: number | null }
type Region = { id: number; name: string }
type Season = {
  id: number
  name: string
  status: string
  isCurrent: boolean
  weeks: number
  regions: Region[]
  divisions: Division[]
}
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

export function ControlPanel({ seasons }: { seasons: Season[] }) {
  const [pending, start] = useTransition()

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" /> Seasons &amp; Divisions
        </CardTitle>
        <NewSeasonDialog pending={pending} start={start} />
      </CardHeader>
      <CardContent className="space-y-4">
        {seasons.length === 0 && (
          <p className="text-sm text-muted-foreground">No seasons yet. Create one to get started.</p>
        )}
        {seasons.map((s) => {
          const groups = groupDivisions(s)
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
                      {s.weeks} week{s.weeks === 1 ? "" : "s"}
                    </span>
                  </div>
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

              {/* Lifecycle: Draft -> Validated -> Published */}
              <SeasonLifecycle season={s} />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    validated: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  }
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium capitalize", map[status] ?? map.draft)}>
      {status}
    </span>
  )
}

/**
 * The Draft -> Validated -> Published workflow for one season. Generate builds
 * a draft schedule; Validate checks venue/timeslot collisions and division
 * completeness; Publish makes the schedule live (and is gated on a clean
 * validation). The latest validation report is shown inline.
 */
function SeasonLifecycle({ season }: { season: Season }) {
  const [pending, start] = useTransition()
  const [report, setReport] = useState<SeasonValidation | null>(null)
  const status = season.status

  function run<T extends { report?: SeasonValidation }>(
    action: (fd: FormData) => Promise<T & { ok: boolean; error?: string }>,
    okMsg: string,
  ) {
    const fd = new FormData()
    fd.set("seasonId", String(season.id))
    start(async () => {
      const res = await action(fd)
      if (res.report) setReport(res.report)
      if (res.ok) toast.success(okMsg)
      else toast.error(res.error ?? "Action failed")
    })
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(async (fd) => {
              const res = await generateSeason(fd)
              return res.ok
                ? { ...res }
                : { ok: false, error: res.error ?? "Failed to generate season" }
            }, "Draft schedule generated")
          }
        >
          <Wand2 className="mr-1 h-4 w-4" /> {status === "draft" ? "Generate season" : "Regenerate"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(validateSeasonAction, "Season validated")}
        >
          <ShieldCheck className="mr-1 h-4 w-4" /> Validate
        </Button>

        <Button
          size="sm"
          disabled={pending || status === "draft"}
          onClick={() => run(publishSeasonAction, "Season published")}
        >
          <Rocket className="mr-1 h-4 w-4" /> Publish
        </Button>

        {status !== "draft" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => run(revertSeasonToDraftAction, "Reverted to draft")}
          >
            <Undo2 className="mr-1 h-4 w-4" /> Back to draft
          </Button>
        )}
      </div>

      {report && <ValidationReport report={report} />}
    </div>
  )
}

function ValidationReport({ report }: { report: SeasonValidation }) {
  if (report.issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CircleCheck className="h-4 w-4 shrink-0" />
        No issues found — schedule is ready to publish.
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
}: {
  pending: boolean
  start: (cb: () => Promise<void>) => void
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
              <Label htmlFor="weeks">Weeks</Label>
              <Input id="weeks" name="weeks" type="number" defaultValue={7} min={1} max={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
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
  return regions.find((r) => r.id === id)?.name.replace("Tshwane ", "") ?? `Region ${id}`
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
                      {row.name.replace("Tshwane ", "")}
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

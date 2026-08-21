"use client"

import { useMemo, useState, useTransition } from "react"
import ExcelJS from "exceljs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SegmentedTabs, StatGrid } from "@/components/shared/dense"
import { toast } from "sonner"
import { FIXTURE_TIMESLOTS } from "@/lib/constants"
import {
  CATEGORIES,
  CATEGORY_COUNT,
  categoryReady,
  deriveOpsStatus,
  defaultCourtAssignments,
  type OpsStatus,
} from "@/lib/fixtures-ops"
import { publishFixture, saveCategoryAssignment, saveFixtureSchedule } from "@/lib/actions/fixtures"
import { ResultEntry } from "@/components/captain/result-entry"
import type { DashboardFixture, FixtureHealth, HostClub } from "@/lib/queries-fixtures"
import {
  ChevronRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Search,
  Trophy,
  ClipboardList,
  Download,
  Pencil,
} from "lucide-react"

const FIXTURE_EDIT_TIMESLOTS = [...FIXTURE_TIMESLOTS, "17:30", "18:00", "19:00", "19:30", "20:00"] as const

type StatusFilter = "all" | OpsStatus | "needs_attention" | "published"

function teamLabel(name: string | null, slot: number | null) {
  if (name) return { text: name, placeholder: false }
  if (slot) return { text: `Slot ${slot}`, placeholder: true }
  return { text: "TBD", placeholder: true }
}

function fmtShortDate(value: Date | string | null) {
  if (!value) return "TBD"
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "TBD"
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "2-digit" }).format(d)
}

function fmtExportDate(value: Date | string | null) {
  if (!value) return ""
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function resultsEntered(f: DashboardFixture): number {
  return f.matches.filter((m) => m.winnerTeamId != null).length
}

function formatPairingNames(names: { name: string; email: string | null; playtomicUrl: string | null }[] | undefined) {
  const players = names ?? []
  const playerNames = players.map((player) => player.name)
  if (playerNames.length >= 2) return playerNames.slice(0, 2).join(" / ")
  if (playerNames.length === 1) return `${playerNames[0]} / TBC`
  return "TBC / TBC"
}

function sanitizePlaytomicUrl(url: string | null | undefined) {
  if (!url) return null
  const start = url.indexOf("https://")
  const trimmedStart = start >= 0 ? url.slice(start) : url
  const end = trimmedStart.indexOf(")")
  return (end >= 0 ? trimmedStart.slice(0, end) : trimmedStart).trim()
}

function exportPlayerCell(player: { name: string; email: string | null; playtomicUrl: string | null } | undefined) {
  if (!player) return { v: "TBC" }
  const label = player.email ? `${player.name} (${player.email})` : player.name
  const cleanUrl = sanitizePlaytomicUrl(player.playtomicUrl)
  if (!cleanUrl) return { v: label, hyperlink: null }
  return { v: label, hyperlink: cleanUrl }
}

function exportBookingCell(link: string | null | undefined) {
  if (!link) {
    return {
      v: "ADD BOOKING LINK HERE",
      needsAttention: true,
      hyperlink: null,
    }
  }
  return {
    v: link,
    hyperlink: link,
  }
}

export function OpsConsole({
  seasonName,
  canManageVenue,
  fixtures,
  clubs,
  divisionTeams,
  health,
}: {
  seasonName: string | null
  canManageVenue: boolean
  fixtures: DashboardFixture[]
  clubs: HostClub[]
  divisionTeams: Record<number, { id: number; name: string }[]>
  health: FixtureHealth
}) {
  const weeks = useMemo(() => Array.from(new Set(fixtures.map((f) => f.week))).sort((a, b) => a - b), [fixtures])

  const regionOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const f of fixtures) if (f.regionId != null) map.set(f.regionId, f.regionName ?? `Region ${f.regionId}`)
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [fixtures])

  const divisionOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; level: number; region: string | null; regionId: number | null }>()
    for (const f of fixtures) {
      if (f.divisionId && !map.has(f.divisionId)) {
        map.set(f.divisionId, {
          id: f.divisionId,
          name: f.divisionName ?? `Division ${f.divisionId}`,
          level: f.divisionLevel ?? 99,
          region: f.regionName,
          regionId: f.regionId,
        })
      }
    }
    return [...map.values()].sort(
      (a, b) => (a.region ?? "").localeCompare(b.region ?? "") || a.level - b.level || a.name.localeCompare(b.name),
    )
  }, [fixtures])

  const venueOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of clubs) map.set(c.id, c.name)
    for (const f of fixtures) {
      if (f.venueClubId != null && !map.has(f.venueClubId)) {
        map.set(f.venueClubId, f.venueClubName ?? f.venue ?? `Venue ${f.venueClubId}`)
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [fixtures, clubs])

  const [week, setWeek] = useState<number | "all">("all")
  const [regionId, setRegionId] = useState<number | "all">("all")
  const [divisionId, setDivisionId] = useState<number | "all">("all")
  const [venueId, setVenueId] = useState<number | "all">("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showActionRequired, setShowActionRequired] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return fixtures.filter((f) => {
      if (week !== "all" && f.week !== week) return false
      if (regionId !== "all" && f.regionId !== regionId) return false
      if (divisionId !== "all" && f.divisionId !== divisionId) return false
      if (venueId !== "all" && f.venueClubId !== venueId) return false
      if (status !== "all") {
        const s = deriveOpsStatus(f).status
        if (status === "needs_attention") {
          if (s !== "missing_links" && s !== "planned") return false
        } else if (status === "published") {
          if (!f.published) return false
        } else if (s !== status) return false
      }
      if (q) {
        const hay = `${f.homeName ?? ""} ${f.awayName ?? ""} ${f.divisionName ?? ""} ${f.regionName ?? ""} ${f.venueClubName ?? f.venue ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [fixtures, week, regionId, divisionId, venueId, status, search])

  // Action Required queue: buckets that map to a status filter.
  const actionItems = [
    {
      key: "needs_attention" as StatusFilter,
      label: "Fixtures need booking details",
      count: health.missingLinks,
      tone: "text-orange-400",
      icon: AlertTriangle,
    },
    {
      key: "awaiting_result" as StatusFilter,
      label: "Published, awaiting results",
      count: health.awaitingResults,
      tone: "text-amber-400",
      icon: Trophy,
    },
  ].filter((a) => a.count > 0)

  const statusTabs = [
    { value: "all", label: "All" },
    { value: "draft", label: "Drafts" },
    { value: "planned", label: "Planned" },
    { value: "missing_links", label: "Missing Links" },
    { value: "awaiting_result", label: "Awaiting Result" },
    { value: "completed", label: "Completed" },
    { value: "published", label: "Published" },
  ]

  const activeDivisions = regionId === "all" ? divisionOptions : divisionOptions.filter((d) => d.regionId === regionId)
  const selectedVenueName = venueId === "all" ? null : venueOptions.find((option) => option.id === venueId)?.name ?? null

  async function exportVenueSheet() {
    if (venueId === "all" || filtered.length === 0) return
    const header = ["Week", "Date", "Fixture Time", "Court", "Category", "Venue", "Home Team", "Away Team", "Home Player 1", "Home Player 2", "Away Player 1", "Away Player 2", "Booking Link"]
    const rows = filtered.flatMap((fixture) =>
      CATEGORIES.map((category) => {
        const assignment = fixture.courtAssignments?.[category.category] ?? defaultCourtAssignments(fixture.venueCourts)[category.category]
        const link = fixture.courtLinks?.[category.category] ?? ""
        const homePlayers = fixture.homePlayers[category.category] ?? []
        const awayPlayers = fixture.awayPlayers[category.category] ?? []
        return [
          fixture.week,
          fixture.matchDate ? fmtExportDate(fixture.matchDate) : "",
          assignment?.time ?? fixture.timeslot ?? "",
          assignment?.court ?? "",
          category.category,
          fixture.venueClubName ?? fixture.venue ?? "",
          fixture.homeName ?? "TBC",
          fixture.awayName ?? "TBC",
          exportPlayerCell(homePlayers[0]),
          exportPlayerCell(homePlayers[1]),
          exportPlayerCell(awayPlayers[0]),
          exportPlayerCell(awayPlayers[1]),
          exportBookingCell(link),
        ]
      }),
    )
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Venue sheet", {
      views: [{ state: "frozen", ySplit: 1 }],
    })

    worksheet.addRow(header)
    rows.forEach((row) => {
      const excelRow = worksheet.addRow(row.map((cell) => (typeof cell === "object" && cell !== null && "v" in cell ? cell.v : cell)))
      row.forEach((cell, index) => {
        if (typeof cell !== "object" || cell === null || !("v" in cell)) return
        const excelCell = excelRow.getCell(index + 1)
        if ("hyperlink" in cell && cell.hyperlink) {
          excelCell.value = { text: cell.v, hyperlink: cell.hyperlink }
          excelCell.font = { color: { argb: "FF0563C1" }, underline: true }
        }
        if ("needsAttention" in cell && cell.needsAttention) {
          excelCell.font = { color: { argb: "FFB91C1C" }, bold: true }
          excelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }
          excelCell.alignment = { horizontal: "center", vertical: "middle" }
        }
      })
    })

    worksheet.columns = [
      { width: 8 },
      { width: 14 },
      { width: 14 },
      { width: 8 },
      { width: 20 },
      { width: 28 },
      { width: 26 },
      { width: 26 },
      { width: 24 },
      { width: 24 },
      { width: 24 },
      { width: 24 },
      { width: 42 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.height = 22
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      }
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        }
        if (!cell.fill || !("fgColor" in cell.fill)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
          }
        }
        if (!cell.alignment) {
          cell.alignment = {
            horizontal: colNumber <= 5 ? "center" : "left",
            vertical: "middle",
            wrapText: true,
          }
        }
      })
    })

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: header.length },
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${(selectedVenueName ?? "venue").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-fixtures.xlsx`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Venue fixture sheet exported")
  }

  return (
    <div className="space-y-5">
      <section aria-label="Fixture overview" className="space-y-2">
        <StatGrid
          columns={3}
          stats={[
            { label: "Total fixtures", value: <span className="text-foreground">{health.total}</span> },
            { label: "Published", value: <span className="text-foreground">{health.published}</span> },
            { label: "Need attention", value: <span className="text-foreground">{health.missingLinks}</span> },
          ]}
        />
        <SegmentedTabs
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={statusTabs}
          className="w-full"
        />
      </section>

      {/* Action Required */}
      {actionItems.length > 0 && (
        <section aria-label="Action required" className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setShowActionRequired((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
            aria-expanded={showActionRequired}
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Action Required</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
                {actionItems.length}
              </span>
            </span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showActionRequired && "rotate-90")} />
          </button>
          {showActionRequired && (
            <ul className="divide-y divide-border border-t border-border">
              {actionItems.map((a) => (
                <li key={a.key}>
                  <button
                    onClick={() => setStatus(a.key)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/50"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-foreground">
                      <a.icon className={cn("h-4 w-4", a.tone)} />
                      {a.label}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono font-bold text-foreground tabular-nums">{a.count}</span>
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Sticky filters */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, division, venue…"
            className="h-9 pl-8"
            aria-label="Search fixtures"
          />
        </div>
        <FilterSelect value={week} onChange={(v) => setWeek(v)} label="Week" allLabel="All weeks" options={weeks.map((w) => ({ value: w, label: `Week ${w}` }))} />
        {regionOptions.length > 1 && (
          <FilterSelect
            value={regionId}
            onChange={(v) => {
              setRegionId(v)
              setDivisionId("all")
            }}
            label="Region"
            allLabel="All regions"
            options={regionOptions.map((r) => ({ value: r.id, label: r.name }))}
          />
        )}
        <FilterSelect
          value={divisionId}
          onChange={(v) => setDivisionId(v)}
          label="Division"
          allLabel="All divisions"
          options={activeDivisions.map((d) => ({ value: d.id, label: d.region ? `${d.region} · ${d.name}` : d.name }))}
        />
        <FilterSelect value={venueId} onChange={(v) => setVenueId(v)} label="Venue" allLabel="All venues" options={venueOptions.map((v) => ({ value: v.id, label: v.name }))} />
        {venueId !== "all" && filtered.length > 0 && (
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={exportVenueSheet}>
            <Download className="mr-1 h-4 w-4" /> Export venue sheet
          </Button>
        )}
        {(status !== "all" || week !== "all" || regionId !== "all" || divisionId !== "all" || venueId !== "all" || search) && (
          <button
            onClick={() => {
              setStatus("all")
              setWeek("all")
              setRegionId("all")
              setDivisionId("all")
              setVenueId("all")
              setSearch("")
            }}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[7rem_3rem_1fr_1fr_10rem_5rem_5rem] items-center gap-3 border-b border-border bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Status</span>
          <span>Wk</span>
          <span>Home</span>
          <span>Away</span>
          <span>Venue</span>
          <span className="text-center">Courts</span>
          <span className="text-center">Results</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No fixtures match the current filters.</p>
        ) : (
          filtered.map((f) => (
            <ConsoleRow
              key={f.id}
              f={f}
              canManageVenue={canManageVenue}
              clubs={clubs}
              divisionTeams={divisionTeams[f.divisionId] ?? []}
              expanded={expandedId === f.id}
              editing={editingId === f.id}
              onToggle={() => setExpandedId((id) => (id === f.id ? null : f.id))}
              onEditToggle={() => {
                setExpandedId(f.id)
                setEditingId((id) => (id === f.id ? null : f.id))
              }}
            />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {seasonName ? `${seasonName} · ` : ""}
        {filtered.length} of {fixtures.length} fixtures shown. Players only see a fixture in League Centre once it is published.
      </p>
    </div>
  )
}

function FilterSelect<T extends number>({
  value,
  onChange,
  label,
  allLabel,
  options,
}: {
  value: T | "all"
  onChange: (v: T | "all") => void
  label: string
  allLabel: string
  options: { value: T; label: string }[]
}) {
  if (options.length === 0) return null
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === "all" ? "all" : (Number(e.target.value) as T))}
      className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
      aria-label={`Filter by ${label.toLowerCase()}`}
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function ConsoleRow({
  f,
  canManageVenue,
  clubs,
  divisionTeams,
  expanded,
  editing,
  onToggle,
  onEditToggle,
}: {
  f: DashboardFixture
  canManageVenue: boolean
  clubs: HostClub[]
  divisionTeams: { id: number; name: string }[]
  expanded: boolean
  editing: boolean
  onToggle: () => void
  onEditToggle: () => void
}) {
  const info = deriveOpsStatus(f)
  const home = teamLabel(f.homeName, f.homeSlot)
  const away = teamLabel(f.awayName, f.awaySlot)
  const venueName = f.venueClubName ?? f.venue
  const resCount = resultsEntered(f)
  const done = f.status === "completed"
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId

  return (
    <div className={cn("border-b border-border last:border-b-0", expanded && "bg-secondary/30")}>
      <div className="flex items-start gap-2 px-4 py-1.5">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="grid min-w-0 flex-1 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-2.5 text-left lg:grid-cols-[7rem_3rem_1fr_1fr_10rem_5rem_5rem] lg:items-center"
        >
          <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform lg:hidden", expanded && "rotate-90")} />
          <span className={cn("hidden rounded-full px-2 py-0.5 text-center text-[11px] font-semibold lg:inline-block", info.tone)}>
            {info.label}
          </span>

          <div className="min-w-0 lg:contents">
            <span className="hidden text-sm text-muted-foreground lg:inline">{f.week}</span>

            <div className="flex min-w-0 flex-col gap-0.5 lg:block">
              <span className={cn("truncate text-sm font-semibold text-foreground", home.placeholder && "italic text-muted-foreground")}>{home.text}</span>
              <span className={cn("truncate text-sm font-semibold text-foreground lg:hidden", away.placeholder && "italic text-muted-foreground")}>{away.text}</span>
            </div>
            <span className={cn("hidden truncate text-sm font-semibold text-foreground lg:block", away.placeholder && "italic text-muted-foreground")}>{away.text}</span>

            <span className="hidden min-w-0 items-center gap-1 truncate text-sm text-muted-foreground lg:flex">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{venueName ?? "TBD"}</span>
            </span>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground lg:hidden">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", info.tone)}>{info.label}</span>
              <span>Wk {f.week}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {venueName ?? "TBD"}
              </span>
              {done && (
                <span className="font-mono text-xs font-bold tabular-nums">
                  <span className={cn(homeWon && "text-primary")}>{f.homePoints ?? 0}</span>
                  <span className="text-muted-foreground">–</span>
                  <span className={cn(!homeWon && "text-primary")}>{f.awayPoints ?? 0}</span>
                </span>
              )}
            </div>

          </div>
        </button>

        {canManageVenue && (
          <Button
            type="button"
            size="sm"
            variant={editing ? "default" : "outline"}
            className="shrink-0 text-foreground"
            onClick={onEditToggle}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      {expanded && <FixtureDetail f={f} canManageVenue={canManageVenue} clubs={clubs} divisionTeams={divisionTeams} editing={editing} />}
    </div>
  )
}

function FixtureDetail({
  f,
  canManageVenue,
  clubs,
  divisionTeams,
  editing,
}: {
  f: DashboardFixture
  canManageVenue: boolean
  clubs: HostClub[]
  divisionTeams: { id: number; name: string }[]
  editing: boolean
}) {
  const [showResults, setShowResults] = useState(false)
  const [publishing, startPublishing] = useTransition()
  const canEdit = f.canEditLink
  const bothTeams = f.homeTeamId != null && f.awayTeamId != null
  const publishGate = deriveOpsStatus(f)

  const initialScores = useMemo(() => {
    const out: Record<string, { home: number; away: number }[]> = {}
    for (const m of f.matches) if (m.sets.length > 0) out[m.category] = m.sets
    return out
  }, [f.matches])

  return (
    <div className="space-y-2 border-t border-border bg-background/40 px-4 py-2">
      {canManageVenue && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!f.published && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  startPublishing(async () => {
                    const res = await publishFixture(f.id)
                    if (!res.ok) {
                      toast.error(res.error ?? "Could not publish fixture.")
                      return
                    }
                    const warnings = res.report?.warnings ?? 0
                    toast.success(warnings > 0 ? `Fixture published with ${warnings} warning${warnings === 1 ? "" : "s"}.` : "Fixture published")
                  })
                }
                disabled={publishing || publishGate.status === "draft"}
              >
                {publishing ? "Publishing..." : "Publish"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  startPublishing(async () => {
                    const res = await publishFixture(f.id, { ignoreWarnings: true })
                    if (!res.ok) {
                      toast.error(res.error ?? "Could not publish fixture.")
                      return
                    }
                    toast.success("Fixture published with warnings")
                  })
                }
                disabled={publishing || publishGate.status === "draft"}
              >
                Publish with warnings
              </Button>
            </>
          )}
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-0.5 rounded-md border border-border overflow-hidden">
        {CATEGORIES.map((c) => (
          <CategoryEditor
            key={c.category}
            fixtureId={f.id}
            matchDate={f.matchDate}
            category={c.category}
            isFeature={c.isFeatureCourt}
            canEdit={canEdit}
            editing={editing}
            assignment={f.courtAssignments?.[c.category] ?? defaultCourtAssignments(f.venueCourts)[c.category]}
            link={f.courtLinks?.[c.category] ?? ""}
            match={f.matches.find((m) => m.category === c.category)}
            homeName={formatPairingNames(f.homePlayers[c.category])}
            awayName={formatPairingNames(f.awayPlayers[c.category])}
          />
        ))}
      </div>

      {/* Result entry */}
      {canManageVenue && editing && <DraftScheduleEditor f={f} clubs={clubs} divisionTeams={divisionTeams} />}

      {bothTeams && (
        <div className="rounded-md border border-border">
          <button
            onClick={() => setShowResults((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            aria-expanded={showResults}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              {f.status === "completed" ? "Edit Result" : "Enter Result"}
            </span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showResults && "rotate-90")} />
          </button>
          {showResults && (
            <div className="border-t border-border p-3">
              <ResultEntry
                fixtureId={f.id}
                homeName={f.homeName ?? "Home"}
                awayName={f.awayName ?? "Away"}
                categories={CATEGORIES.map((c) => ({ category: c.category, session: c.session, isFeatureCourt: c.isFeatureCourt }))}
                initialScores={initialScores}
                isEdit={f.status === "completed"}
                allowClear={f.status === "completed"}
                onDone={() => setShowResults(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DraftScheduleEditor({
  f,
  clubs,
  divisionTeams,
}: {
  f: DashboardFixture
  clubs: HostClub[]
  divisionTeams: { id: number; name: string }[]
}) {
  const [week, setWeek] = useState(String(f.week))
  const [matchDate, setMatchDate] = useState(
    f.matchDate ? new Date(f.matchDate).toISOString().slice(0, 10) : "",
  )
  const [venueClubId, setVenueClubId] = useState<string>(f.venueClubId != null ? String(f.venueClubId) : "")
  const [timeslot, setTimeslot] = useState(f.timeslot ?? "")
  const [homeTeamId, setHomeTeamId] = useState<string>(f.homeTeamId != null ? String(f.homeTeamId) : "")
  const [awayTeamId, setAwayTeamId] = useState<string>(f.awayTeamId != null ? String(f.awayTeamId) : "")
  const [pending, start] = useTransition()

  const dirty =
    week !== String(f.week) ||
    matchDate !== (f.matchDate ? new Date(f.matchDate).toISOString().slice(0, 10) : "") ||
    venueClubId !== (f.venueClubId != null ? String(f.venueClubId) : "") ||
    timeslot !== (f.timeslot ?? "") ||
    homeTeamId !== (f.homeTeamId != null ? String(f.homeTeamId) : "") ||
    awayTeamId !== (f.awayTeamId != null ? String(f.awayTeamId) : "")

  function swapTeams() {
    setHomeTeamId(awayTeamId)
    setAwayTeamId(homeTeamId)
  }

  function save() {
    start(async () => {
      const res = await saveFixtureSchedule({
        fixtureId: f.id,
        week: Number(week),
        matchDate: matchDate || null,
        venueClubId: venueClubId ? Number(venueClubId) : null,
        timeslot: timeslot || null,
        homeTeamId: Number(homeTeamId),
        awayTeamId: Number(awayTeamId),
      })
      if (!res.ok) {
        toast.error(res.error ?? "Could not save draft fixture.")
        return
      }
      const errors = res.report?.errors ?? 0
      const warnings = res.report?.warnings ?? 0
      toast.success(
        errors > 0 || warnings > 0
          ? `Fixture updated · validation ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`
          : "Fixture updated",
      )
    })
  }

  return (
    <div className="rounded-md border border-border bg-card/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Draft schedule editor</h3>
        <Button type="button" size="sm" variant="outline" onClick={swapTeams}>
          Swap Home/Away
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Week</span>
          <Input value={week} onChange={(e) => setWeek(e.target.value)} inputMode="numeric" className="h-9" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Date</span>
          <Input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="h-9" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Timeslot</span>
          <select value={timeslot} onChange={(e) => setTimeslot(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            <option value="">Unscheduled</option>
            {FIXTURE_EDIT_TIMESLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Home team</span>
          <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            <option value="">Select home team</option>
            {divisionTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Away team</span>
          <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            <option value="">Select away team</option>
            {divisionTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Venue</span>
          <select value={venueClubId} onChange={(e) => setVenueClubId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            <option value="">Default home venue</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </div>
  )
}

function CategoryEditor({
  fixtureId,
  matchDate,
  category,
  isFeature,
  canEdit,
  editing,
  assignment,
  link,
  match,
  homeName,
  awayName,
}: {
  fixtureId: number
  matchDate: Date | string | null
  category: string
  isFeature: boolean
  canEdit: boolean
  editing: boolean
  assignment: { court: string | null; time: string | null }
  link: string
  match?: DashboardFixture["matches"][number]
  homeName: string
  awayName: string
}) {
  const normalizedCourt = typeof assignment?.court === "string" ? assignment.court : assignment?.court == null ? "" : String(assignment.court)
  const normalizedTime = typeof assignment?.time === "string" ? assignment.time : assignment?.time == null ? "" : String(assignment.time)
  const [court, setCourt] = useState(normalizedCourt)
  const [time, setTime] = useState(normalizedTime)
  const [url, setUrl] = useState(link ?? "")
  const [pending, start] = useTransition()

  const ready = categoryReady({ court, time }, url)
  const dirty = normalizedCourt !== court || normalizedTime !== time || (link ?? "") !== url

  function save() {
    start(async () => {
      const res = await saveCategoryAssignment(fixtureId, category, { court: court || null, time: time || null, link: url || null })
      if (res?.ok) toast.success(`${category} saved.`)
      else toast.error(res?.error ?? "Could not save.")
    })
  }

  function copyLink() {
    if (!url) return
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy"),
    )
  }

  const linkReady = Boolean(url)
  return (
    <div className="border-b border-border px-3 py-2 last:border-b-0">
      {/* Header: Category + date/time/court + link status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground shrink-0">{category}</span>
          {isFeature && <Badge variant="secondary" className="text-[10px] shrink-0">Feature</Badge>}
          <span className="text-xs text-muted-foreground shrink-0">
            {fmtShortDate(matchDate)} {assignment?.time ?? "TBD"} · Court {assignment?.court ?? "TBD"}
          </span>
        </div>
        <div className="shrink-0">
          {linkReady ? (
            <a
              href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/15"
              aria-label={`Open ${category} booking`}
            >
              <ExternalLink className="h-3 w-3" />
              Link
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">
              <AlertTriangle className="h-3 w-3" />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Match: Home vs Away */}
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
        <div className="flex-1 text-left truncate text-foreground">{homeName}</div>
        <span className="shrink-0 text-muted-foreground mx-1.5">vs</span>
        <div className="flex-1 text-right truncate text-foreground">{awayName}</div>
      </div>

      {/* Edit mode: inputs */}
      {editing && canEdit && (
        <div className="mt-2 grid grid-cols-[4rem_5rem_minmax(0,1fr)_auto] gap-1.5 text-sm">
          <Input
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            disabled={!canEdit}
            inputMode="numeric"
            placeholder="Court"
            className="h-7 text-center text-xs"
            aria-label={`${category} court number`}
          />
          <select
            value={time ?? ""}
            onChange={(e) => setTime(e.target.value)}
            disabled={!canEdit}
            className="h-7 rounded-md border border-input bg-background px-1.5 text-xs disabled:opacity-60"
            aria-label={`${category} start time`}
          >
            <option value="">Time</option>
            {FIXTURE_EDIT_TIMESLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!canEdit}
            placeholder="playtomic.io/…"
            className="h-7 text-xs"
            aria-label={`${category} booking link`}
          />
          <div className="flex items-center justify-end gap-1">
            {canEdit && url && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyLink} aria-label="Copy link">
                <Copy className="h-3 w-3" />
              </Button>
            )}
            {canEdit && dirty ? (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={pending}>
                {pending ? "…" : "Save"}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

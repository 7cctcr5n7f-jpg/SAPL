"use client"

import { useMemo, useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { fmtDate } from "@/lib/format"
import { toast } from "sonner"
import { FIXTURE_TIMESLOTS } from "@/lib/constants"
import {
  CATEGORIES,
  CATEGORY_COUNT,
  categoryReady,
  canPublish,
  deriveOpsStatus,
  defaultCourtAssignments,
  type OpsStatus,
} from "@/lib/fixtures-ops"
import { saveCategoryAssignment, publishFixture, unpublishFixture } from "@/lib/actions/fixtures"
import { ResultEntry } from "@/components/captain/result-entry"
import type { DashboardFixture, FixtureHealth, HostClub } from "@/lib/queries-fixtures"
import {
  ChevronRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Search,
  Send,
  EyeOff,
  Trophy,
  ClipboardList,
} from "lucide-react"

type StatusFilter = "all" | OpsStatus | "needs_attention"

function teamLabel(name: string | null, slot: number | null) {
  if (name) return { text: name, placeholder: false }
  if (slot) return { text: `Slot ${slot}`, placeholder: true }
  return { text: "TBD", placeholder: true }
}

function fmtWhen(value: Date | string | null): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

function resultsEntered(f: DashboardFixture): number {
  return f.matches.filter((m) => m.winnerTeamId != null).length
}

export function OpsConsole({
  seasonName,
  fixtures,
  clubs,
  health,
}: {
  seasonName: string | null
  canManageVenue: boolean
  fixtures: DashboardFixture[]
  clubs: HostClub[]
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
      key: "ready_to_publish" as StatusFilter,
      label: "Ready to publish",
      count: health.readyToPublish,
      tone: "text-sky-400",
      icon: Send,
    },
    {
      key: "awaiting_result" as StatusFilter,
      label: "Published, awaiting results",
      count: health.awaitingResults,
      tone: "text-amber-400",
      icon: Trophy,
    },
  ].filter((a) => a.count > 0)

  const activeDivisions = regionId === "all" ? divisionOptions : divisionOptions.filter((d) => d.regionId === regionId)

  return (
    <div className="space-y-5">
      {/* Fixture Health */}
      <section aria-label="Fixture health" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <HealthTile label="Total Fixtures" value={health.total} active={status === "all"} onClick={() => setStatus("all")} />
        <HealthTile label="Completed" value={health.completed} tone="text-emerald-400" active={status === "completed"} onClick={() => setStatus("completed")} />
        <HealthTile label="Awaiting Results" value={health.awaitingResults} tone="text-amber-400" active={status === "awaiting_result"} onClick={() => setStatus("awaiting_result")} />
        <HealthTile label="Ready to Publish" value={health.readyToPublish} tone="text-sky-400" active={status === "ready_to_publish"} onClick={() => setStatus("ready_to_publish")} />
        <HealthTile label="Missing Booking" value={health.missingLinks} tone="text-orange-400" active={status === "needs_attention"} onClick={() => setStatus("needs_attention")} />
        <HealthTile label="Published" value={health.published} tone="text-primary" active={status === "published"} onClick={() => setStatus("published")} />
      </section>

      {/* Action Required */}
      {actionItems.length > 0 && (
        <section aria-label="Action required" className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Action Required</h2>
          </div>
          <ul className="divide-y divide-border">
            {actionItems.map((a) => (
              <li key={a.key}>
                <button
                  onClick={() => setStatus(a.key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/50"
                >
                  <span className="flex items-center gap-2.5 text-sm">
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
            <ConsoleRow key={f.id} f={f} expanded={expandedId === f.id} onToggle={() => setExpandedId((id) => (id === f.id ? null : f.id))} />
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

function HealthTile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  tone?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40",
      )}
    >
      <div className={cn("font-mono text-2xl font-bold tabular-nums", tone ?? "text-foreground")}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </button>
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
      className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
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

function ConsoleRow({ f, expanded, onToggle }: { f: DashboardFixture; expanded: boolean; onToggle: () => void }) {
  const info = deriveOpsStatus(f)
  const home = teamLabel(f.homeName, f.homeSlot)
  const away = teamLabel(f.awayName, f.awaySlot)
  const venueName = f.venueClubName ?? f.venue
  const resCount = resultsEntered(f)
  const done = f.status === "completed"
  const homeWon = f.winnerTeamId != null && f.winnerTeamId === f.homeTeamId

  return (
    <div className={cn("border-b border-border last:border-b-0", expanded && "bg-secondary/30")}>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="grid w-full grid-cols-[1.25rem_1fr] items-start gap-3 px-4 py-3 text-left lg:grid-cols-[7rem_3rem_1fr_1fr_10rem_5rem_5rem] lg:items-center"
      >
        {/* Mobile chevron / desktop status */}
        <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform lg:hidden", expanded && "rotate-90")} />
        <span className={cn("hidden rounded-full px-2 py-0.5 text-center text-[11px] font-semibold lg:inline-block", info.tone)}>
          {info.label}
        </span>

        {/* Body (mobile stacks; desktop uses columns) */}
        <div className="min-w-0 lg:contents">
          <span className="hidden text-sm text-muted-foreground lg:inline">{f.week}</span>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 lg:block lg:min-w-0">
            <span className={cn("truncate text-sm font-semibold", home.placeholder && "italic text-muted-foreground")}>{home.text}</span>
            <span className="text-xs text-muted-foreground lg:hidden">vs</span>
            <span className={cn("truncate text-sm font-semibold lg:hidden", away.placeholder && "italic text-muted-foreground")}>{away.text}</span>
            {done && (
              <span className="font-mono text-xs font-bold tabular-nums lg:hidden">
                <span className={cn(homeWon && "text-primary")}>{f.homePoints ?? 0}</span>
                <span className="text-muted-foreground">–</span>
                <span className={cn(!homeWon && "text-primary")}>{f.awayPoints ?? 0}</span>
              </span>
            )}
          </div>
          <span className={cn("hidden truncate text-sm font-semibold lg:block", away.placeholder && "italic text-muted-foreground")}>{away.text}</span>

          <span className="hidden min-w-0 items-center gap-1 truncate text-sm text-muted-foreground lg:flex">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{venueName ?? "TBD"}</span>
          </span>

          {/* Mobile meta line */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", info.tone)}>{info.label}</span>
            <span>Wk {f.week}</span>
            {f.divisionName && <span>{f.divisionName}</span>}
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {venueName ?? "TBD"}
            </span>
          </div>

          <CountPill count={info.readyCount} total={CATEGORY_COUNT} className="hidden lg:flex" label="courts booked" />
          <CountPill count={resCount} total={CATEGORY_COUNT} className="hidden lg:flex" label="results entered" resultStyle />
        </div>
      </button>

      {expanded && <FixtureDetail f={f} />}
    </div>
  )
}

function CountPill({
  count,
  total,
  className,
  label,
  resultStyle,
}: {
  count: number
  total: number
  className?: string
  label: string
  resultStyle?: boolean
}) {
  const complete = count === total
  return (
    <span
      title={`${count} of ${total} ${label}`}
      className={cn(
        "mx-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums",
        complete
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : resultStyle
            ? "border-border bg-secondary text-muted-foreground"
            : "border-orange-500/30 bg-orange-500/10 text-orange-400",
        className,
      )}
    >
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {count}/{total}
    </span>
  )
}

function FixtureDetail({ f }: { f: DashboardFixture }) {
  const [showResults, setShowResults] = useState(false)
  const [pending, start] = useTransition()
  const gate = canPublish(f)
  const canEdit = f.canEditLink
  const bothTeams = f.homeTeamId != null && f.awayTeamId != null

  const initialScores = useMemo(() => {
    const out: Record<string, { home: number; away: number }[]> = {}
    for (const m of f.matches) if (m.sets.length > 0) out[m.category] = m.sets
    return out
  }, [f.matches])

  function doPublish(publish: boolean) {
    start(async () => {
      const res = publish ? await publishFixture(f.id) : await unpublishFixture(f.id)
      if (res?.ok) toast.success(publish ? "Fixture published — players can now join." : "Fixture unpublished.")
      else toast.error(res?.error ?? "Something went wrong.")
    })
  }

  return (
    <div className="space-y-4 border-t border-border bg-background/40 px-4 py-4">
      {/* Detail + audit */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Field label="Region" value={f.regionName} />
          <Field label="Division" value={f.divisionName} />
          <Field label="Week" value={`Week ${f.week}`} />
          <Field label="Date" value={f.matchDate ? fmtDate(f.matchDate) : null} />
          <Field label="Venue" value={f.venueClubName ?? f.venue} />
          <Field label="Night Time" value={f.timeslot} />
        </dl>
        <div className="flex flex-col items-start gap-2 md:items-end">
          {canEdit ? (
            f.published ? (
              <Button variant="outline" size="sm" onClick={() => doPublish(false)} disabled={pending}>
                <EyeOff className="mr-1.5 h-4 w-4" /> Unpublish
              </Button>
            ) : (
              <div className="flex flex-col items-start gap-1 md:items-end">
                <Button size="sm" onClick={() => doPublish(true)} disabled={pending || !gate.ok}>
                  <Send className="mr-1.5 h-4 w-4" /> Publish Fixture
                </Button>
                {!gate.ok && <span className="text-[11px] text-muted-foreground">{gate.reason}</span>}
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Audit trail */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
        <span>Created by <span className="text-foreground">System (Season Generator)</span></span>
        <span>Updated by <span className="text-foreground">{f.updatedByName ?? "—"}</span> {f.updatedAt ? `· ${fmtWhen(f.updatedAt)}` : ""}</span>
        <span>Published by <span className="text-foreground">{f.publishedByName ?? "—"}</span> {f.publishedAt ? `· ${fmtWhen(f.publishedAt)}` : ""}</span>
        <span>Result by <span className="text-foreground">{f.resultEnteredByName ?? "—"}</span> {f.resultEnteredAt ? `· ${fmtWhen(f.resultEnteredAt)}` : ""}</span>
      </div>

      {/* Category child table */}
      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[1fr_4rem_6rem_1fr_7rem] items-center gap-3 border-b border-border bg-secondary/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Category</span>
          <span>Court</span>
          <span>Time</span>
          <span>Booking Link</span>
          <span className="text-right">Status</span>
        </div>
        {CATEGORIES.map((c) => (
          <CategoryEditor
            key={c.category}
            fixtureId={f.id}
            category={c.category}
            isFeature={c.isFeatureCourt}
            canEdit={canEdit}
            assignment={f.courtAssignments?.[c.category] ?? defaultCourtAssignments(f.venueCourts)[c.category]}
            link={f.courtLinks?.[c.category] ?? ""}
            match={f.matches.find((m) => m.category === c.category)}
          />
        ))}
      </div>

      {/* Result entry */}
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
                onDone={() => setShowResults(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", value ? "text-foreground" : "italic text-muted-foreground")}>{value || "Not set"}</dd>
    </div>
  )
}

function CategoryEditor({
  fixtureId,
  category,
  isFeature,
  canEdit,
  assignment,
  link,
  match,
}: {
  fixtureId: number
  category: string
  isFeature: boolean
  canEdit: boolean
  assignment: { court: string | null; time: string | null }
  link: string
  match?: DashboardFixture["matches"][number]
}) {
  const [court, setCourt] = useState(assignment?.court ?? "")
  const [time, setTime] = useState(assignment?.time ?? "")
  const [url, setUrl] = useState(link ?? "")
  const [pending, start] = useTransition()

  const ready = categoryReady({ court, time }, url)
  const dirty = (assignment?.court ?? "") !== court || (assignment?.time ?? "") !== time || (link ?? "") !== url

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

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-border px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_4rem_6rem_1fr_7rem] sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{category}</span>
        {isFeature && <Badge variant="secondary" className="text-[10px]">Feature</Badge>}
      </div>

      <Input
        value={court}
        onChange={(e) => setCourt(e.target.value)}
        disabled={!canEdit}
        inputMode="numeric"
        placeholder="—"
        className="h-8 text-center text-sm"
        aria-label={`${category} court number`}
      />

      <select
        value={time ?? ""}
        onChange={(e) => setTime(e.target.value)}
        disabled={!canEdit}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
        aria-label={`${category} start time`}
      >
        <option value="">Time</option>
        {FIXTURE_TIMESLOTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!canEdit}
          placeholder="playtomic.io/…"
          className="h-8 text-sm"
          aria-label={`${category} booking link`}
        />
        {url && !canEdit && (
          <a
            href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Open ${category} booking`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {match?.winnerTeamId != null && match.scoreDetail && (
          <span className="mr-auto font-mono text-[11px] text-muted-foreground sm:mr-0">{match.scoreDetail}</span>
        )}
        {canEdit && url && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyLink} aria-label="Copy link">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        {canEdit && dirty ? (
          <Button size="sm" className="h-8" onClick={save} disabled={pending}>
            {pending ? "…" : "Save"}
          </Button>
        ) : ready ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-1 text-[11px] font-medium text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Pending
          </span>
        )}
      </div>
    </div>
  )
}

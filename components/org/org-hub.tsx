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
import { Switch } from "@/components/ui/switch"
import { Stat } from "@/components/brand/bits"
import { PairingsBoard } from "@/components/team/pairings-board"
import { createTeam, updateTeamRegistration, deleteTeam } from "@/lib/actions/org"
import { AddPlayerDialog } from "@/components/players/add-player-dialog"
import { toast } from "sonner"
import {
  Users,
  Plus,
  Users2,
  Activity,
  MapPin,
  Pencil,
  Trash2,
  Building2,
  Lock,
  Mail,
  CircleCheck,
  CircleAlert,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { TEAM_TYPES, TEAM_SQUAD_SIZE, SAPL_REGIONS } from "@/lib/constants"
import { fmtZAR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PairingCategory, PairingPlayer } from "@/lib/queries-dashboard"

type Team = {
  id: number
  name: string
  teamType: string
  homeClubId: number | null
  homeClubName: string | null
  homeClubLogoUrl: string | null
  homeClubContactEmail: string | null
  ownerEmail: string | null
  ownerName: string | null
  avgLi: number
  playerCount: number
  maxPlayers: number
  saplRegion: string | null
  divisionName: string
  divisionId: number | null
  tpr: number
  played: number
  won: number
  points: number
  rank: number | null
  clubPaysFees: boolean
  rosterCount: number
  paidCount: number
  teamTotal: number
  amountPaid: number
  outstanding: number
  pairingCategories: PairingCategory[]
  pairingRoster: PairingPlayer[]
  pairingInvites: { id: number; email: string; category: string | null }[]
}

// Team-type accent colours so the list is scannable at a glance.
const TYPE_STYLES: Record<string, { dot: string; badge: string; bar: string }> = {
  "Club Team": {
    dot: "bg-sky-500",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  "Company Team": {
    dot: "bg-amber-500",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  "Private Team": {
    dot: "bg-emerald-500",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
}
function typeStyle(t: string) {
  return TYPE_STYLES[t] ?? { dot: "bg-muted-foreground", badge: "", bar: "bg-muted-foreground" }
}

// Traffic-light dot for a team's payment health.
function PayDot({ state }: { state: "paid" | "partial" | "unpaid" }) {
  const color =
    state === "paid" ? "bg-emerald-500" : state === "partial" ? "bg-amber-500" : "bg-red-500"
  const ring =
    state === "paid"
      ? "ring-emerald-500/20"
      : state === "partial"
        ? "ring-amber-500/20"
        : "ring-red-500/20"
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2", color, ring)} aria-hidden />
}
type FreeAgent = { playerId: string; name: string; li: number }
type Venue = { id: number; name: string; remaining: number; hosts: boolean; available: boolean }

/**
 * Venue options for a home-club picker. Only venues with remaining hosting
 * capacity are selectable, except the team's current venue which is always
 * kept so editing never silently drops an existing assignment.
 */
function venueOptions(venues: Venue[], currentId: number | null) {
  return venues.filter((v) => v.available || v.id === currentId)
}

export function OrgHub({
  orgId,
  teams,
  freeAgents,
  venues,
  playerFee,
  locked = false,
}: {
  orgId: number
  teams: Team[]
  freeAgents: FreeAgent[]
  venues: Venue[]
  playerFee: number
  // When the season is active, team name and home venue editing is frozen.
  locked?: boolean
}) {
  const [pending, start] = useTransition()
  const [squadForId, setSquadForId] = useState<number | null>(null)
  // Always derive from the live `teams` prop so router.refresh() inside the
  // modal immediately reflects the updated pairings/roster data.
  const squadFor = squadForId != null ? (teams.find((t) => t.id === squadForId) ?? null) : null
  const [editFor, setEditFor] = useState<Team | null>(null)
  const [deleteFor, setDeleteFor] = useState<Team | null>(null)
  const [search, setSearch] = useState("")

  // List filters
  const [fType, setFType] = useState<string>("all")
  const [fDivision, setFDivision] = useState<"all" | "assigned" | "unassigned">("all")
  const [fPayer, setFPayer] = useState<"all" | "team" | "players">("all")
  const [fClub, setFClub] = useState<string>("all")

  const clubFilterOptions = Array.from(
    new Map(teams.filter((t) => t.homeClubName).map((t) => [t.homeClubName as string, t.homeClubName as string])).keys(),
  ).sort()

  const visibleTeams = teams.filter((t) => {
    if (fType !== "all" && t.teamType !== fType) return false
    if (fDivision === "assigned" && t.divisionId == null) return false
    if (fDivision === "unassigned" && t.divisionId != null) return false
    if (fPayer === "team" && !t.clubPaysFees) return false
    if (fPayer === "players" && t.clubPaysFees) return false
    if (fClub !== "all" && t.homeClubName !== fClub) return false
    return true
  })

  function confirmDelete() {
    if (!deleteFor) return
    const id = deleteFor.id
    start(async () => {
      const res = await deleteTeam(id)
      if (res.ok) {
        toast.success("Team deleted")
        setDeleteFor(null)
      } else toast.error(res.error ?? "Failed to delete")
    })
  }

  // Player count is derived from filled pairing slots, not the separate roster table.
  const totalPlayers = teams.reduce((s, t) => s + t.pairingRoster.length, 0)
  const withOwner = teams.filter((t) => t.ownerEmail).length
  const avgTpr = teams.length ? Math.round(teams.reduce((s, t) => s + t.tpr, 0) / teams.length) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Assign players directly into pairing slots. All 8 players in the pairings are the squad — there is no separate roster. Set a team owner via the edit button.
        </p>
        <div className="flex items-center gap-2">
          <CreateTeamDialog orgId={orgId} venues={venues} pending={pending} start={start} />
          <AddPlayerDialog teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Total Players" value={totalPlayers} />
        <Stat label="Avg TPR" value={avgTpr} />
        <Stat label="Owners Assigned" value={`${withOwner}/${teams.length}`} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Teams
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Type"
              value={fType}
              onChange={setFType}
              options={[
                { value: "all", label: "All types" },
                ...TEAM_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
            <FilterSelect
              label="Division"
              value={fDivision}
              onChange={(v) => setFDivision(v as typeof fDivision)}
              options={[
                { value: "all", label: "All teams" },
                { value: "assigned", label: "In a division" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
            <FilterSelect
              label="Pays"
              value={fPayer}
              onChange={(v) => setFPayer(v as typeof fPayer)}
              options={[
                { value: "all", label: "Any payer" },
                { value: "team", label: "Team pays" },
                { value: "players", label: "Players pay" },
              ]}
            />
            <FilterSelect
              label="Club"
              value={fClub}
              onChange={setFClub}
              options={[
                { value: "all", label: "All clubs" },
                ...clubFilterOptions.map((c) => ({ value: c, label: c })),
              ]}
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {visibleTeams.length} of {teams.length} teams
            </span>
          </div>

          {/* Color key */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {TEAM_TYPES.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", typeStyle(t).dot)} />
                {t}
              </span>
            ))}
          </div>

          {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams yet.</p>}
          {teams.length > 0 && visibleTeams.length === 0 && (
            <p className="text-sm text-muted-foreground">No teams match the current filters.</p>
          )}

          <div className="space-y-2">
            {visibleTeams.map((t) => {
              const ts = typeStyle(t.teamType)
              // The squad is exactly the 8 pairing slots. Count filled slots.
              const minPlayers = TEAM_SQUAD_SIZE
              const filledSlots = t.pairingRoster.length
              const squadComplete = filledSlots >= minPlayers
              // Payment health drives the indicator colour. Fully settled = green,
              // part-paid = amber, nothing in yet = red.
              const payState =
                t.outstanding <= 0 ? "paid" : t.amountPaid > 0 ? "partial" : "unpaid"
              const assigned = t.divisionId != null
              return (
                <div
                  key={t.id}
                  className="group flex items-stretch overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md"
                >
                  {/* Type accent bar */}
                  <span className={cn("w-1 shrink-0", ts.bar)} aria-hidden />

                  <div className="flex flex-1 flex-col gap-0 divide-y divide-border/60">
                    {/* ── Top row: identity + action buttons ── */}
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      {/* Club logo / placeholder */}
                      {t.homeClubLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.homeClubLogoUrl || "/placeholder.svg"}
                          alt={`${t.homeClubName ?? "Club"} logo`}
                          className="h-8 w-8 shrink-0 rounded-md border border-border object-contain"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground" aria-hidden>
                          <Building2 className="h-3.5 w-3.5" />
                        </span>
                      )}

                      {/* Team name + division + owner */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate text-sm font-semibold leading-tight">{t.name}</span>
                          {/* Division dot */}
                          <span
                            className="inline-flex items-center gap-1 text-[11px]"
                            title={assigned ? `Assigned to ${t.divisionName}` : "Not yet assigned to a division"}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                assigned ? "bg-emerald-500" : "bg-muted-foreground/30",
                              )}
                              aria-hidden
                            />
                            <span className={assigned ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                              {assigned ? t.divisionName : "Unassigned"}
                            </span>
                          </span>
                        </div>
                        {/* Meta row: type badge · LI · location · owner */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className={cn("h-4 gap-1 px-1.5 py-0 text-[10px] font-normal", ts.badge)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", ts.dot)} />
                            {t.teamType}
                          </Badge>
                          <span className="inline-flex items-center gap-1" title="Average Playtomic Rating">
                            <Activity className="h-3 w-3" /> PR {t.avgLi.toFixed(2)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {t.homeClubName ?? "No home club"}{t.saplRegion ? ` · ${t.saplRegion}` : ""}
                          </span>
                          {/* Owner name — visible inline, tooltip shows email */}
                          {t.ownerName ? (
                            <span
                              className="inline-flex items-center gap-1 font-medium text-foreground/70"
                              title={t.ownerEmail ? `Owner email: ${t.ownerEmail}` : undefined}
                            >
                              <Users className="h-3 w-3" /> {t.ownerName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 italic opacity-50">
                              <Users className="h-3 w-3" /> No owner
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action icon buttons */}
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditFor(t)}
                          aria-label="Edit team"
                          title="Edit team"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setSquadForId(t.id)}
                          aria-label="View squad & pairings"
                          title="Squad & Pairings"
                        >
                          <Users2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteFor(t)}
                          aria-label="Delete team"
                          title="Delete team"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* ── Bottom row: squad count + payment stats ── */}
                    <div className="flex flex-wrap items-center gap-x-0 divide-x divide-border/60">
                      {/* Squad */}
                      <div className="flex items-center gap-2 px-3.5 py-2">
                        <Users2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className={cn("text-sm font-semibold tabular-nums", !squadComplete && "text-amber-600 dark:text-amber-400")}>
                            {filledSlots}<span className="font-normal text-muted-foreground">/{minPlayers}</span>
                          </span>
                          {squadComplete ? (
                            <CircleCheck className="ml-1 inline h-3.5 w-3.5 text-emerald-500" aria-label="Full squad" />
                          ) : (
                            <CircleAlert className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Squad incomplete" />
                          )}
                          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                            {squadComplete ? "pairings full" : `${minPlayers - filledSlots} slot${minPlayers - filledSlots !== 1 ? "s" : ""} open`}
                          </p>
                        </div>
                      </div>

                      {/* Payment */}
                      <button
                        type="button"
                        onClick={() => setSquadForId(t.id)}
                        className="flex items-center gap-2 px-3.5 py-2 text-left transition hover:bg-muted/40"
                        title={t.clubPaysFees ? "Team-funded squad" : "Players pay individually"}
                      >
                        <PayDot state={payState} />
                        <div>
                          {t.outstanding <= 0 ? (
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Paid up</span>
                          ) : (
                            <span className="text-sm font-semibold">
                              {fmtZAR(t.outstanding)}{" "}
                              <span className="font-normal text-muted-foreground">due</span>
                            </span>
                          )}
                          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                            {t.clubPaysFees
                              ? `Team pays · ${fmtZAR(t.amountPaid)} of ${fmtZAR(t.teamTotal)}`
                              : `Players pay · ${t.paidCount}/${TEAM_SQUAD_SIZE} paid`}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!squadFor} onOpenChange={(o) => !o && setSquadForId(null)}>
        <DialogContent className="max-h-[95vh] w-[97vw] max-w-[97vw] overflow-y-auto bg-white p-4 sm:max-w-5xl sm:p-6 lg:max-w-6xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-slate-800">{squadFor?.name} — Squad &amp; Pairings</DialogTitle>
          </DialogHeader>
          {squadFor && (
            <PairingsBoard
              teamId={squadFor.id}
              categories={squadFor.pairingCategories}
              invites={squadFor.pairingInvites}
              clubPaysFees={squadFor.clubPaysFees}
            />
          )}
        </DialogContent>
      </Dialog>

      {editFor && (
        <EditTeamDialog
          key={editFor.id}
          team={editFor}
          venues={venues}
          pending={pending}
          start={start}
          locked={locked}
          onClose={() => setEditFor(null)}
        />
      )}

      <Dialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete team</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <span className="font-semibold text-foreground">{deleteFor?.name}</span>? This removes its
            roster, pairings, invites and payments, and detaches it from any scheduled fixtures. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
        aria-label={`Filter by ${label}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CreateTeamDialog({
  orgId,
  venues,
  pending,
  start,
}: {
  orgId: number
  venues: Venue[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" /> Create team
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("orgId", String(orgId))
            start(async () => {
              const res = await createTeam(fd)
              if (res.ok) {
                toast.success("Team created")
                setOpen(false)
              } else toast.error(res.error ?? "Failed")
            })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Team name</Label>
            <Input id="name" name="name" placeholder="e.g. Tuks Premier B" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="teamType">Team type</Label>
              <select
                id="teamType"
                name="teamType"
                defaultValue="Club Team"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TEAM_TYPES.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="homeClubId">Home club / venue</Label>
              <select
                id="homeClubId"
                name="homeClubId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None</option>
                {venueOptions(venues, null).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.remaining} left)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerEmail">Team owner email (optional)</Label>
            <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="owner@example.com" />
            <p className="text-xs text-muted-foreground">
              Whoever signs in with this email automatically gets team-owner access to manage this team.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="saplRegion">Region</Label>
            <select
              id="saplRegion"
              name="saplRegion"
              defaultValue=""
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Use home venue&apos;s region</option>
              {SAPL_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              The region inherits from the home venue. Pick one here for teams without a venue so they can be placed and
              filtered.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            New teams start unassigned. The league office places them into a division.
          </p>
          {venues.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Tip: add a venue in Venue Management to set a home club and SAPL region.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit a team's basic registration details. Division is intentionally NOT here —
// placement into a division is controlled by the league office.
function EditTeamDialog({
  team,
  venues,
  pending,
  start,
  locked = false,
  onClose,
}: {
  team: Team
  venues: Venue[]
  pending: boolean
  start: (cb: () => Promise<void>) => void
  locked?: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(team.name)
  const [teamType, setTeamType] = useState<string>(team.teamType)
  const [homeClubId, setHomeClubId] = useState<string>(team.homeClubId ? String(team.homeClubId) : "")
  const [saplRegion, setSaplRegion] = useState<string>(team.saplRegion ?? "")
  const [clubPaysFees, setClubPaysFees] = useState(team.clubPaysFees)
  // For a Club Team, the venue that entered it owns it by default — so when no
  // owner email has been set yet, pre-fill the club's contact email. The field
  // stays editable so the org can hand ownership to a different person.
  const [ownerEmail, setOwnerEmail] = useState(
    team.ownerEmail ?? (team.teamType === "Club Team" ? (team.homeClubContactEmail ?? "") : ""),
  )

  // When a home club is set, the region is inherited from it and can't be edited.
  const hasHomeClub = Boolean(homeClubId)

  function save() {
    if (!name.trim()) {
      toast.error("Team name is required")
      return
    }
    if (!hasHomeClub && !saplRegion) {
      toast.error("Select a region (or choose a home venue to inherit one)")
      return
    }
    start(async () => {
      const res = await updateTeamRegistration({
        teamId: team.id,
        name,
        teamType,
        homeClubId: homeClubId ? Number(homeClubId) : null,
        saplRegion: homeClubId ? undefined : saplRegion || null,
        clubPaysFees,
        ownerEmail: ownerEmail.trim() || null,
      })
      if (res.ok) {
        toast.success("Team updated")
        onClose()
      } else toast.error(res.error ?? "Failed")
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {locked && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              The season has started — team name and home venue are locked.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="editName">Team name</Label>
            <Input id="editName" value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editTeamType">Team type</Label>
            <select
              id="editTeamType"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TEAM_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {tt}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Club Teams are entered by a venue, Company Teams represent a business, and Private Teams are independent
              groups.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editHomeClub">Home club / venue</Label>
            <select
              id="editHomeClub"
              value={homeClubId}
              disabled={locked}
              onChange={(e) => setHomeClubId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">No home club</option>
              {venueOptions(venues, team.homeClubId).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.id === team.homeClubId ? " (current)" : ` (${v.remaining} left)`}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Division placement is managed by the league office and can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editRegion">Region</Label>
            <select
              id="editRegion"
              value={hasHomeClub ? (team.saplRegion ?? "") : saplRegion}
              disabled={hasHomeClub}
              onChange={(e) => setSaplRegion(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Select a region…</option>
              {SAPL_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {hasHomeClub
                ? "Region is inherited from the home venue. Remove the home club to set it manually."
                : "The region this team competes in. Used for division placement and filtering."}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Team pays player fees</p>
              <p className="text-xs text-muted-foreground">
                {clubPaysFees
                  ? "The team covers entry fees for its players."
                  : "Each player pays their own fee from their dashboard."}
              </p>
            </div>
            <Switch checked={clubPaysFees} onCheckedChange={setClubPaysFees} aria-label="Toggle team pays fees" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editOwnerEmail">Team owner email</Label>
            <Input
              id="editOwnerEmail"
              type="email"
              value={ownerEmail}
              placeholder="owner@example.com"
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Whoever signs in with this email automatically gets team-owner access to manage this team. Leave blank to
              remove.
              {team.teamType === "Club Team" && team.homeClubContactEmail
                ? " For a Club Team this defaults to the venue's contact, but you can set a different owner."
                : ""}
            </p>
            {team.teamType === "Club Team" &&
              team.homeClubContactEmail &&
              ownerEmail.trim().toLowerCase() !== team.homeClubContactEmail.trim().toLowerCase() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setOwnerEmail(team.homeClubContactEmail ?? "")}
                >
                  Use venue contact ({team.homeClubContactEmail})
                </Button>
              )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// View and edit a team captain's contact details. Email is the captain's login
// identity so it's shown read-only; name and phone can be edited inline.



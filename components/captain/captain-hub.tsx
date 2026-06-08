"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ResultEntry } from "@/components/captain/result-entry"
import { PairingsBoard } from "@/components/team/pairings-board"
import { AddPlayerDialog } from "@/components/players/add-player-dialog"
import { addPlayer, removeMember, setPlayerAvailability } from "@/lib/actions/captain"
import { toast } from "sonner"
import { fmtDate, fmtZAR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { UserPlus, X, DollarSign, Mars, Venus, CalendarDays, UserX, Check, ShieldCheck } from "lucide-react"
import type { PairingCategory, PairingPlayer } from "@/lib/queries-dashboard"

type RosterMember = {
  membershipId: number
  playerId: number
  name: string
  li: number
  status: string
  role: string
}
type FreeAgent = { playerId: number; name: string; li: number; city: string | null }
type FixtureLite = {
  id: number
  week: number
  homeTeamId: number | null
  awayTeamId: number | null
  homeName: string
  awayName: string
  matchDate: string | Date | null
  status: string
  homePoints: number | null
  awayPoints: number | null
  scores?: Record<string, { home: number; away: number }>
}
type Cat = { category: string; session: number; isFeatureCourt: boolean }

export type CaptainTeam = {
  id: number
  name: string
  divisionName: string
  tpr: number
  /** Per-player league join fee for this team's season (incl. VAT). */
  playerFee: number
  roster: RosterMember[]
  fixtures: FixtureLite[]
  /** Player ids marked unavailable, keyed by fixtureId. */
  unavailable: Record<number, number[]>
  clubPaysFees: boolean
  pairingCategories: PairingCategory[]
  pairingRoster: PairingPlayer[]
  pairingInvites: { id: number; email: string; category: string | null }[]
}

export function CaptainHub({
  teams,
  freeAgents,
  categories,
  canEdit = false,
  playerFee,
}: {
  teams: CaptainTeam[]
  freeAgents: FreeAgent[]
  categories: Cat[]
  canEdit?: boolean
  playerFee: number
}) {
  const [activeId, setActiveId] = useState(teams[0]?.id ?? 0)
  const team = teams.find((t) => t.id === activeId) ?? teams[0]
  const [pending, start] = useTransition()
  const [search, setSearch] = useState("")
  const [resultFixture, setResultFixture] = useState<FixtureLite | null>(null)

  if (!team) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          You don&apos;t captain any teams yet. A club admin can assign you as a captain.
        </CardContent>
      </Card>
    )
  }

  // Payment + gender come from the richer pairing roster; index by playerId so
  // the roster list can show a paid/unpaid icon alongside each member.
  const metaById = new Map(team.pairingRoster.map((p) => [p.playerId, p]))

  const rosterPlayerIds = new Set(team.roster.map((r) => r.playerId))
  const filteredAgents = freeAgents
    .filter((a) => !rosterPlayerIds.has(a.playerId))
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 30)

  function invite(playerId: number) {
    start(async () => {
      const res = await addPlayer(team.id, playerId)
      if (res?.error) toast.error(res.error)
      else toast.success(res?.success ?? "Player added")
    })
  }
  function remove(membershipId: number) {
    start(async () => {
      const res = await removeMember(team.id, membershipId)
      if (res?.error) toast.error(res.error)
      else toast.success(res?.success ?? "Removed")
    })
  }

  return (
    <div className="space-y-6">
      {/* Captains can create a new player account and optionally drop them
          straight onto one of their own teams. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add a new player to your squad — they&apos;ll get a login and can be assigned to one of your teams.
        </p>
        <AddPlayerDialog teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
      </div>

      {teams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                t.id === activeId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roster */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{team.name} Roster</CardTitle>
              <p className="text-xs text-muted-foreground">
                {team.divisionName} · TPR {Math.round(team.tpr)}
              </p>
            </div>
            <Dialog>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Add player
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add a Player</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Search free agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {filteredAgents.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">No matching free agents.</p>
                  )}
                  {filteredAgents.map((a) => (
                    <div
                      key={a.playerId}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{a.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground">
                            LI {a.li.toFixed(1)} · {a.city ?? "—"}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" disabled={pending} onClick={() => invite(a.playerId)}>
                        Invite
                      </Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            <FeeSummary team={team} metaById={metaById} playerFee={playerFee} />
            {team.roster.length === 0 && (
              <p className="text-sm text-muted-foreground">No players yet. Invite free agents to build your squad.</p>
            )}
            {team.roster.map((m) => {
              const meta = metaById.get(m.playerId)
              const paid = meta?.paid ?? team.clubPaysFees
              return (
                <div
                  key={m.membershipId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-sm font-medium">
                        {meta?.gender === "female" ? (
                          <Venus className="h-3.5 w-3.5 shrink-0 text-pink-500" aria-label="Female" />
                        ) : (
                          <Mars className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Male" />
                        )}
                        <span className="truncate">{m.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">LI {m.li.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full",
                        paid ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground/40",
                      )}
                      title={paid ? (team.clubPaysFees ? "Covered by team" : "Paid") : "Fee outstanding"}
                      aria-label={paid ? "Paid" : "Unpaid"}
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                    </span>
                    {m.role === "captain" ? (
                      <Badge>Captain</Badge>
                    ) : m.status === "invited" ? (
                      <Badge variant="secondary">Invited</Badge>
                    ) : (
                      <button
                        onClick={() => remove(m.membershipId)}
                        disabled={pending}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${m.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Fixtures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fixtures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.fixtures.length === 0 && (
              <p className="text-sm text-muted-foreground">No fixtures scheduled.</p>
            )}
            {team.fixtures.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {f.homeName} <span className="text-muted-foreground">vs</span> {f.awayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Week {f.week} · {fmtDate(f.matchDate)}
                  </p>
                </div>
                {f.status === "completed" ? (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold tabular-nums">
                      {f.homePoints ?? 0} <span className="text-muted-foreground">–</span> {f.awayPoints ?? 0}
                    </span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setResultFixture(f)}>
                        Edit
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setResultFixture(f)}>
                    Enter Result
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <FutureSchedule team={team} />

      <div>
        <h2 className="mb-1 text-lg font-semibold">Team Pairings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          One pair per category — a beginner and advanced pair for both ladies and mens (8 players).
          Assign roster players or invite new ones by email to fill empty slots.
        </p>
        <PairingsBoard
          teamId={team.id}
          categories={team.pairingCategories}
          roster={team.pairingRoster}
          invites={team.pairingInvites}
          clubPaysFees={team.clubPaysFees}
        />
      </div>

      <Dialog open={!!resultFixture} onOpenChange={(open) => !open && setResultFixture(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{resultFixture?.status === "completed" ? "Edit Match Result" : "Enter Match Result"}</DialogTitle>
          </DialogHeader>
          {resultFixture && (
            <ResultEntry
              fixtureId={resultFixture.id}
              homeName={resultFixture.homeName}
              awayName={resultFixture.awayName}
              categories={categories}
              initialScores={resultFixture.scores}
              isEdit={resultFixture.status === "completed"}
              onDone={() => setResultFixture(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * League-fee status for the captain/team manager. When the manager has opted to
 * cover fees (clubPaysFees) the team owes one lump sum and individual players
 * are not billed; otherwise each player owes the season join fee and we show how
 * many have paid.
 */
function FeeSummary({
  team,
  metaById,
  playerFee,
}: {
  team: CaptainTeam
  metaById: Map<number, PairingPlayer>
  playerFee: number
}) {
  const active = team.roster.filter((m) => m.status !== "invited")
  const count = active.length

  if (team.clubPaysFees) {
    const total = count * playerFee
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Team covers fees</p>
            <p className="text-xs text-muted-foreground">
              {count} player{count === 1 ? "" : "s"} × {fmtZAR(playerFee)} · players are not billed
            </p>
          </div>
        </div>
        <span className="text-base font-bold tabular-nums">{fmtZAR(total)}</span>
      </div>
    )
  }

  const paidCount = active.filter((m) => metaById.get(m.playerId)?.paid).length
  const outstanding = (count - paidCount) * playerFee
  const allPaid = count > 0 && paidCount === count
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <DollarSign className={cn("h-4 w-4", allPaid ? "text-green-600" : "text-amber-600")} />
        <div>
          <p className="text-sm font-medium">Players pay their own fees</p>
          <p className="text-xs text-muted-foreground">
            {paidCount}/{count} paid · {fmtZAR(playerFee)} each
          </p>
        </div>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", allPaid ? "text-green-600" : "text-amber-600")}>
        {allPaid ? "All paid" : `${fmtZAR(outstanding)} due`}
      </span>
    </div>
  )
}

/**
 * Upcoming (not-yet-played) fixtures with a per-fixture availability editor so
 * the captain can drop specific roster players from a given week.
 */
function FutureSchedule({ team }: { team: CaptainTeam }) {
  const [pending, start] = useTransition()
  const upcoming = team.fixtures
    .filter((f) => f.status !== "completed")
    .sort((a, b) => a.week - b.week)

  function toggle(fixtureId: number, playerId: number, makeUnavailable: boolean) {
    start(async () => {
      const res = await setPlayerAvailability(fixtureId, team.id, playerId, makeUnavailable)
      if (res?.error) toast.error(res.error)
      else toast.success(res?.success ?? "Updated")
    })
  }

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <CalendarDays className="h-5 w-5 text-primary" /> Future Schedule
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Mark players unavailable for an upcoming fixture so they&apos;re excluded from that week&apos;s lineup.
      </p>
      {upcoming.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No upcoming fixtures scheduled.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcoming.map((f) => {
            const out = new Set(team.unavailable[f.id] ?? [])
            const availableCount = team.roster.filter((m) => !out.has(m.playerId)).length
            return (
              <Card key={f.id}>
                <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
                  <div>
                    <CardTitle className="text-sm">
                      {f.homeName} <span className="text-muted-foreground">vs</span> {f.awayName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Week {f.week} · {fmtDate(f.matchDate)}
                    </p>
                  </div>
                  <Badge variant={availableCount > 0 ? "secondary" : "destructive"}>
                    {availableCount} available
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {team.roster.length === 0 && (
                    <p className="text-sm text-muted-foreground">No roster players yet.</p>
                  )}
                  {team.roster.map((m) => {
                    const unavailable = out.has(m.playerId)
                    return (
                      <button
                        key={m.playerId}
                        type="button"
                        disabled={pending}
                        onClick={() => toggle(f.id, m.playerId, !unavailable)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                          unavailable
                            ? "border-border bg-muted text-muted-foreground line-through"
                            : "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20",
                        )}
                        title={unavailable ? "Tap to mark available" : "Tap to mark unavailable"}
                      >
                        {unavailable ? <UserX className="h-3 w-3" /> : <Check className="h-3 w-3 text-primary" />}
                        {m.name}
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

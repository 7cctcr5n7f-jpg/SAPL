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
import { addPlayer, removeMember } from "@/lib/actions/captain"
import { toast } from "sonner"
import { fmtDate, fmtZAR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { UserPlus, X, DollarSign, Mars, Venus, ShieldCheck, Check } from "lucide-react"
import type { PairingCategory, PairingPlayer } from "@/lib/queries-dashboard"

const PAYING_PLAYERS_COUNT = 8

type RosterMember = {
  membershipId: number
  playerId: number
  name: string
  li: number
  status: string
  role: string
}
type FreeAgent = { playerId: number; name: string; li: number; city: string | null; email: string | null }
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
  scores?: Record<string, { home: number; away: number }[]>
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
  isLeagueAdmin = false,
}: {
  teams: CaptainTeam[]
  freeAgents: FreeAgent[]
  categories: Cat[]
  canEdit?: boolean
  playerFee: number
  isLeagueAdmin?: boolean
}) {
  const [activeId, setActiveId] = useState(teams[0]?.id ?? 0)
  const team = teams.find((t) => t.id === activeId) ?? teams[0]
  const [pending, start] = useTransition()
  const [search, setSearch] = useState("")
  const [resultFixture, setResultFixture] = useState<FixtureLite | null>(null)
  const [activeTab, setActiveTab] = useState<"squad" | "fixtures" | "pairings">("fixtures")

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
  const q = search.trim().toLowerCase()
  const filteredAgents = freeAgents
    .filter((a) => !rosterPlayerIds.has(a.playerId))
    .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q))
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

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "fixtures", label: "Fixtures" },
    { key: "squad", label: "Squad" },
    { key: "pairings", label: "Team Pairings" },
  ]

  return (
    <div className="space-y-5">
      {/* Team selector */}
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

      {/* Tab bar — shown to everyone */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Fixtures tab ── */}
      {activeTab === "fixtures" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fixtures · {team.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {team.divisionName} · TPR {Math.round(team.tpr)}
            </p>
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
      )}

      {/* ── Squad tab ── */}
      {activeTab === "squad" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{team.name} Squad</CardTitle>
              <p className="text-xs text-muted-foreground">
                {team.divisionName} · TPR {Math.round(team.tpr)}
              </p>
            </div>
            {!isLeagueAdmin && (
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
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {filteredAgents.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {q ? "No players match that name or email." : "Start typing to search players."}
                      </p>
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{a.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {a.email ?? `LI ${a.li.toFixed(1)} · ${a.city ?? "—"}`}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" disabled={pending} onClick={() => invite(a.playerId)}>
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <SquadWithFees
              team={team}
              metaById={metaById}
              playerFee={playerFee}
              pending={pending}
              onRemove={remove}
              isLeagueAdmin={isLeagueAdmin}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Team Pairings tab ── */}
      {activeTab === "pairings" && (
        <div>
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
      )}

      {/* Add player shortcut for captains (above tabs) */}
      {!isLeagueAdmin && activeTab === "squad" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Add a new player to your squad — they&apos;ll get a login and can be assigned to one of your teams.
          </p>
          <div className="shrink-0">
            <AddPlayerDialog teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
          </div>
        </div>
      )}

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

// ─── Squad + Fee selector ──────────────────────────────────────────────────────

function SquadWithFees({
  team,
  metaById,
  playerFee,
  pending,
  onRemove,
  isLeagueAdmin,
}: {
  team: CaptainTeam
  metaById: Map<number, PairingPlayer>
  playerFee: number
  pending: boolean
  onRemove: (membershipId: number) => void
  isLeagueAdmin: boolean
}) {
  const active = team.roster.filter((m) => m.status !== "invited")

  // Default: first 8 active players pay; captain can toggle
  const [payingIds, setPayingIds] = useState<Set<number>>(() => {
    const defaultSet = new Set<number>()
    active.slice(0, PAYING_PLAYERS_COUNT).forEach((m) => defaultSet.add(m.playerId))
    return defaultSet
  })

  function togglePaying(playerId: number) {
    setPayingIds((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        if (next.size >= PAYING_PLAYERS_COUNT) {
          toast.error(`Only ${PAYING_PLAYERS_COUNT} players can be selected to pay.`)
          return prev
        }
        next.add(playerId)
      }
      return next
    })
  }

  const totalFee = PAYING_PLAYERS_COUNT * playerFee

  return (
    <div className="space-y-3">
      {/* Fee summary banner */}
      {team.clubPaysFees ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Club covers fees</p>
              <p className="text-xs text-muted-foreground">Players are not billed individually</p>
            </div>
          </div>
          <span className="text-base font-bold tabular-nums">{fmtZAR(totalFee)}</span>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">Fee: {fmtZAR(totalFee)}</p>
            </div>
            <span className="text-xs text-amber-700">{payingIds.size}/{PAYING_PLAYERS_COUNT} selected</span>
          </div>
          <p className="mt-0.5 text-xs text-amber-700">
            Select exactly {PAYING_PLAYERS_COUNT} players who will pay · {fmtZAR(playerFee)} each
          </p>
        </div>
      )}

      {/* Roster list */}
      {team.roster.length === 0 && (
        <p className="text-sm text-muted-foreground">No players yet. Add free agents to build your squad.</p>
      )}
      {team.roster.map((m) => {
        const meta = metaById.get(m.playerId)
        const isPaying = team.clubPaysFees ? (meta?.paid ?? true) : payingIds.has(m.playerId)
        const isActive = m.status !== "invited"

        return (
          <div
            key={m.membershipId}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            {/* Paying checkbox — only for player-pays teams, active members only */}
            {!team.clubPaysFees && isActive && (
              <button
                onClick={() => togglePaying(m.playerId)}
                aria-label={isPaying ? "Remove from paying" : "Mark as paying"}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  isPaying
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-300 bg-white text-transparent hover:border-primary",
                )}
              >
                <Check className="h-3 w-3" />
              </button>
            )}

            <div className="flex min-w-0 flex-1 items-center gap-2">
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
                  <span className={cn("truncate", !team.clubPaysFees && isActive && !isPaying && "text-muted-foreground")}>
                    {m.name}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">LI {m.li.toFixed(1)}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Paid indicator */}
              {team.clubPaysFees && (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600"
                  title="Covered by club"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
              )}
              {m.role === "captain" ? (
                <Badge>Captain</Badge>
              ) : m.status === "invited" ? (
                <Badge variant="secondary">Invited</Badge>
              ) : (
                !isLeagueAdmin && (
                  <button
                    onClick={() => onRemove(m.membershipId)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${m.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


// (FeeSummary replaced by SquadWithFees above)

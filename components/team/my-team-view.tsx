"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MyTeamAddPlayer } from "@/components/team/my-team-add-player"
import { removeFromTeam, cancelInvite } from "@/lib/actions/pairings"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertCircle,
  Crown,
  MoreVertical,
  Plus,
  Star,
  Trophy,
  Calendar,
  CreditCard,
  Clock,
  UserPlus,
  ExternalLink,
  Mars,
  Venus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MyTeamView as MyTeamViewData, MyTeamSlot } from "@/lib/my-team"
import type { PairingCategory } from "@/lib/queries-dashboard"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
}

export function MyTeamView({ data }: { data: MyTeamViewData }) {
  const { team, readiness, avgRating, slots, payment, nextFixture, standing, otherTeams, canManage, pairingCategories } = data
  const filled = slots.filter((s) => s.kind !== "empty").length
  const slotsRemaining = readiness.maxPlayers - filled

  return (
    <div className="space-y-6">
      {/* Team identity + switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-lg border border-border">
            <AvatarImage src={team.logoUrl ?? team.clubLogoUrl ?? undefined} alt="" />
            <AvatarFallback className="rounded-lg bg-secondary text-lg font-bold">
              {initials(team.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="heading text-2xl text-foreground md:text-3xl">{team.name}</h1>
            <p className="text-sm text-muted-foreground">
              {team.divisionName}
              {team.clubName ? ` · ${team.clubName}` : ""}
            </p>
          </div>
        </div>
        {otherTeams.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  Switch team
                  <MoreVertical className="ml-1.5 h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {otherTeams.map((t) => (
                <DropdownMenuItem key={t.id} render={<Link href={`/dashboard/org?team=${t.id}`} />}>
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* League Ready status banner */}
      <ReadinessBanner readiness={readiness} />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Avg Team Rating"
          value={avgRating != null ? avgRating.toFixed(2) : "—"}
          hint="Playtomic"
        />
        <StatCard
          icon={<UserPlus className="h-5 w-5" />}
          label="Squad"
          value={`${filled} / ${readiness.maxPlayers}`}
          hint={slotsRemaining > 0 ? `${slotsRemaining} open` : "Full"}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="League Position"
          value={standing?.rank ? `#${standing.rank}` : "—"}
          hint={standing ? `${standing.points} pts` : "Not started"}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Fees"
          value={payment.clubPaysFees ? "Club" : `${payment.paidCount}/${filled}`}
          hint={
            payment.clubPaysFees
              ? "Club pays"
              : payment.outstandingAmount > 0
                ? `R${payment.outstandingAmount} due`
                : "All paid"
          }
        />
      </div>

      {/* Next fixture */}
      {nextFixture ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {nextFixture.isHome ? "vs" : "@"} {nextFixture.opponent}
              </p>
              <p className="text-xs text-muted-foreground">
                {nextFixture.week ? `Week ${nextFixture.week}` : "Upcoming"}
                {fmtDate(nextFixture.matchDate) ? ` · ${fmtDate(nextFixture.matchDate)}` : ""}
                {nextFixture.timeslot ? ` · ${nextFixture.timeslot}` : ""}
              </p>
            </div>
          </div>
          <Badge variant="secondary">{nextFixture.isHome ? "Home" : "Away"}</Badge>
        </Card>
      ) : null}

      {/* Squad — grouped by category */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="heading text-lg text-foreground">Squad</h2>
          {canManage && slotsRemaining > 0 ? <MyTeamAddPlayer teamId={team.id} slotsRemaining={slotsRemaining} /> : null}
        </div>
        {pairingCategories.length > 0 ? (
          <div className="space-y-4">
            {pairingCategories.map((cat) => (
              <CategorySection
                key={cat.category}
                cat={cat}
                teamId={team.id}
                canManage={canManage}
                slotsRemaining={slotsRemaining}
                clubPaysFees={payment.clubPaysFees}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {slots.map((slot, i) => (
              <RosterSlot key={i} slot={slot} teamId={team.id} canManage={canManage} slotsRemaining={slotsRemaining} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReadinessBanner({ readiness }: { readiness: MyTeamViewData["readiness"] }) {
  if (readiness.isLeagueReady) {
    return (
      <Card className="flex items-center gap-3 border-emerald-500/30 bg-emerald-500/10 p-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
        <div>
          <p className="font-semibold text-foreground">League Ready</p>
          <p className="text-sm text-muted-foreground">
            Full squad of {readiness.maxPlayers} with all fees settled. You&apos;re set for the season.
          </p>
        </div>
      </Card>
    )
  }
  return (
    <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-500/10 p-4">
      <AlertCircle className="h-6 w-6 shrink-0 text-amber-500" />
      <div>
        <p className="font-semibold text-foreground">Not League Ready yet</p>
        <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          {readiness.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

function RosterSlot({
  slot,
  teamId,
  canManage,
  slotsRemaining,
}: {
  slot: MyTeamSlot
  teamId: number
  canManage: boolean
  slotsRemaining: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (slot.kind === "empty") {
    if (canManage) {
      return (
        <MyTeamAddPlayer
          teamId={teamId}
          slotsRemaining={slotsRemaining}
          trigger={
            <button className="flex h-full min-h-[72px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Plus className="h-4 w-4" /> Add Player
            </button>
          }
        />
      )
    }
    return (
      <div className="flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Open slot
      </div>
    )
  }

  if (slot.kind === "pending") {
    return (
      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarFallback className="bg-secondary text-xs">
              {slot.name ? initials(slot.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{slot.name ?? slot.email}</p>
            <p className="truncate text-xs text-muted-foreground">{slot.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Invited
          </Badge>
          {canManage ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await cancelInvite(slot.inviteId)
                  if (res.error) toast.error(res.error)
                  else {
                    toast.success("Invite cancelled.")
                    router.refresh()
                  }
                })
              }
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </Card>
    )
  }

  // Active player
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={slot.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-secondary text-xs">{initials(slot.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{slot.name}</p>
            {slot.isCaptain ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {slot.playtomicRating != null ? (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3" /> {slot.playtomicRating.toFixed(1)}
              </span>
            ) : (
              <span>Unrated</span>
            )}
            {!slot.registered ? <span className="text-amber-500">Not registered</span> : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {slot.paid ? (
          <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
            Unpaid
          </Badge>
        )}
        {canManage && !slot.isCaptain ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Player options</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {slot.playtomicUrl ? (
                <DropdownMenuItem render={<a href={slot.playtomicUrl} target="_blank" rel="noreferrer" />}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Playtomic profile
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() =>
                  start(async () => {
                    const res = await removeFromTeam({ teamId, playerId: slot.playerId })
                    if (res.error) toast.error(res.error)
                    else {
                      toast.success("Player removed.")
                      router.refresh()
                    }
                  })
                }
              >
                Remove from team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </Card>
  )
}

// ── Category-grouped squad section ────────────────────────────────────────────

const CATEGORY_META: Record<string, { gender: "male" | "female"; session: 1 | 2; featureCourt: boolean }> = {
  "Mens Beginner": { gender: "male", session: 1, featureCourt: false },
  "Mens Intermediate": { gender: "male", session: 1, featureCourt: false },
  "Mens Open": { gender: "male", session: 2, featureCourt: true },
  "Ladies Open": { gender: "female", session: 2, featureCourt: true },
}

function CategorySection({
  cat,
  teamId,
  canManage,
  slotsRemaining,
  clubPaysFees,
}: {
  cat: PairingCategory
  teamId: number
  canManage: boolean
  slotsRemaining: number
  clubPaysFees: boolean
}) {
  const meta = CATEGORY_META[cat.category]
  const isFemale = meta?.gender === "female"
  const isFeature = meta?.featureCourt ?? false
  const GenderIcon = isFemale ? Venus : Mars
  const allSlots = cat.pairs.flat()
  const filledCount = allSlots.filter((s) => s.player !== null).length

  return (
    <div>
      {/* Category header */}
      <div className="mb-2 flex items-center gap-2">
        <GenderIcon className={cn("h-3.5 w-3.5 shrink-0", isFemale ? "text-pink-500" : "text-sky-500")} />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">{cat.category}</h3>
        {isFeature && (
          <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px] font-normal">
            Feature
          </Badge>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{filledCount}/2 filled</span>
      </div>

      {/* Pair of slots side by side */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allSlots.map((slot) => {
          const p = slot.player
          if (!p) {
            return (
              <div
                key={`${slot.pairIndex}-${slot.slotIndex}`}
                className="flex min-h-[64px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
              >
                Open slot
              </div>
            )
          }
          return (
            <Card key={`${slot.pairIndex}-${slot.slotIndex}`} className="flex items-center gap-3 p-3">
              <Avatar className="h-9 w-9 shrink-0 border border-border">
                <AvatarFallback className="bg-secondary text-xs">{initials(p.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.playtomicRating != null ? (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3" /> {p.playtomicRating.toFixed(1)}
                    </span>
                  ) : (
                    <span>Unrated</span>
                  )}
                </div>
              </div>
              {(clubPaysFees || p.paid) ? (
                <Badge variant="secondary" className="shrink-0 gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Paid
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 text-amber-600 dark:text-amber-400">
                  Unpaid
                </Badge>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

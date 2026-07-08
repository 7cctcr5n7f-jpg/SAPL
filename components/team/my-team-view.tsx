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
    <div className="space-y-8">
      {/* ── Team identity ─────────────────────────────────────────────── */}
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
            {team.captainName ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Crown className="h-3 w-3 text-amber-500" />
                <span>Captain: <span className="font-semibold text-foreground">{team.captainName}</span></span>
              </p>
            ) : null}
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

      {/* ── Readiness strip ───────────────────────────────────────────── */}
      <ReadinessBanner readiness={readiness} />

      {/* ── Stat strip — no cards, just bold numbers ──────────────────── */}
      <div className="flex divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
        <StatPill
          label="Avg PR"
          value={avgRating != null ? avgRating.toFixed(2) : "—"}
          highlight
        />
        <StatPill
          label="Squad"
          value={`${filled} / ${readiness.maxPlayers}`}
          sub={slotsRemaining > 0 ? `${slotsRemaining} open` : "Full"}
        />
        <StatPill
          label="Position"
          value={standing?.rank ? `#${standing.rank}` : "—"}
          sub={standing ? `${standing.points} pts` : "Not started"}
        />
        <StatPill
          label="Fees"
          value={payment.clubPaysFees ? "Team" : `${payment.paidCount}/${filled}`}
          sub={
            payment.clubPaysFees
              ? "Team pays"
              : payment.outstandingAmount > 0
                ? `R${payment.outstandingAmount} due`
                : "All paid"
          }
        />
      </div>

      {/* ── Next fixture ──────────────────────────────────────────────── */}
      {nextFixture ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-primary bg-primary/5 px-4 py-3 rounded-r-xl">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
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
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {nextFixture.isHome ? "Home" : "Away"}
          </span>
        </div>
      ) : null}

      {/* ── Squad ─────────────────────────────────────────────────────── */}
      <div>
        {/* Section heading */}
        <div className="mb-5 flex items-end justify-between border-b-2 border-foreground pb-2">
          <h2 className="heading text-xl font-black uppercase tracking-tight text-foreground">Squad</h2>
          {canManage && slotsRemaining > 0 ? <MyTeamAddPlayer teamId={team.id} slotsRemaining={slotsRemaining} /> : null}
        </div>

        {pairingCategories.length > 0 ? (
          <div className="space-y-6">
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
          <div className="divide-y divide-border">
            {slots.map((slot, i) => (
              <RosterSlot key={i} slot={slot} teamId={team.id} canManage={canManage} slotsRemaining={slotsRemaining} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-4 text-center">
      <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-black tabular-nums leading-none", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </span>
      {sub ? <span className="mt-1 text-[11px] text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

function ReadinessBanner({ readiness }: { readiness: MyTeamViewData["readiness"] }) {
  if (readiness.isLeagueReady) {
    return (
      <div className="flex items-center gap-3 border-l-4 border-emerald-500 bg-emerald-500/8 px-4 py-3 rounded-r-xl">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className="font-bold text-foreground">League Ready</p>
          <p className="text-sm text-muted-foreground">
            Full squad of {readiness.maxPlayers} with all fees settled. You&apos;re set for the season.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-amber-500/8 px-4 py-3 rounded-r-xl">
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
      <div>
        <p className="font-bold text-foreground">Not League Ready yet</p>
        <ul className="mt-0.5 space-y-0.5 text-sm text-muted-foreground">
          {readiness.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
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
      <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
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
      </div>
    )
  }

  // Active player
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
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
    </div>
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
  const accentColor = isFemale ? "border-pink-500" : "border-sky-500"
  const allSlots = cat.pairs.flat()
  const filledCount = allSlots.filter((s) => s.player !== null).length
  const isFull = filledCount === allSlots.length

  return (
    <div>
      {/* Category header — editorial accent bar */}
      <div className={cn("mb-3 flex items-center gap-3 border-l-4 pl-3", accentColor)}>
        <GenderIcon className={cn("h-4 w-4 shrink-0", isFemale ? "text-pink-500" : "text-sky-500")} />
        <h3 className="font-black uppercase tracking-widest text-foreground text-sm">{cat.category}</h3>
        {isFeature && (
          <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Feature
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isFull ? "bg-emerald-500" : "bg-amber-400",
            )}
          />
          <span className="text-[11px] font-medium text-muted-foreground">{filledCount}/2</span>
        </div>
      </div>

      {/* Player rows — no cards, just clean horizontal rows */}
      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {allSlots.map((slot) => {
          const p = slot.player
          if (!p) {
            return (
              <div
                key={`${slot.pairIndex}-${slot.slotIndex}`}
                className="flex items-center gap-3 px-4 py-3 bg-muted/30"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-muted-foreground italic">Open slot</span>
              </div>
            )
          }
          const isPaid = clubPaysFees || p.paid
          return (
            <div
              key={`${slot.pairIndex}-${slot.slotIndex}`}
              className="flex items-center gap-3 px-4 py-3 bg-card"
            >
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground uppercase">
                {initials(p.name)}
              </div>

              {/* Name + rating */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground leading-tight">{p.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3" />
                  <span>{p.playtomicRating != null ? p.playtomicRating.toFixed(1) : "—"}</span>
                </div>
              </div>

              {/* Fee dot */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isPaid ? "bg-emerald-500" : "bg-amber-400",
                  )}
                />
                <span className={cn("text-xs font-medium", isPaid ? "text-emerald-600" : "text-amber-600")}>
                  {isPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

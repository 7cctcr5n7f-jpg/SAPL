"use client"

import { useTransition } from "react"
import Link from "next/link"
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
  ChevronDown,
  Users,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MyTeamView as MyTeamViewData, MyTeamSlot } from "@/lib/my-team"

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

function fmtZAR(amount: number) {
  return `R ${amount.toLocaleString("en-ZA")}`
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2 className="font-heading text-base font-bold uppercase tracking-wide text-foreground whitespace-nowrap">
        {children}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function MyTeamView({ data }: { data: MyTeamViewData }) {
  const { team, readiness, avgRating, slots, payment, nextFixture, standing, otherTeams, canManage } = data
  const filled = slots.filter((s) => s.kind !== "empty").length
  const slotsRemaining = readiness.maxPlayers - filled

  return (
    <div className="space-y-8">
      {/* ── Team identity header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-xl border border-border shadow-sm">
            <AvatarImage src={team.logoUrl ?? team.clubLogoUrl ?? undefined} alt="" />
            <AvatarFallback className="rounded-xl bg-secondary text-lg font-bold font-heading">
              {initials(team.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-3xl font-black tracking-tight text-foreground leading-none">
              {team.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              {team.divisionName !== "Unassigned" && (
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {team.divisionName}
                </span>
              )}
              {team.clubName && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {team.clubName}
                </span>
              )}
              {team.captainName && (
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" />
                  {team.captainName}
                </span>
              )}
            </p>
          </div>
        </div>

        {otherTeams.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  Switch team
                  <ChevronDown className="h-3.5 w-3.5" />
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
        )}
      </div>

      {/* ── League Ready status banner ────────────────────────────────────── */}
      <ReadinessBanner readiness={readiness} />

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <div className="flex items-stretch divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
        <StatPill
          icon={<Star className="h-4 w-4" />}
          label="Avg PR"
          value={avgRating != null ? avgRating.toFixed(2) : "—"}
          highlight={avgRating != null}
        />
        <StatPill
          icon={<Users className="h-4 w-4" />}
          label="Squad"
          value={`${filled}/${readiness.maxPlayers}`}
          sub={slotsRemaining > 0 ? `${slotsRemaining} open` : "Full"}
        />
        <StatPill
          icon={<Trophy className="h-4 w-4" />}
          label="Position"
          value={standing?.rank ? `#${standing.rank}` : "—"}
          sub={standing ? `${standing.points} pts` : "Not started"}
        />
        <StatPill
          icon={<CreditCard className="h-4 w-4" />}
          label="Fees"
          value={
            payment.clubPaysFees
              ? "Team"
              : payment.outstandingAmount > 0
                ? fmtZAR(payment.outstandingAmount)
                : "Settled"
          }
          sub={
            payment.clubPaysFees
              ? "Club pays"
              : `${payment.paidCount}/${filled} paid`
          }
          accent={!payment.clubPaysFees && payment.outstandingAmount > 0 ? "text-amber-500" : "text-emerald-500"}
        />
      </div>

      {/* ── Next fixture ─────────────────────────────────────────────────── */}
      {nextFixture && (
        <div>
          <SectionHeading>Next Match</SectionHeading>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {nextFixture.isHome ? "vs" : "@"} {nextFixture.opponent}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nextFixture.week ? `Week ${nextFixture.week}` : "Upcoming"}
                  {fmtDate(nextFixture.matchDate) ? ` · ${fmtDate(nextFixture.matchDate)}` : ""}
                  {nextFixture.venue ? ` · ${nextFixture.venue}` : ""}
                  {nextFixture.timeslot ? ` · ${nextFixture.timeslot}` : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className={nextFixture.isHome ? "text-emerald-600" : "text-muted-foreground"}>
              {nextFixture.isHome ? "Home" : "Away"}
            </Badge>
          </div>
        </div>
      )}

      {/* ── Fees breakdown ───────────────────────────────────────────────── */}
      {!payment.clubPaysFees && payment.outstandingAmount > 0 && (
        <div>
          <SectionHeading>Fees</SectionHeading>
          <div className="flex items-start gap-4 rounded-xl border border-amber-400/40 bg-amber-500/5 p-4">
            <div className="shrink-0 rounded-xl bg-amber-500/15 p-2.5 text-amber-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground leading-tight">{team.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {payment.unpaidCount} player{payment.unpaidCount !== 1 ? "s" : ""} outstanding —{" "}
                {fmtZAR(payment.outstandingAmount)} due
              </p>
              <p className="text-xs text-amber-600 font-medium mt-1">
                Each player pays their own league fee from their dashboard.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600">
                {payment.paidCount}/{payment.paidCount + payment.unpaidCount} paid
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Squad roster ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>Squad</SectionHeading>
          {canManage && slotsRemaining > 0 && (
            <MyTeamAddPlayer teamId={team.id} slotsRemaining={slotsRemaining} />
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slots.map((slot, i) => (
            <RosterSlot
              key={i}
              slot={slot}
              teamId={team.id}
              canManage={canManage}
              slotsRemaining={slotsRemaining}
              clubPaysFees={payment.clubPaysFees}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Readiness banner ──────────────────────────────────────────────────────────

function ReadinessBanner({ readiness }: { readiness: MyTeamViewData["readiness"] }) {
  if (readiness.isLeagueReady) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className="font-semibold text-foreground text-sm">League Ready</p>
          <p className="text-xs text-muted-foreground">
            Full squad of {readiness.maxPlayers} with all fees settled.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
      <div>
        <p className="font-semibold text-foreground text-sm">Not League Ready yet</p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {readiness.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  sub,
  highlight,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  highlight?: boolean
  accent?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <span
        className={cn(
          "font-heading text-2xl font-black tabular-nums leading-none",
          highlight ? "text-primary" : accent ? accent : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Roster slot ───────────────────────────────────────────────────────────────

function RosterSlot({
  slot,
  teamId,
  canManage,
  slotsRemaining,
  clubPaysFees,
}: {
  slot: MyTeamSlot
  teamId: number
  canManage: boolean
  slotsRemaining: number
  clubPaysFees: boolean
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
            <button className="flex h-full min-h-[72px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Plus className="h-4 w-4" /> Add player
            </button>
          }
        />
      )
    }
    return (
      <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Open slot
      </div>
    )
  }

  if (slot.kind === "pending") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
              {slot.name ? initials(slot.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{slot.name ?? slot.email}</p>
            <p className="truncate text-xs text-muted-foreground">{slot.email}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-amber-600">
            <Clock className="h-3 w-3" /> Invited
          </Badge>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
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
          )}
        </div>
      </div>
    )
  }

  // Active player
  const payBadge = clubPaysFees ? null : slot.paid ? "paid" : "unpaid"

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={slot.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-secondary text-xs">{initials(slot.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{slot.name}</p>
            {slot.isCaptain && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {slot.playtomicRating != null ? (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3" /> {slot.playtomicRating.toFixed(1)}
              </span>
            ) : (
              <span>Unrated</span>
            )}
            {!slot.registered && <span className="text-amber-500">Not registered</span>}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {payBadge === "paid" && (
          <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </Badge>
        )}
        {payBadge === "unpaid" && (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
            Unpaid
          </Badge>
        )}
        {canManage && !slot.isCaptain && (
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
              {slot.playtomicUrl && (
                <DropdownMenuItem render={<a href={slot.playtomicUrl} target="_blank" rel="noreferrer" />}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Playtomic profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
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
        )}
      </div>
    </div>
  )
}

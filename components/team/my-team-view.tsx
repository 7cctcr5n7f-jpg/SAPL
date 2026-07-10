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
  ExternalLink,
  ChevronDown,
  Users,
  MapPin,
  Phone,
  Mail,
  Mars,
  Venus,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MyTeamView as MyTeamViewData, MyTeamCategory, MyTeamCategorySlot } from "@/lib/my-team"

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
  return `R\u00a0${amount.toLocaleString("en-ZA")}`
}

// ── Section heading with full-width hairline rule ─────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <h2 className="font-heading text-base font-bold uppercase tracking-wide text-foreground whitespace-nowrap">
        {children}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MyTeamView({ data }: { data: MyTeamViewData }) {
  const { team, readiness, avgRating, pairingCategories, payment, nextFixture, standing, otherTeams, canManage } = data

  // Count filled slots across all categories — active players + pending invites
  // both reserve a slot visually.
  const allSlots = pairingCategories.flatMap((c) => c.slots)
  const filledSlots = allSlots.filter((s) => s.player !== null || s.inviteEmail !== null).length
  const totalSlots = allSlots.length // should be 8
  const slotsRemaining = totalSlots - filledSlots

  const hasOwnerInfo = team.ownerName || team.ownerPhone || team.ownerEmail

  return (
    <div className="space-y-5">
      {/* ── Team identity header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 rounded-full border border-border shadow-sm">
            <AvatarImage src={team.logoUrl ?? team.clubLogoUrl ?? undefined} alt="" />
            <AvatarFallback className="rounded-full bg-secondary text-xl font-bold font-heading">
              {initials(team.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-4xl font-black tracking-tight text-foreground leading-none uppercase">
              {team.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              {team.divisionName !== "Unassigned" ? (
                <span>{team.divisionName}</span>
              ) : (
                <span>Unassigned</span>
              )}
              {team.clubName && (
                <>
                  <span className="text-border">·</span>
                  <span>{team.clubName}</span>
                </>
              )}
            </p>
            {/* Owner inline — plain text, no card */}
            {hasOwnerInfo && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {team.ownerName && (
                  <span className="font-medium text-foreground">{team.ownerName}</span>
                )}
                {team.ownerPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {team.ownerPhone}
                  </span>
                )}
                {team.ownerEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />
                    {team.ownerEmail}
                  </span>
                )}
                {team.coOwnerEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />
                    {team.coOwnerEmail}
                    <span className="text-muted-foreground/60">(co-owner)</span>
                  </span>
                )}
              </p>
            )}
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
      <div className="flex items-stretch divide-x divide-border overflow-hidden rounded-none border border-border bg-card">
        <StatPill
          label="AVG PR"
          value={avgRating != null ? avgRating.toFixed(2) : "—"}
          highlight={avgRating != null}
        />
        <StatPill
          label="SQUAD"
          value={`${filledSlots} / ${totalSlots}`}
          sub={slotsRemaining > 0 ? `${slotsRemaining} open` : "Full"}
        />
        <StatPill
          label="POSITION"
          value={standing?.rank ? `#${standing.rank}` : "—"}
          sub={standing ? `${standing.points} pts` : "Not started"}
        />
        <StatPill
          label="FEES"
          value={
            payment.clubPaysFees
              ? "Team"
              : `${payment.paidCount}/${filledSlots}`
          }
          sub={
            payment.clubPaysFees
              ? "Club pays"
              : payment.outstandingAmount > 0
                ? `${fmtZAR(payment.outstandingAmount)} due`
                : "Settled"
          }
          accent={!payment.clubPaysFees && payment.outstandingAmount > 0 ? "text-amber-500" : undefined}
        />
      </div>

      {/* Team owner is now shown inline under the team name in the header above */}

      {/* ── Next fixture ────────────────────────────────────────────���────── */}
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
            <Badge
              variant="secondary"
              className={nextFixture.isHome ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : ""}
            >
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

      {/* ── Squad roster (category-grouped) ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <SectionHeading>Squad</SectionHeading>
          {canManage && slotsRemaining > 0 && (
            <div className="mb-5">
              <MyTeamAddPlayer teamId={team.id} slotsRemaining={slotsRemaining} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pairingCategories.map((cat) => (
            <CategorySection
              key={cat.name}
              cat={cat}
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
      <div className="flex items-center gap-3 border-l-4 border-emerald-500 bg-emerald-500/8 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
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
    <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-amber-500/8 px-4 py-3">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
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

// ── Stat pill (no icon, matches screenshot) ───────────────────────────────────

function StatPill({
  label,
  value,
  sub,
  highlight,
  accent,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  accent?: string
}) {
  return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-3 text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </span>
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

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  cat,
  teamId,
  canManage,
  slotsRemaining,
  clubPaysFees,
}: {
  cat: MyTeamCategory
  teamId: number
  canManage: boolean
  slotsRemaining: number
  clubPaysFees: boolean
}) {
  const filledCount = cat.slots.filter((s) => s.player !== null || s.inviteEmail !== null).length
  const totalCount = cat.slots.length
  const dotColor =
    filledCount === totalCount
      ? "bg-emerald-500"
      : filledCount > 0
        ? "bg-amber-500"
        : "bg-amber-400"

  const accentColor = cat.gender === "female" ? "bg-pink-500" : "bg-sky-500"

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {/* Category header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-1 self-stretch rounded-full", accentColor)} />
          <span className="text-muted-foreground">
            {cat.gender === "female" ? (
              <Venus className="h-4 w-4" />
            ) : (
              <Mars className="h-4 w-4" />
            )}
          </span>
          <span className="font-heading text-sm font-bold uppercase tracking-wide text-foreground">
            {cat.name}
          </span>
          {cat.isFeatureCourt && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wide border-primary/40 text-primary bg-primary/5"
            >
              Feature
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", dotColor)} />
          <span className="text-xs text-muted-foreground">
            {filledCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Slots */}
      <div className="space-y-1.5">
        {cat.slots.map((slot, i) => (
          <CategorySlotRow
            key={i}
            slot={slot}
            teamId={teamId}
            canManage={canManage}
            slotsRemaining={slotsRemaining}
            clubPaysFees={clubPaysFees}
          />
        ))}
      </div>
    </div>
  )
}

// ── Single category slot row ──────────────────────────────────────────────────

function CategorySlotRow({
  slot,
  teamId,
  canManage,
  slotsRemaining,
  clubPaysFees,
}: {
  slot: MyTeamCategorySlot
  teamId: number
  canManage: boolean
  slotsRemaining: number
  clubPaysFees: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  // Pending invite
  if (!slot.player && slot.inviteEmail) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 border border-border shrink-0">
            <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
              {slot.inviteName ? initials(slot.inviteName) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {slot.inviteName ?? slot.inviteEmail}
            </p>
            <p className="truncate text-xs text-muted-foreground">{slot.inviteEmail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-amber-600">
            <Clock className="h-3 w-3" /> Invited
          </Badge>
          {canManage && slot.inviteId != null && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await cancelInvite(slot.inviteId!)
                  if (res.error) toast.error(res.error)
                  else {
                    toast.success("Invite cancelled.")
                    router.refresh()
                  }
                })
              }
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Cancel invite</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Empty slot
  if (!slot.player) {
    if (canManage) {
      return (
        <MyTeamAddPlayer
          teamId={teamId}
          slotsRemaining={slotsRemaining}
          targetCategory={slot.category}
          targetPairIndex={slot.pairIndex}
          targetSlotIndex={slot.slotIndex}
          trigger={
            <button className="flex w-full items-center gap-3 border-b border-border py-2 last:border-0 text-sm text-muted-foreground hover:text-primary transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <span>Open slot</span>
            </button>
          }
        />
      )
    }
    return (
      <div className="flex items-center gap-3 border-b border-border py-2 last:border-0 text-sm text-muted-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border shrink-0">
          <Plus className="h-4 w-4" />
        </div>
        <span>Open slot</span>
      </div>
    )
  }

  // Active player
  const { player } = slot
  const payBadge = clubPaysFees ? null : player.paid ? "paid" : "unpaid"

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-8 w-8 border border-border shrink-0">
          <AvatarFallback className="bg-secondary text-xs font-semibold">
            {initials(player.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{player.name}</p>
            {player.isCaptain && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3" />
            {player.playtomicRating != null ? (
              <span>{player.playtomicRating.toFixed(1)}</span>
            ) : (
              <span>Unrated</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {payBadge === "paid" && (
          <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
            Paid
          </Badge>
        )}
        {payBadge === "unpaid" && (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
            Unpaid
          </Badge>
        )}
        {canManage && (
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
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  start(async () => {
                    const res = await removeFromTeam({ teamId, playerId: player.playerId })
                    if (res.error) toast.error(res.error)
                    else {
                      toast.success("Player removed — you can now add them to a different slot.")
                      router.refresh()
                    }
                  })
                }
              >
                Remove from squad
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

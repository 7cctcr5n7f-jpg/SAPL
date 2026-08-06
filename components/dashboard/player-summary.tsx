"use client"

import Link from "next/link"
import type { PlayerOverviewTeam, PendingTeamInvite, PairingPartner } from "@/lib/queries-dashboard"
import { PlayerPhotoUploader } from "@/components/dashboard/player-photo-uploader"
import { Users, AlertCircle, CheckCircle2, Mail, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function PlayerSummary({
  firstName,
  team,
  feesPaid,
  playtomicRating,
  avatarUrl,
  onPhotoChange,
  pendingInvites = [],
  partner,
}: {
  firstName: string
  team: PlayerOverviewTeam | null
  feesPaid: boolean
  playtomicRating: string | null
  avatarUrl?: string | null
  onPhotoChange?: (url: string) => void
  pendingInvites?: PendingTeamInvite[]
  partner?: PairingPartner | null
}) {
  const myPr = playtomicRating ? parseFloat(playtomicRating) : null
  const combinedAvg =
    myPr != null && partner?.playtomicRating != null
      ? ((myPr + partner.playtomicRating) / 2).toFixed(2)
      : null

  return (
    <section className="space-y-5">
      {/* ── Fee alert banner ─────────────────────────────────────────────── */}
      {!feesPaid && (
        <div className="flex items-center gap-3 bg-amber-500/10 border-l-4 border-amber-500 px-4 py-3 rounded-r-lg">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm font-semibold text-amber-400 leading-tight">
            League fees outstanding —{" "}
            <a href="#fees" className="underline underline-offset-2">
              view details
            </a>
          </p>
        </div>
      )}

      {/* ── Pending invite banners ───────────────────────────────────────── */}
      {pendingInvites.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center gap-3 bg-primary/10 border-l-4 border-primary px-4 py-3 rounded-r-lg"
        >
          <Mail className="h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Team invite from{" "}
              <span className="text-primary">{inv.teamName}</span>
              {inv.category && (
                <span className="text-muted-foreground font-normal"> &middot; {inv.category}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">You have a pending invite — accept before it expires.</p>
          </div>
          <Link
            href={`/invite/${inv.token}`}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            View invite
          </Link>
        </div>
      ))}

      {/* ── Identity block ───────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_auto_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-5">
          <div className="shrink-0">
            <PlayerPhotoUploader
              value={avatarUrl}
              onChange={onPhotoChange || (() => {})}
              isCapitan={team?.role === "captain"}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">
              {feesPaid ? (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> All fees settled
                </span>
              ) : (
                "Welcome back"
              )}
            </p>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground leading-none text-balance">
              {firstName}
            </h1>
            {team ? (
              <Link
                href="/dashboard/my-team"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">{team.teamName}</span>
                {team.role === "captain" && (
                  <span className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
                    Captain
                  </span>
                )}
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </Link>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not on a team yet</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start justify-center text-left lg:justify-self-center">
          <StatPill label="PR Rating" value={playtomicRating ?? "—"} highlight={!!playtomicRating} compact />
          <StatPill
            label="Combined PR"
            value={combinedAvg ?? "—"}
            highlight={!!combinedAvg}
            compact
          />
        </div>

        <div className="flex min-w-44 flex-col justify-center text-left lg:justify-self-end">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">Playing Partner</span>
          <span className="font-heading text-2xl font-bold leading-none text-foreground">
            {partner?.name ? partner.name.split(" ")[0] : "—"}
          </span>
          {partner?.name && partner.name.includes(" ") ? (
            <span className="mt-1 text-sm text-muted-foreground">{partner.name.split(" ").slice(1).join(" ")}</span>
          ) : null}
        </div>
      </div>


    </section>
  )
}

function StatPill({
  label,
  value,
  highlight,
  sub,
  compact,
}: {
  label: string
  value: string
  highlight?: boolean
  sub?: string
  compact?: boolean
}) {
  return (
    <div className={cn(
      "flex flex-col justify-center px-0 py-1 text-left",
      compact ? "min-h-0" : "min-h-24",
    )}>
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</span>
      <span
        className={cn(
          "font-heading text-2xl font-bold tabular-nums leading-none",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>}
    </div>
  )
}

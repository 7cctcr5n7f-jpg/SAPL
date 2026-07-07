"use client"

import Link from "next/link"
import type { PlayerOverviewTeam, PendingTeamInvite, PairingPartner } from "@/lib/queries-dashboard"
import { PlayerPhotoUploader } from "@/components/dashboard/player-photo-uploader"
import { Users, ChevronRight, AlertCircle, CheckCircle2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

export function PlayerSummary({
  firstName,
  leagueIndex,
  team,
  feesPaid,
  playtomicRating,
  eligibleCategories,
  avatarUrl,
  onPhotoChange,
  pendingInvites = [],
  partner,
}: {
  firstName: string
  leagueIndex: number | null
  team: PlayerOverviewTeam | null
  feesPaid: boolean
  playtomicRating: string | null
  eligibleCategories: string[]
  avatarUrl?: string | null
  onPhotoChange?: (url: string) => void
  pendingInvites?: PendingTeamInvite[]
  partner?: PairingPartner | null
}) {
  const primaryCategory = eligibleCategories?.[0] || null
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
      <div className="flex items-center gap-5">
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
              href="/dashboard/org"
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

      {/* ── Horizontal stats strip ───────────────────────────────────────── */}
      <div className="flex items-stretch divide-x divide-border">
        <StatPill label="PR Rating" value={playtomicRating ?? "—"} highlight={!!playtomicRating} />
        <StatPill
          label="Playing Partner"
          value={partner?.name ? partner.name.split(" ")[0] : "—"}
          sub={partner?.name && partner.name.includes(" ") ? partner.name.split(" ").slice(1).join(" ") : undefined}
        />
        <StatPill
          label="Combined PR"
          value={combinedAvg ?? "—"}
          highlight={!!combinedAvg}
        />
      </div>

      {/* ── Partner block (replaces PR hero widget) ──────────────────────── */}
      {partner ? (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3.5">
          {/* Partner avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary uppercase">
            {partner.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>

          {/* Partner info */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Playing Partner
            </p>
            <p className="font-heading text-base font-bold text-foreground leading-tight truncate">
              {partner.name}
            </p>
          </div>

          {/* Partner PR */}
          <div className="text-center px-3 border-x border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PR</p>
            <p className={cn("font-heading text-xl font-bold tabular-nums", partner.playtomicRating ? "text-foreground" : "text-muted-foreground/40")}>
              {partner.playtomicRating?.toFixed(2) ?? "—"}
            </p>
          </div>

          {/* Combined avg */}
          <div className="text-center pl-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Combined</p>
            <p className={cn("font-heading text-xl font-bold tabular-nums", combinedAvg ? "text-primary" : "text-muted-foreground/40")}>
              {combinedAvg ?? "—"}
            </p>
          </div>
        </div>
      ) : team ? (
        /* On a team but no partner assigned yet */
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3.5 text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <p className="text-sm">No playing partner assigned yet — captain will set the lineup.</p>
        </div>
      ) : null}

      {/* ── CTAs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <Link
          href="/dashboard/profile"
          className="flex-1 flex items-center justify-center rounded-xl border border-border bg-transparent px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
        >
          Edit Profile
        </Link>
        {team ? (
          <Link
            href="/dashboard/org"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            My Team <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/dashboard/profile"
            className="flex-1 flex items-center justify-center rounded-xl bg-secondary px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary/70"
          >
            Find a Team
          </Link>
        )}
      </div>
    </section>
  )
}

function StatPill({
  label,
  value,
  highlight,
  sub,
}: {
  label: string
  value: string
  highlight?: boolean
  sub?: string
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-3 py-3 text-center first:pl-0 last:pr-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</span>
      <span
        className={cn(
          "font-heading text-xl font-bold tabular-nums leading-none",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>}
    </div>
  )
}

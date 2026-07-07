"use client"

import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { PlayerPhotoUploader } from "@/components/dashboard/player-photo-uploader"
import { Users, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
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
}: {
  firstName: string
  leagueIndex: number | null
  team: PlayerOverviewTeam | null
  feesPaid: boolean
  playtomicRating: string | null
  eligibleCategories: string[]
  avatarUrl?: string | null
  onPhotoChange?: (url: string) => void
}) {
  const primaryCategory = eligibleCategories?.[0] || null

  return (
    <section>
      {/* ── Fee alert banner (only when outstanding) ─────────────────────── */}
      {!feesPaid && (
        <div className="flex items-center gap-3 bg-amber-500/10 border-l-4 border-amber-500 px-4 py-3 mb-6 rounded-r-lg">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm font-semibold text-amber-400 leading-tight">
            League fees outstanding —{" "}
            <a href="#fees" className="underline underline-offset-2">
              view details
            </a>
          </p>
        </div>
      )}

      {/* ── Identity block ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 mb-8">
        <div className="shrink-0">
          <PlayerPhotoUploader
            value={avatarUrl}
            onChange={onPhotoChange || (() => {})}
            isCapitan={team?.role === "captain"}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Greeting */}
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">
            {feesPaid ? (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" /> All fees settled
              </span>
            ) : (
              "Welcome back"
            )}
          </p>

          {/* Name — Oswald, massive */}
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground leading-none text-balance">
            {firstName}
          </h1>

          {/* Team pill */}
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

      {/* ── PR hero number ────────────────────────────────────────────────── */}
      <div className="mb-8 border-l-4 border-primary pl-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
          Playtomic Rating
        </p>
        <div className="flex items-end gap-4">
          <span
            className={cn(
              "font-heading font-bold tabular-nums leading-none",
              playtomicRating ? "text-6xl text-foreground" : "text-5xl text-muted-foreground/40",
            )}
          >
            {playtomicRating ?? "—"}
          </span>
          {primaryCategory && (
            <div className="mb-1.5 flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</span>
              <span className="text-base font-bold text-foreground leading-tight">{primaryCategory}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Horizontal stats strip (hairline dividers) ────────────────────── */}
      <div className="flex items-stretch divide-x divide-border mb-8">
        <StatPill
          label="PR Rating"
          value={playtomicRating ?? "—"}
          highlight={!!playtomicRating}
        />
        <StatPill label="Category" value={primaryCategory ?? "—"} />
        <StatPill
          label="Eligible"
          value={eligibleCategories.length > 0 ? String(eligibleCategories.length) : "—"}
          sub={eligibleCategories.length > 0 ? "categories" : undefined}
        />
      </div>

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

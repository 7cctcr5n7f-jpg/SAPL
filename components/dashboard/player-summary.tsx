"use client"

import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { PlayerPhotoUploader } from "@/components/dashboard/player-photo-uploader"
import { Zap, Users } from "lucide-react"

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
    <section className="mb-8">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#E10600] px-6 pt-6 pb-0">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-4 top-12 h-24 w-24 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute left-1/2 bottom-0 h-16 w-16 rounded-full bg-white/5" />

        <div className="relative flex items-end gap-5">
          {/* Avatar */}
          <div className="shrink-0 pb-4">
            <PlayerPhotoUploader
              value={avatarUrl}
              onChange={onPhotoChange || (() => {})}
              isCapitan={team?.role === "captain"}
            />
          </div>

          {/* Name + team */}
          <div className="min-w-0 flex-1 pb-5">
            <p className="text-sm font-medium text-red-100/80 leading-none mb-1">
              {feesPaid ? "All fees settled" : "Fees outstanding"}
            </p>
            <h1 className="text-3xl font-black text-white leading-none tracking-tight text-balance">
              {firstName}
            </h1>
            {team ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                  <Users className="h-3 w-3" />
                  {team.teamName}
                </span>
                {team.role === "captain" && (
                  <span className="rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-yellow-900">
                    Captain
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-red-100/80">Not on a team yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Stat pills below the banner */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {/* League Index */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-3 py-4 text-center">
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            LI
          </span>
          <span className="font-mono text-2xl font-black tabular-nums text-foreground">
            {leagueIndex != null ? leagueIndex.toFixed(2) : "—"}
          </span>
        </div>

        {/* Category */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-3 py-4 text-center">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</span>
          <span className="text-xl font-black text-foreground leading-tight">
            {primaryCategory ?? "—"}
          </span>
        </div>

        {/* Playtomic */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-3 py-4 text-center">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Playtomic</span>
          <span className="text-2xl font-black tabular-nums text-foreground">
            {playtomicRating ?? "—"}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex gap-3">
        <Link
          href="/dashboard/profile"
          className="flex-1 flex items-center justify-center rounded-xl border-2 border-primary px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
        >
          Edit Profile
        </Link>
        {team && (
          <Link
            href="/dashboard/org"
            className="flex-1 flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            My Team
          </Link>
        )}
      </div>
    </section>
  )
}

import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { LeaveTeamButton } from "@/components/dashboard/leave-team-button"
import { MapPin, Settings2 } from "lucide-react"

export function MyTeamCard({ team }: { team: PlayerOverviewTeam }) {
  const winRate = team.played > 0 ? Math.round((team.wins / team.played) * 100) : null

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 bg-secondary/40 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-black tracking-tight text-foreground leading-tight">
            {team.teamName}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {[team.clubName, team.divisionName, team.regionName].filter(Boolean).join(" · ") || "Unassigned"}
          </p>
        </div>
        {team.position != null && (
          <div className="shrink-0 rounded-xl bg-primary/10 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Rank</p>
            <p className="font-mono text-2xl font-black leading-none tabular-nums text-primary">
              #{team.position}
            </p>
          </div>
        )}
      </div>

      {/* Stat blocks */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <StatCard label="Played" value={team.played} accent="bg-secondary" />
        <StatCard label="Wins" value={team.wins} accent="bg-emerald-500/10 text-emerald-600" textAccent="text-emerald-600" />
        <StatCard label="Losses" value={team.losses} accent="bg-red-500/10" textAccent="text-red-500" />
      </div>

      {winRate !== null && (
        <div className="mx-4 mb-4 overflow-hidden rounded-xl bg-secondary/50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Win rate</span>
            <span className="text-sm font-black text-foreground">{winRate}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <Link
          href="/dashboard/org"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage Team
        </Link>
        {team.role !== "captain" && (
          <LeaveTeamButton membershipId={team.membershipId} className="text-xs" />
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = "bg-secondary",
  textAccent,
}: {
  label: string
  value: number
  accent?: string
  textAccent?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-4 text-center ${accent}`}>
      <span className={`font-mono text-3xl font-black tabular-nums leading-none ${textAccent ?? "text-foreground"}`}>
        {value}
      </span>
      <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

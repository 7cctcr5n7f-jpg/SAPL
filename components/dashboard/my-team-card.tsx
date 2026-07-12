import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { LeaveTeamButton } from "@/components/dashboard/leave-team-button"
import { MapPin, Settings2 } from "lucide-react"

export function MyTeamCard({ team }: { team: PlayerOverviewTeam }) {
  const winRate = team.played > 0 ? Math.round((team.wins / team.played) * 100) : null

  return (
    <div>
      {/* Team identity row */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground leading-tight">
            {team.teamName}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {[team.clubName, team.divisionName, team.regionName].filter(Boolean).join(" · ") || "Unassigned"}
          </p>
        </div>
        {team.position != null && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rank</p>
            <p className="font-heading text-3xl font-black leading-none tabular-nums text-primary">
              #{team.position}
            </p>
          </div>
        )}
      </div>

      {/* Stats row — bold numbers with hairline dividers */}
      <div className="flex items-stretch divide-x divide-border mb-6">
        <StatItem label="Played" value={team.played} />
        <StatItem label="Wins" value={team.wins} accent="text-emerald-500" />
        <StatItem label="Losses" value={team.losses} accent="text-primary" />
        {winRate !== null && (
          <StatItem label="Win rate" value={`${winRate}%`} />
        )}
      </div>

      {/* Win rate bar */}
      {winRate !== null && (
        <div className="mb-6">
          <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/my-team"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Settings2 className="h-4 w-4" />
          Manage Team
        </Link>
        {team.role !== "captain" && (
          <LeaveTeamButton membershipId={team.membershipId} className="text-xs text-muted-foreground hover:text-destructive" />
        )}
      </div>
    </div>
  )
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: string
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 text-center first:pl-0 last:pr-0">
      <span
        className={`font-heading text-4xl font-black tabular-nums leading-none ${accent ?? "text-foreground"}`}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

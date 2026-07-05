import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { LeaveTeamButton } from "@/components/dashboard/leave-team-button"
import { Building2 } from "lucide-react"

// SECTION 5 — My Team. A compact record card: club, division, position, W/L.
// The section heading is provided by the parent page for consistent spacing.
export function MyTeamCard({ team }: { team: PlayerOverviewTeam }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold leading-tight">{team.teamName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {team.clubName ? `${team.clubName} · ` : ""}
              {team.divisionName}
              {team.regionName ? ` · ${team.regionName}` : ""}
            </p>
          </div>
          {team.position != null && (
            <div className="rounded-md border border-border bg-background px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Position</p>
              <p className="font-mono text-lg font-bold leading-none tabular-nums">{team.position}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
          <Stat label="Played" value={team.played} />
          <Stat label="Wins" value={team.wins} />
          <Stat label="Losses" value={team.losses} />
        </div>
        <div className="flex items-center justify-end gap-1 border-t border-border px-4 py-2">
          <Link
            href="/dashboard/org"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
          >
            <Building2 className="h-3.5 w-3.5" />
            Manage Team
          </Link>
          {team.role !== "captain" && <LeaveTeamButton membershipId={team.membershipId} className="text-xs" />}
        </div>
      </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3">
      <p className="font-mono text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

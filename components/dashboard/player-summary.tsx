import Link from "next/link"
import type { PlayerOverviewTeam } from "@/lib/queries-dashboard"
import { Crest } from "@/components/league-centre/crest"
import { LeaveTeamButton } from "@/components/dashboard/leave-team-button"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertCircle, ShieldCheck, Building2 } from "lucide-react"

// ---------------------------------------------------------------------------
// SECTION 1 — Player Summary. A single, compact bar that answers, at a glance:
// who you play for, division, region, your LI, account standing and fee status.
// Deliberately minimal — no large hero, no marketplace/TPR snapshot.
// ---------------------------------------------------------------------------

export function PlayerSummary({
  firstName,
  leagueIndex,
  team,
  feesPaid,
}: {
  firstName: string
  leagueIndex: number | null
  team: PlayerOverviewTeam | null
  // True when the player owes nothing (club pays, already paid, or no fees).
  feesPaid: boolean
}) {
  const feeLabel = !team
    ? null
    : team.clubPaysFees
      ? "Paid by Club"
      : feesPaid
        ? "Paid by Player"
        : "Fees due"

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Identity + team */}
        <div className="flex min-w-0 items-center gap-3">
          {team ? (
            <Crest name={team.teamName} logoUrl={null} size="md" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Welcome back, {firstName}</p>
            {team ? (
              <>
                <h1 className="truncate font-serif text-xl font-bold leading-tight">{team.teamName}</h1>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{team.divisionName}</span>
                  {team.regionName ? <span>· {team.regionName}</span> : null}
                  {team.role === "captain" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Captain
                    </span>
                  ) : null}
                </p>
              </>
            ) : (
              <h1 className="font-serif text-xl font-bold leading-tight">{firstName}</h1>
            )}
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2">
          {leagueIndex != null && (
            <div className="rounded-md border border-border bg-background px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">LI</p>
              <p className="font-mono text-sm font-bold tabular-nums leading-none">{leagueIndex.toFixed(2)}</p>
            </div>
          )}
          <StatusChip ok icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Account Active" />
          {feeLabel ? (
            <StatusChip
              ok={feesPaid}
              icon={
                feesPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />
              }
              label={feeLabel}
              href={feesPaid ? undefined : "#fees"}
            />
          ) : null}
        </div>
      </div>

      {/* Team actions */}
      {team && (
        <div className="flex items-center justify-end gap-1 border-t border-border px-4 py-2">
          <Link
            href={`/teams/${team.teamId}`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
          >
            <Building2 className="h-3.5 w-3.5" />
            View Team
          </Link>
          {team.role !== "captain" && <LeaveTeamButton membershipId={team.membershipId} className="text-xs" />}
        </div>
      )}
    </section>
  )
}

function StatusChip({
  ok,
  icon,
  label,
  href,
}: {
  ok: boolean
  icon: React.ReactNode
  label: string
  href?: string
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold",
    ok ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/15 text-amber-500",
  )
  if (href) {
    return (
      <a href={href} className={cn(className, "transition-opacity hover:opacity-80")}>
        {icon}
        {label}
      </a>
    )
  }
  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  )
}

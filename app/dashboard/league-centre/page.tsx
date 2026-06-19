import { getCurrentUser } from "@/lib/session"
import { getLeagueCentreData } from "@/lib/queries-league-centre"
import { LeagueCentreExperience } from "@/components/league-centre/league-centre-experience"
import { PageHeader } from "@/components/dashboard/page-header"

export const metadata = {
  title: "League Centre | SAPL",
  description: "View standings, fixtures, and results.",
}

export default async function DashboardLeagueCentrePage() {
  const user = await getCurrentUser()
  if (!user) return null

  const data = await getLeagueCentreData(user)

  return (
    <div className="space-y-8">
      <PageHeader
        title="League Centre"
        subtitle={`${data.stats.seasonName ?? "SAPL Season"} • ${data.stats.teamCount} teams`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Teams" value={data.stats.teamCount} />
        <StatCard label="Clubs" value={data.stats.clubCount} />
        <StatCard label="Played" value={data.stats.matchesPlayed} />
        <StatCard label="Remaining" value={data.stats.matchesRemaining} />
      </div>

      {/* League Centre Experience */}
      <div className="rounded-lg border border-border bg-card">
        <LeagueCentreExperience data={data} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <dd className="text-2xl font-bold text-foreground">{value}</dd>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </dt>
    </div>
  )
}

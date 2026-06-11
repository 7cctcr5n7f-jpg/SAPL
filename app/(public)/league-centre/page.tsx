import { getCurrentUser } from "@/lib/session"
import { getLeagueCentreData } from "@/lib/queries-league-centre"
import { LeagueCentreExperience } from "@/components/league-centre/league-centre-experience"

export const metadata = {
  title: "Match Centre | SAPL",
  description: "Follow the action. Track the standings. View results. See upcoming fixtures.",
}

export default async function LeagueCentrePage() {
  const user = await getCurrentUser()
  const data = await getLeagueCentreData(user)

  return (
    <div style={{ backgroundColor: "rgb(245,248,255)" }} className="min-h-screen">
      {/* Page header */}
      <header style={{ backgroundColor: "rgb(245,248,255)" }} className="border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
                {data.stats.seasonName ?? "SAPL Season"}
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                Match Centre
              </h1>
            </div>
            <dl className="flex items-center gap-5 pb-1 text-sm tabular-nums">
              <HeaderStat label="Teams" value={data.stats.teamCount} />
              <HeaderStat label="Clubs" value={data.stats.clubCount} />
              <HeaderStat label="Played" value={data.stats.matchesPlayed} />
              <HeaderStat label="Remaining" value={data.stats.matchesRemaining} />
            </dl>
          </div>
        </div>
      </header>

      {/* Core league data */}
      <LeagueCentreExperience data={data} />
    </div>
  )
}

function HeaderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <dd className="text-xl font-extrabold text-slate-900">{value}</dd>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
    </div>
  )
}

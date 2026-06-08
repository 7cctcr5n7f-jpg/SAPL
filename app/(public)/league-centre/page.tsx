import { getCurrentUser } from "@/lib/session"
import { getLeagueCentreData } from "@/lib/queries-league-centre"
import { getMainSponsor, getPrizePool } from "@/lib/queries"
import { LeagueCentreExperience } from "@/components/league-centre/league-centre-experience"
import { LiveExperienceShowcase } from "@/components/league-centre/league-centre-experience"
import { PrizeCallout, type PublicSponsor } from "@/components/sponsors/sponsor-elements"

export const metadata = {
  title: "League Centre | SAPL",
  description: "Follow the action. Track the standings. View results. See upcoming fixtures.",
}

export default async function LeagueCentrePage() {
  const user = await getCurrentUser()
  const [data, mainSponsor, prizePool] = await Promise.all([
    getLeagueCentreData(user),
    getMainSponsor(),
    getPrizePool(),
  ])
  const sponsor = mainSponsor as unknown as PublicSponsor | null

  return (
    <div>
      {/* Compact league header — title + live season stat strip. Keeps the
          fold focused on league data instead of a tall marketing hero. */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="heading text-xl md:text-2xl">League Centre</h1>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {data.stats.seasonName ?? "SAPL Season"}
            </span>
          </div>
          <dl className="flex items-center gap-4 text-sm tabular-nums sm:gap-6">
            <HeaderStat label="Teams" value={data.stats.teamCount} />
            <HeaderStat label="Clubs" value={data.stats.clubCount} />
            <HeaderStat label="Played" value={data.stats.matchesPlayed} />
            <HeaderStat label="Left" value={data.stats.matchesRemaining} />
          </dl>
        </div>
      </header>

      {/* 1) Core league data first: standings, fixtures, results, rankings */}
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <LeagueCentreExperience data={data} />
      </div>

      {/* 2) Secondary content: prize pool + promo below the league information */}
      <PrizeCallout prizePool={prizePool} sponsor={sponsor} />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <LiveExperienceShowcase />
      </div>
    </div>
  )
}

function HeaderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="heading text-base text-foreground md:text-lg">{value}</dd>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
    </div>
  )
}

import { getCurrentUser } from "@/lib/session"
import { getLeagueCentreData } from "@/lib/queries-league-centre"
import { getMainSponsor, getPrizePool } from "@/lib/queries"
import { LeagueCentreHero } from "@/components/league-centre/league-centre-hero"
import { LeagueCentreExperience } from "@/components/league-centre/league-centre-experience"
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
      <LeagueCentreHero stats={data.stats} />
      <PrizeCallout prizePool={prizePool} sponsor={sponsor} />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <LeagueCentreExperience data={data} />
      </div>
    </div>
  )
}

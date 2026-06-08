import { getCurrentUser } from "@/lib/session"
import { getLeagueCentreData } from "@/lib/queries-league-centre"
import { LeagueCentreHero } from "@/components/league-centre/league-centre-hero"
import { LeagueCentreExperience } from "@/components/league-centre/league-centre-experience"

export const metadata = {
  title: "League Centre | SAPL",
  description: "Follow the action. Track the standings. View results. See upcoming fixtures.",
}

export default async function LeagueCentrePage() {
  const user = await getCurrentUser()
  const data = await getLeagueCentreData(user)

  return (
    <div>
      <LeagueCentreHero stats={data.stats} />
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <LeagueCentreExperience data={data} />
      </div>
    </div>
  )
}

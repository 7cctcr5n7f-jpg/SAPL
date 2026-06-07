import { PageHeader } from "@/components/dashboard/page-header"
import { ClubsManager } from "@/components/admin/clubs-manager"
import { getClubsWithUsage, getPlayerOptions } from "@/lib/queries-clubs"
import { isSeasonLocked } from "@/lib/season-lock"

export const metadata = { title: "Venue Management | SAPL" }

export default async function AdminClubsPage() {
  const [clubs, players, locked] = await Promise.all([getClubsWithUsage(), getPlayerOptions(), isSeasonLocked()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Management"
        subtitle="Venues, hosting capacity and contacts across the league"
      />

      <ClubsManager clubs={clubs} players={players} locked={locked} />
    </div>
  )
}

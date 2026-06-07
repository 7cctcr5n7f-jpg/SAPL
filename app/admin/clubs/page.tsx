import { PageHeader } from "@/components/dashboard/page-header"
import { ClubsManager } from "@/components/admin/clubs-manager"
import { getClubsWithUsage, getPlayerOptions } from "@/lib/queries-clubs"

export const metadata = { title: "Venue Management | SAPL" }

export default async function AdminClubsPage() {
  const [clubs, players] = await Promise.all([getClubsWithUsage(), getPlayerOptions()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Management"
        subtitle="Venues, hosting capacity and contacts across the league"
      />

      <ClubsManager clubs={clubs} players={players} />
    </div>
  )
}

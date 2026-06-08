import { PageHeader } from "@/components/dashboard/page-header"
import { ClubsManager } from "@/components/admin/clubs-manager"
import { getClubsWithUsage, getPlayerOptions } from "@/lib/queries-clubs"
import { isSeasonLocked } from "@/lib/season-lock"
import { requirePermissionPage } from "@/lib/access"

export const metadata = { title: "Venue Management | SAPL" }

export default async function AdminClubsPage() {
  const access = await requirePermissionPage("club_management")
  // League admins see every club; everyone else is scoped to assigned clubs.
  const restrict = access.isLeagueAdmin ? null : access.clubIds
  const [clubs, players, locked] = await Promise.all([
    getClubsWithUsage(undefined, restrict),
    getPlayerOptions(),
    isSeasonLocked(),
  ])

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

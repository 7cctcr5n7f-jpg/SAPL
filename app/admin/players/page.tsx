import { PageHeader } from "@/components/dashboard/page-header"
import { getManagedPlayers } from "@/lib/queries-dashboard"
import { PlayerManagement } from "@/components/admin/player-management"
import { requirePermissionPage } from "@/lib/access"

export const dynamic = "force-dynamic"
export const metadata = { title: "Player Management | SAPL" }

export default async function AdminPlayersPage() {
  const access = await requirePermissionPage("player_management")

  const players = await getManagedPlayers(access)

  // Only the top admins may permanently delete user accounts.
  const canDelete = access.user.role === "league_admin" || access.user.role === "super_admin"

  const subtitle = access.isLeagueAdmin
    ? "Every registered player with their team, LI and Playtomic rating. Edit LI and rating inline. Use Members & Roles to update personal details."
    : "Players on the teams and clubs assigned to you. Edit LI and Playtomic rating inline."

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Player Management" subtitle={subtitle} />
      <PlayerManagement players={players} canDelete={canDelete} />
    </div>
  )
}

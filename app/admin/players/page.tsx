import { redirect } from "next/navigation"
import { PageHeader } from "@/components/dashboard/page-header"
import { getCurrentUser } from "@/lib/session"
import { getManagedPlayers } from "@/lib/queries-dashboard"
import { PlayerManagement } from "@/components/admin/player-management"

export const dynamic = "force-dynamic"
export const metadata = { title: "Player Management | SAPL" }

export default async function AdminPlayersPage() {
  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  const allowed = ["league_admin", "super_admin", "org_admin", "captain"]
  if (!allowed.includes(me.role)) redirect("/dashboard")

  const players = await getManagedPlayers(me)

  const subtitle =
    me.role === "captain"
      ? "Players on the teams you captain. Edit ratings and Playtomic links inline."
      : me.role === "org_admin"
        ? "Players whose team plays out of your club. Edit ratings and Playtomic links inline."
        : "Every registered player with their team, ratings and Playtomic profile. Edit inline."

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Player Management" subtitle={subtitle} />
      <PlayerManagement players={players} />
    </div>
  )
}

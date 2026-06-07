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
  if (me.role !== "league_admin" && me.role !== "super_admin") redirect("/dashboard")

  const players = await getManagedPlayers()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Player Management"
        subtitle="Every registered player with their team, ratings and Playtomic profile. Edit ratings inline."
      />
      <PlayerManagement players={players} />
    </div>
  )
}

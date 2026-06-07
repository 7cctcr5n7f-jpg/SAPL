import { PageHeader } from "@/components/dashboard/page-header"
import { Stat } from "@/components/brand/bits"
import { ClubsManager } from "@/components/admin/clubs-manager"
import { getClubsWithUsage, getPlayerOptions } from "@/lib/queries-clubs"

export const metadata = { title: "Venue Management | SAPL" }

export default async function AdminClubsPage() {
  const [clubs, players] = await Promise.all([getClubsWithUsage(), getPlayerOptions()])

  const totalCapacity = clubs.reduce((s, c) => s + c.hostingCapacity, 0)
  const totalUsed = clubs.reduce((s, c) => s + c.used, 0)
  const thursdayHosts = clubs.filter((c) => c.hostsThursday).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Management"
        subtitle="Venues, hosting capacity and contacts across the league"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Venues" value={clubs.length} />
        <Stat label="Hosting Capacity" value={totalCapacity} sub={`${totalUsed} in use`} />
        <Stat label="Remaining Slots" value={Math.max(0, totalCapacity - totalUsed)} />
        <Stat label="Thursday Hosts" value={thursdayHosts} />
      </div>

      <ClubsManager clubs={clubs} players={players} />
    </div>
  )
}

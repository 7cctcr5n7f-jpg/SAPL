import { redirect } from "next/navigation"
import { getDashboardFixtures } from "@/lib/queries-fixtures"
import { PageHeader } from "@/components/dashboard/page-header"
import { OpsConsole } from "@/components/fixtures/ops-console"
import { requirePermissionPage } from "@/lib/access"

export const metadata = { title: "Fixtures Console | SAPL" }

export default async function DashboardFixturesPage() {
  const access = await requirePermissionPage("fixture_management")
  const user = access.user

  // Admin-only operations console. Captains/players use League Centre instead.
  const isClubManager = access.can("club_management") && access.clubIds.length > 0
  if (!access.isLeagueAdmin && !isClubManager) redirect("/league-centre")

  const data = await getDashboardFixtures(user)

  const subtitle =
    data.scope === "all"
      ? "Schedule, book and publish every match night"
      : "Manage booking details for fixtures at your club"

  return (
    <div>
      <PageHeader title="Fixtures Console" subtitle={data.seasonName ? `${data.seasonName} · ${subtitle}` : subtitle} />
      <OpsConsole
        seasonName={data.seasonName}
        canManageVenue={data.canManageVenue}
        fixtures={data.fixtures}
        clubs={data.clubs}
        health={data.health}
      />
    </div>
  )
}

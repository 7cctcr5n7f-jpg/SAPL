import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getDashboardFixtures } from "@/lib/queries-fixtures"
import { PageHeader } from "@/components/dashboard/page-header"
import { FixturesDashboard } from "@/components/fixtures/fixtures-dashboard"

export const metadata = { title: "Fixtures | SAPL" }

export default async function DashboardFixturesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const data = await getDashboardFixtures(user)

  const subtitle =
    data.scope === "all"
      ? "Manage every fixture, venue and booking link"
      : data.scope === "club"
        ? "Fixtures at your club and for your teams"
        : "Your team's upcoming match nights"

  return (
    <div>
      <PageHeader title="Fixtures" subtitle={data.seasonName ? `${data.seasonName} · ${subtitle}` : subtitle} />
      <FixturesDashboard
        scope={data.scope}
        seasonName={data.seasonName}
        canManageVenue={data.canManageVenue}
        fixtures={data.fixtures}
        clubs={data.clubs}
      />
    </div>
  )
}

import { requirePermissionPage } from "@/lib/access"
import { getAdminSummary, getSeasonsWithDivisions, getRegions } from "@/lib/queries-admin"
import { getCurrentSeason } from "@/lib/queries"
import { getSeasonReadiness } from "@/lib/team-readiness"
import { PageHeader } from "@/components/dashboard/page-header"
import { Stat } from "@/components/brand/bits"
import { ControlPanel } from "@/components/admin/control-panel"
import { SeasonReadinessSummary } from "@/components/admin/season-readiness-summary"
import { AdminTabs } from "@/components/admin/admin-tabs"

export const metadata = { title: "Seasons | SAPL" }

export default async function AdminSeasonsPage() {
  await requirePermissionPage("league_management")

  const [summary, seasons, regions, currentSeason] = await Promise.all([
    getAdminSummary(),
    getSeasonsWithDivisions(),
    getRegions(),
    getCurrentSeason(),
  ])
  const readiness = currentSeason ? await getSeasonReadiness(currentSeason.id) : null

  return (
    <div className="space-y-6">
      <PageHeader title="League Management" subtitle="Operate the South African Padel League" />

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Registered Teams" value={summary.teamCount} />
        <Stat label="Total Fixtures" value={summary.fixtureCount} />
      </div>

      {readiness && readiness.totalTeams > 0 && <SeasonReadinessSummary readiness={readiness} />}

      <AdminTabs />

      <ControlPanel
        seasons={seasons.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          isCurrent: s.isCurrent,
          weeks: s.weeks,
          regions: regions.map((r) => ({ id: r.id, name: r.name })),
          divisions: s.divisions.map((d) => ({
            id: d.id,
            name: d.name,
            level: d.level,
            maxTeams: d.maxTeams,
            regionId: d.regionId,
          })),
        }))}
      />
    </div>
  )
}

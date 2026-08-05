import { requirePermissionPage } from "@/lib/access"
import { getAdminSummary, getSeasonsWithDivisions, getRegions, getSeasonFixturePlanning } from "@/lib/queries-admin"
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
  const planningBySeason = new Map<number, Awaited<ReturnType<typeof getSeasonFixturePlanning>>>()
  for (const season of seasons) {
    planningBySeason.set(season.id, await getSeasonFixturePlanning(season.id))
  }

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
          startDate: s.startDate ?? null,
          regions: s.divisions
            .filter((d) => d.regionId != null && d.regionName)
            .reduce<Array<{ id: number; name: string }>>((acc, d) => {
              if (acc.some((r) => r.id === d.regionId)) return acc
              acc.push({ id: d.regionId as number, name: d.regionName as string })
              return acc
            }, []),
          divisions: s.divisions.map((d) => ({
            id: d.id,
            name: d.name,
            level: d.level,
            maxTeams: d.maxTeams,
            regionId: d.regionId,
          })),
        }))}
        planningBySeason={Object.fromEntries(
          [...planningBySeason.entries()].map(([seasonId, planning]) => [seasonId, planning]),
        )}
        defaultRegionNames={regions.map((r) => r.name)}
        currentSeasonReadiness={
          currentSeason && readiness
            ? {
                seasonId: currentSeason.id,
                incompleteTeams: readiness.teams.filter((team) => !team.isLeagueReady).length,
                playersOutstanding: readiness.playersOutstanding,
              }
            : null
        }
      />
    </div>
  )
}

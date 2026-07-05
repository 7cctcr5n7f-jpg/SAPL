import { requirePermissionPage } from "@/lib/access"
import { getAdminSummary, getSeasonsWithDivisions, getRegions } from "@/lib/queries-admin"
import { getCurrentSeason } from "@/lib/queries"
import { getSeasonReadiness } from "@/lib/team-readiness"
import { getPlacementBoard } from "@/lib/queries-placement"
import { db } from "@/lib/db"
import { seasons as seasonsTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { Stat } from "@/components/brand/bits"
import { SeasonReadinessSummary } from "@/components/admin/season-readiness-summary"
import { PlacementBoard } from "@/components/admin/placement/placement-board"
import { SeasonSwitcher } from "@/components/admin/placement/season-switcher"
import { AdminTabs } from "@/components/admin/admin-tabs"

export const metadata = { title: "Division Assignment | SAPL" }

export default async function AdminPlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requirePermissionPage("league_management")
  const sp = await searchParams

  const [summary, currentSeason, allSeasons] = await Promise.all([
    getAdminSummary(),
    getCurrentSeason(),
    db
      .select({ id: seasonsTable.id, name: seasonsTable.name, isCurrent: seasonsTable.isCurrent })
      .from(seasonsTable)
      .orderBy(desc(seasonsTable.isCurrent), desc(seasonsTable.id)),
  ])
  const readiness = currentSeason ? await getSeasonReadiness(currentSeason.id) : null

  const requested = sp.season ? Number(sp.season) : null
  const seasonId = requested ?? allSeasons.find((s) => s.isCurrent)?.id ?? allSeasons[0]?.id ?? null
  const board = seasonId ? await getPlacementBoard(seasonId) : null

  return (
    <div className="space-y-6">
      <PageHeader title="League Management" subtitle="Operate the South African Padel League" />

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Registered Teams" value={summary.teamCount} />
        <Stat label="Total Fixtures" value={summary.fixtureCount} />
      </div>

      {readiness && readiness.totalTeams > 0 && <SeasonReadinessSummary readiness={readiness} />}

      <AdminTabs />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Seed teams into divisions before the season starts. Drag to place; changes save automatically.
          </p>
          <SeasonSwitcher seasons={allSeasons} current={seasonId} />
        </div>

        {!board || board.divisions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <p className="text-lg font-semibold">No divisions for this season</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create divisions in Season Setup, then return here to seed teams.
            </p>
          </div>
        ) : (
          <PlacementBoard
            seasonId={board.seasonId}
            seasonName={board.seasonName}
            divisions={board.divisions}
            teams={board.teams}
          />
        )}
      </div>
    </div>
  )
}

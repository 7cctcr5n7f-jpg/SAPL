import Link from "next/link"
import { getAdminSummary, getSeasonsWithDivisions, getRegions } from "@/lib/queries-admin"
import { getPlacementBoard } from "@/lib/queries-placement"
import { db } from "@/lib/db"
import { seasons as seasonsTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { Stat } from "@/components/brand/bits"
import { ControlPanel } from "@/components/admin/control-panel"
import { PlacementBoard } from "@/components/admin/placement/placement-board"
import { SeasonSwitcher } from "@/components/admin/placement/season-switcher"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "seasons", label: "Seasons" },
  { id: "placement", label: "Placement" },
] as const

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; season?: string }>
}) {
  const sp = await searchParams
  const activeTab = sp.tab === "placement" ? "placement" : "seasons"

  const [summary, seasons, regions] = await Promise.all([
    getAdminSummary(),
    getSeasonsWithDivisions(),
    getRegions(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="League Control" subtitle="Operate the South African Padel League" />

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Registered Teams" value={summary.teamCount} />
        <Stat label="Total Fixtures" value={summary.fixtureCount} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = activeTab === t.id
          return (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {activeTab === "seasons" ? (
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
      ) : (
        <PlacementTab seasonParam={sp.season} />
      )}
    </div>
  )
}

async function PlacementTab({ seasonParam }: { seasonParam?: string }) {
  const allSeasons = await db
    .select({ id: seasonsTable.id, name: seasonsTable.name, isCurrent: seasonsTable.isCurrent })
    .from(seasonsTable)
    .orderBy(desc(seasonsTable.isCurrent), desc(seasonsTable.id))

  const requested = seasonParam ? Number(seasonParam) : null
  const seasonId = requested ?? allSeasons.find((s) => s.isCurrent)?.id ?? allSeasons[0]?.id ?? null
  const board = seasonId ? await getPlacementBoard(seasonId) : null

  return (
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
            Create divisions for this season in the Seasons tab, then return to seed teams.
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
  )
}

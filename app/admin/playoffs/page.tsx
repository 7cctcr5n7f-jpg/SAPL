import { requirePermissionPage } from "@/lib/access"
import { getAdminSummary, getPlayoffs, getPlayoffVenues } from "@/lib/queries-admin"
import { getCurrentSeason } from "@/lib/queries"
import { getSeasonReadiness } from "@/lib/team-readiness"
import { db } from "@/lib/db"
import { seasons as seasonsTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { Stat } from "@/components/brand/bits"
import { SeasonReadinessSummary } from "@/components/admin/season-readiness-summary"
import { PlayoffsManager } from "@/components/admin/playoffs-manager"
import { AdminTabs } from "@/components/admin/admin-tabs"

export const metadata = { title: "Playoffs | SAPL" }

export default async function AdminPlayoffsPage() {
  await requirePermissionPage("league_management")

  const [summary, currentSeason, allSeasons] = await Promise.all([
    getAdminSummary(),
    getCurrentSeason(),
    db.select().from(seasonsTable).orderBy(desc(seasonsTable.isCurrent), desc(seasonsTable.id)),
  ])
  const readiness = currentSeason ? await getSeasonReadiness(currentSeason.id) : null
  const season = allSeasons[0] ?? null

  const [playoffs, venues] = await Promise.all([
    season ? getPlayoffs(season.id) : Promise.resolve([]),
    getPlayoffVenues(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="League Management" subtitle="Operate the South African Padel League" />

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Registered Teams" value={summary.teamCount} />
        <Stat label="Total Fixtures" value={summary.fixtureCount} />
      </div>

      {readiness && readiness.totalTeams > 0 && <SeasonReadinessSummary readiness={readiness} />}

      <AdminTabs />

      {!season ? (
        <p className="text-sm text-muted-foreground">Create a season first to manage playoffs.</p>
      ) : (
        <PlayoffsManager
          seasonId={season.id}
          seasonName={season.name}
          venues={venues.map((v) => ({ id: v.id, name: v.name, courts: v.courts }))}
          playoffs={playoffs.map((p) => ({
            id: p.id,
            type: p.type,
            round: p.round,
            divisionId: p.divisionId,
            homeName: p.homeName,
            awayName: p.awayName,
            homeResolved: p.homeResolved,
            awayResolved: p.awayResolved,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            status: p.status,
            bracketPosition: p.bracketPosition,
            matchDate: p.matchDate ? new Date(p.matchDate).toISOString() : null,
            timeslot: p.timeslot,
            venueClubId: p.venueClubId,
            venue: p.venue,
          }))}
        />
      )}
    </div>
  )
}

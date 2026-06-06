import { getPlayoffs, getPlayoffVenues } from "@/lib/queries-admin"
import { db } from "@/lib/db"
import { seasons } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { PlayoffsManager } from "@/components/admin/playoffs-manager"

export default async function AdminPlayoffsPage() {
  // Operate on the current season (fall back to newest) so brackets, pull and
  // scheduling all target one season.
  const allSeasons = await db.select().from(seasons).orderBy(desc(seasons.isCurrent), desc(seasons.id))
  const season = allSeasons[0] ?? null

  const [playoffs, venues] = await Promise.all([
    season ? getPlayoffs(season.id) : Promise.resolve([]),
    getPlayoffVenues(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Playoffs" subtitle="Schedule regional finals and the Tshwane Masters" />
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

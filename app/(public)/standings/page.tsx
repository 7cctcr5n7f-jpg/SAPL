import { getCurrentSeason, getDivisionsWithRegion, getStandingsForDivision } from "@/lib/queries"
import { StandingsView } from "@/components/standings/standings-view"

export const metadata = { title: "Standings | SAPL" }

export default async function StandingsPage() {
  const season = await getCurrentSeason()
  if (!season) return <EmptyState />

  const divisions = await getDivisionsWithRegion(season.id)
  const entries = await Promise.all(
    divisions.map(async (d) => [d.id, await getStandingsForDivision(d.id)] as const),
  )
  const standingsByDivision = Object.fromEntries(entries)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <div className="border-l-4 border-primary pl-4">
        <h1 className="heading text-4xl md:text-5xl">Standings</h1>
        <p className="mt-2 text-muted-foreground">
          {season.name} &middot; Divisions by region &middot; Switch region and division below
        </p>
      </div>
      <div className="mt-8">
        <StandingsView divisions={divisions} standingsByDivision={standingsByDivision} />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24 text-center md:px-6">
      <h1 className="heading text-3xl">No active season</h1>
      <p className="mt-2 text-muted-foreground">Standings will appear once a season is underway.</p>
    </div>
  )
}

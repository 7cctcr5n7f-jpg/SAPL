import { SectionTitle } from "@/components/brand/bits"
import { FixturesView } from "@/components/fixtures/fixtures-view"
import { getCurrentSeason, getFixtures } from "@/lib/queries"

export const metadata = { title: "Fixtures | SAPL" }

export default async function FixturesPage() {
  const season = await getCurrentSeason()
  const fixtures = season ? await getFixtures({ seasonId: season.id }) : []
  const weeks = Array.from(new Set(fixtures.map((f) => f.week))).sort((a, b) => a - b)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <SectionTitle eyebrow={season?.name ?? "Season"} title="Match Nights" />
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every fixture across all divisions. Feature-court clashes decide the title race on the road to the Tshwane
        Masters.
      </p>
      <div className="mt-8">
        {weeks.length ? (
          <FixturesView fixtures={fixtures} weeks={weeks} />
        ) : (
          <p className="text-muted-foreground">Fixtures will be published once the season schedule is generated.</p>
        )}
      </div>
    </div>
  )
}

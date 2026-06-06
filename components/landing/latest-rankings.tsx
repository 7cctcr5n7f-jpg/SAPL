import Link from "next/link"
import { SectionTitle, DivisionTag } from "@/components/brand/bits"
import { Button } from "@/components/ui/button"
import { Trophy, Building2 } from "lucide-react"

type TeamRow = {
  teamId: number
  teamName: string
  orgName: string | null
  divisionName: string | null
  tpr: number
}
type ClubRow = {
  id: number
  name: string
  slug: string | null
  cpi: number
  teamCount: number
}

export function LatestRankings({ teams, clubs }: { teams: TeamRow[]; clubs: ClubRow[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
      <div className="flex items-end justify-between gap-4">
        <SectionTitle eyebrow="Rankings & Ratings" title="Track Your Rise" />
        <Button render={<Link href="/rankings" />} variant="outline" size="sm">
          View Full Rankings
        </Button>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="heading text-lg">Top Teams</h3>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {teams.map((t, i) => (
              <li key={t.teamId} className="flex items-center gap-4 py-3">
                <span className="heading w-7 text-xl text-primary tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/teams/${t.teamId}`} className="block truncate font-semibold hover:text-primary">
                    {t.teamName}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{t.orgName}</span>
                    {t.divisionName ? <DivisionTag name={t.divisionName} /> : null}
                  </div>
                </div>
                <span className="heading text-lg tabular-nums">{Math.round(t.tpr)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="heading text-lg">Top Clubs</h3>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {clubs.map((c, i) => (
              <li key={c.id} className="flex items-center gap-4 py-3">
                <span className="heading w-7 text-xl text-primary tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/clubs/${c.slug}`} className="block truncate font-semibold hover:text-primary">
                    {c.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{c.teamCount} teams</span>
                </div>
                <span className="heading text-lg tabular-nums">{Math.round(c.cpi)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

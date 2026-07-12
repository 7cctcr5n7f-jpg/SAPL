import { SectionTitle, DivisionTag } from "@/components/brand/bits"
import { CATEGORY_RULES, DIVISIONS, LEAGUE_SCORING, TEAMS_PER_DIVISION, REGULAR_SEASON_WEEKS } from "@/lib/constants"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Rules & Format | SAPL" }

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="heading text-2xl">{title}</h2>
      <div className="mt-4 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <SectionTitle eyebrow="How It Works" title="League Rules & Format" />
      <p className="mt-3 text-muted-foreground">
        The South African Padel League is a structured, promotion-and-relegation competition built around fair play and
        anti-sandbagging through the League Index (LI) system.
      </p>

      <Block title="Divisions">
        <p>
          Teams compete across {DIVISIONS.length} divisions of {TEAMS_PER_DIVISION} teams each. Win your division to
          earn promotion; finish at the bottom and face relegation play-offs against the division below.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DIVISIONS.map((d) => (
            <DivisionTag key={d.name} name={d.name} />
          ))}
        </div>
      </Block>

      <Block title="Match Format & Scoring">
        <p>
          Each fixture is a multi-category match night. Teams earn {LEAGUE_SCORING.pointPerSet} point per set won, plus
          a {LEAGUE_SCORING.bonusForWinner}-point bonus for the overall fixture winner. The {REGULAR_SEASON_WEEKS}-week
          regular season is followed by play-offs.
        </p>
        <p className="mt-3">Standings are ranked by, in order:</p>
        <ol className="mt-2 list-decimal pl-5">
          <li>League Points</li>
          <li>Match Wins</li>
          <li>Sets Won</li>
          <li>Head-to-Head</li>
          <li>Points Difference</li>
        </ol>
      </Block>

      <Block title="Pairings & Eligibility (League Index)">
        <p className="mb-4">
          Each team fields four pairings — three mens tiers split by the pair&apos;s average League Index, plus one open
          ladies pairing. A player&apos;s LI reflects their highest Playtomic rating over the last six months, keeping
          line-ups honest.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pairing</TableHead>
              <TableHead>Session</TableHead>
              <TableHead className="text-right">Pair Average LI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CATEGORY_RULES.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium">
                  {c.name}
                  {c.isFeatureCourt ? <span className="ml-2 text-xs text-primary">Feature</span> : null}
                </TableCell>
                <TableCell>{c.session}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.name === "Ladies Open"
                    ? "Any"
                    : c.name === "Mens Open"
                      ? "Over 3.5"
                      : `Up to ${c.avgTeamMaxLi.toFixed(1)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Block>

      <Block title="Team Power Rating (TPR)">
        <p>
          Every team carries an ELO-style Team Power Rating starting at 1000. Results adjust TPR based on opponent
          strength, margin of victory, division strength and play-off weighting. Club Performance Index (CPI) averages
          a club/group&apos;s best two teams to crown the SAPL Club of the Year.
        </p>
      </Block>

      <Block title="The Road to the Tshwane Masters">
        <p>
          Division champions and play-off winners progress through regional finals to the season-ending Tshwane
          Masters — the pinnacle of the competition.
        </p>
      </Block>
    </div>
  )
}

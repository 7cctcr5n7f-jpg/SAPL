import { SectionTitle } from "@/components/brand/bits"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata = { title: "Rulebook | SAPL" }

type RuleItem = { number: string; title: string; points: string[] }
type RuleTab = { value: string; label: string; items: RuleItem[] }

const RULE_TABS: RuleTab[] = [
  {
    value: "foundation",
    label: "Foundation",
    items: [
      {
        number: "1",
        title: "Purpose and principles",
        points: [
          "SAPL is a self-officiated team competition focused on fair, practical, competitive play.",
          "Players must make honest calls, keep score accurately, respect opponents and avoid delays.",
          "If unresolved, captains decide; if still unresolved on a point, replay from last agreed score.",
        ],
      },
      {
        number: "22",
        title: "FIP rules apply by default",
        points: [
          "FIP technical padel rules apply unless SAPL explicitly overrides them.",
          "This covers core playing mechanics like net/glass/fence play, lets and service faults.",
        ],
      },
      {
        number: "43",
        title: "SAPL overrides where specified",
        points: [
          "SAPL-specific rules take precedence for league play (scoring system, change of ends, substitutions, late arrivals, etc.).",
        ],
      },
      {
        number: "45–46",
        title: "Core standard and version control",
        points: [
          "Play the point, respect the call, keep the match moving.",
          "Published SAPL rulebook updates control from their effective date.",
        ],
      },
    ],
  },
  {
    value: "format-scoring",
    label: "Match Format & Scoring",
    items: [
      {
        number: "2–4",
        title: "Fixture structure",
        points: [
          "Every fixture is four doubles matches: Men's Beginner, Intermediate, Advanced, and Ladies Open.",
          "All four must be played; each contributes to team points.",
          "Each category match is best-of-three full sets.",
        ],
      },
      {
        number: "3",
        title: "League points",
        points: [
          "1 point per set won, plus 1 bonus point for winning the doubles match.",
          "Max 4 points per category match and 16 points per full fixture.",
        ],
      },
      {
        number: "5–7",
        title: "Set, tiebreak and ends",
        points: [
          "Sets are first to 6 by 2 games; at 6–6, play a standard 7-point tiebreak (win by 2).",
          "Players change ends every 4 completed games in normal play.",
          "During tiebreaks, ends change every 6 points.",
        ],
      },
      {
        number: "8–10",
        title: "Serve and game scoring",
        points: [
          "Serve at or below waist height; two-serve system applies.",
          "Wrong-server corrections follow SAPL finality rules once next point starts.",
          "Deuce format: Silver Point (advantage point), then Golden Point if advantage is lost.",
        ],
      },
    ],
  },
  {
    value: "timing",
    label: "Timing & Match Flow",
    items: [
      {
        number: "11–13",
        title: "Time limits",
        points: [
          "Max 20 seconds between points.",
          "Max 90 seconds on changeovers.",
          "Max 120 seconds between sets.",
        ],
      },
      {
        number: "14–16",
        title: "Coaching, bathroom and medical",
        points: [
          "Coaching allowed only during changeovers and set breaks.",
          "One bathroom break per player, after a set, max 5 minutes.",
          "One medical timeout up to 10 minutes; inability to continue triggers forfeit of remaining games.",
        ],
      },
      {
        number: "17",
        title: "Time wasting penalties",
        points: [
          "Escalation: warning → point penalty → game penalty → match forfeiture.",
        ],
      },
      {
        number: "26, 28, 34",
        title: "Late starts, court expiry and phone use",
        points: [
          "Official start is booking time plus max 5-minute warm-up; late penalties escalate by games.",
          "If court time expires, current score is recorded.",
          "Phones must stay silent and unused during play except emergencies.",
        ],
      },
    ],
  },
  {
    value: "disputes",
    label: "Disputes & Fair Play",
    items: [
      {
        number: "18–21",
        title: "Line calls, score disputes and interference",
        points: [
          "Side where ball lands makes the call; ball touching line is in.",
          "Disputed score/point returns to last mutually agreed score and replays disputed point.",
          "Material interference ball from another court during rally means replay.",
        ],
      },
      {
        number: "38–39",
        title: "Finality and unresolved situations",
        points: [
          "Once next point begins, previous point is final.",
          "If no SAPL-specific rule exists, apply FIP; otherwise captains resolve with replay protocol if needed.",
        ],
      },
      {
        number: "41–42",
        title: "Sportsmanship and SAPL authority",
        points: [
          "Competitive intensity is welcome; unsportsmanlike conduct is not.",
          "SAPL may investigate and apply sanctions to protect league integrity.",
        ],
      },
    ],
  },
  {
    value: "eligibility",
    label: "Eligibility & Fixtures",
    items: [
      {
        number: "23–24",
        title: "Rescheduling and substitutions",
        points: [
          "To reschedule a specific match, you must first get agreement from the opposing players/captain on the new date and time.",
          "If both teams agree, the rescheduled match must be completed before the next fixture starts.",
          "If the opposing team cannot move date/time, the original fixture stands and you must use an eligible substitute where needed.",
          "Substitutes must be eligible and may play up categories, not down.",
          "Substitute rating must be equal or lower than replaced player under category rules.",
        ],
      },
      {
        number: "25",
        title: "Substitute rating penalty",
        points: [
          "1 game penalty per 0.1 rating above allowed limit, per set.",
        ],
      },
      {
        number: "27, 29–31",
        title: "Walkovers, balls, weather and interruptions",
        points: [
          "Walkover score is 6-0, 6-0, 6-0.",
          "Home team supplies official SAPL match balls.",
          "Unsafe conditions can suspend play; venue safety decisions are final.",
          "Interrupted matches should resume from exact prior state where practical.",
        ],
      },
    ],
  },
  {
    value: "captains",
    label: "Captains & Discipline",
    items: [
      {
        number: "32–33",
        title: "Conduct and penalties",
        points: [
          "Abuse, threats, intimidation, deliberate dangerous acts and hate speech are prohibited.",
          "Escalation: warning → point penalty → game penalty → match forfeiture.",
          "Serious misconduct may be escalated immediately to stronger sanctions.",
        ],
      },
      {
        number: "35–37",
        title: "Captain duties and reporting",
        points: [
          "Captains manage lineup legality, dispute handling, result confirmation and submission.",
          "Result disputes must be lodged within 24 hours with specific rule/evidence details.",
        ],
      },
      {
        number: "40",
        title: "Player responsibility",
        points: [
          "All players are deemed to accept SAPL rules, FIP applicability and SAPL disciplinary authority.",
        ],
      },
      {
        number: "44",
        title: "Quick match reference",
        points: [
          "Before-match checks, time limits, deuce sequence, dispute flow and late-arrival penalties are standardized and must be followed.",
        ],
      },
    ],
  },
]

function RuleCard({ item }: { item: RuleItem }) {
  return (
    <section className="rounded-xl border border-border bg-card/70 p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Rule {item.number}</p>
      <h3 className="mt-1 text-lg font-bold">{item.title}</h3>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
        {item.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  )
}

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <SectionTitle eyebrow="SAPL 2026 Rulebook" title="Rulebook" />
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Official SAPL rules are grouped into practical tabs for quick match-day use. These league rules apply across all
        fixtures and override FIP only where explicitly stated.
      </p>

      <Tabs defaultValue="foundation" className="mt-8">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/30 p-1">
          {RULE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg px-3 py-2 text-xs md:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {RULE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4 space-y-3">
            {tab.items.map((item) => (
              <RuleCard key={`${tab.value}-${item.number}`} item={item} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

import { SectionTitle } from "@/components/brand/bits"

export const metadata = { title: "FAQ | SAPL", description: "Frequently asked questions about the South African Padel League." }

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I join the league?",
    a: "Tap Join League to create an account, then ask your club captain to add you to a team roster. Once you're on a roster you'll appear in fixtures and your stats start tracking automatically.",
  },
  {
    q: "What is the League Index (LI)?",
    a: "Your League Index reflects your highest Playtomic rating over the last six months. It determines which pairing tier you can play in, keeping line-ups fair and preventing sandbagging.",
  },
  {
    q: "How are standings decided?",
    a: "Teams are ranked by League Points, then Match Wins, Sets Won, Head-to-Head, and finally Points Difference. You earn one point per set won plus a bonus for winning the overall fixture.",
  },
  {
    q: "What is Team Power Rating (TPR)?",
    a: "Every team carries an ELO-style rating starting at 1000. Results adjust it based on opponent strength, margin of victory, division strength and play-off weighting.",
  },
  {
    q: "How does promotion and relegation work?",
    a: "Win your division to earn promotion. Finish at the bottom and you'll face relegation play-offs against the division below. Division champions progress toward the season-ending Tshwane Masters.",
  },
  {
    q: "Where can I see my upcoming matches?",
    a: "Open the League Centre to see standings, fixtures and results for any division. When you're signed in, your own upcoming matches appear at the top.",
  },
  {
    q: "What is the Marketplace?",
    a: "The Marketplace is where clubs and partners list gear, court time and services for the SAPL community. Browse it any time from the bottom navigation.",
  },
  {
    q: "How do I become a sponsor?",
    a: "Visit the Sponsors page to see current partners and partnership tiers, then reach out through the contact details listed there.",
  },
]

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <SectionTitle eyebrow="Help & Support" title="Frequently Asked Questions" />
      <p className="mt-3 text-muted-foreground">
        Everything you need to know about playing in, following and partnering with the South African Padel League.
      </p>

      <div className="mt-8 divide-y divide-border border-t border-border">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <h2 className="heading text-base md:text-lg">{item.q}</h2>
              <span className="shrink-0 text-2xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

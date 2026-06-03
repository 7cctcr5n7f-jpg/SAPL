import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { ChowWinners } from '@/components/chow-winners'
import { SessionMilestone } from '@/components/session-milestone'
import { CtaBanner } from '@/components/cta-banner'
import {
  getActiveChowWinners,
  getActiveSessionMilestones,
  getSetting,
} from '@/lib/content-queries'

export const metadata: Metadata = {
  title: 'Members',
  description:
    'The TENROUNDS members hub — celebrate our weekly CHOW winners and track the live global member rankings powered by Uptivo.',
}

const RANKINGS_URL =
  'https://global-rankings.uptivo.fit/?rankingsCode=CRMRN9NP&brand=false&max=100'

export default async function MembersPage() {
  const [winners, milestones, chowChallenge] = await Promise.all([
    getActiveChowWinners(),
    getActiveSessionMilestones(),
    getSetting('chow_challenge'),
  ])
  return (
    <main>
      {/* session milestone celebration — managed from /admin */}
      <SessionMilestone milestones={milestones} />

      {/* CHOW winners — managed from /admin */}
      <ChowWinners winners={winners} challenge={chowChallenge} />

      {/* live member rankings */}
      <section className="bg-charcoal py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Live Leaderboard"
            title="Global Member Rankings"
            description="See where you stack up. Our live Uptivo rankings update as members train and earn effort points round after round."
            className="mx-auto"
          />

          <div className="mt-12 overflow-hidden rounded-2xl border border-steel bg-background">
            <iframe
              src={RANKINGS_URL}
              title="TENROUNDS live global member rankings"
              className="h-[820px] w-full"
              frameBorder="0"
              loading="lazy"
            />
          </div>

          <div className="mt-8 text-center">
            <a
              href={RANKINGS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-cobalt px-7 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
            >
              Open Full Rankings
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <CtaBanner />
    </main>
  )
}

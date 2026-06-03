import type { Metadata } from 'next'
import { Compass, HeartHandshake, TrendingUp } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { CoachesGrid } from '@/components/coaches-grid'
import { CtaBanner } from '@/components/cta-banner'

export const metadata: Metadata = {
  title: 'Meet The Team',
  description:
    'Meet the TENROUNDS coaching team — qualified trainers providing guidance, motivation and support on the floor every round in Pretoria East.',
  alternates: { canonical: '/meet-the-team' },
}

const onFloor = [
  {
    icon: Compass,
    title: 'Clear Guidance',
    desc: 'You’ll always know what to do and how to do it — every round, every movement.',
  },
  {
    icon: HeartHandshake,
    title: 'Approachable Support',
    desc: 'Trainers are present, attentive and encouraging from your first round to your last.',
  },
  {
    icon: TrendingUp,
    title: 'Consistency Over Hype',
    desc: 'The focus is long-term progress, not pushing for show. Real training, real results.',
  },
]

export default function MeetTheTeamPage() {
  return (
    <main>
      <PageHero
        eyebrow="Meet The Team"
        title="The Trainers Behind Your Progress"
        description="Guidance, motivation and support on the floor every round."
        image="/team-hero.webp"
        imageAlt="A TENROUNDS coach supporting a member through a kettlebell squat"
      />

      {/* coach roster */}
      <CoachesGrid
        background="background"
        eyebrow="Your Coaches"
        title="Real Coaches In Your Corner"
        description="Five qualified trainers, each with a specialty — together covering everything from boxing to mobility."
      />

      {/* what trainers do */}
      <section className="bg-charcoal py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="On The Floor"
            title="What Trainers Do During Your Workout"
            description="No empty hype. Just present, knowledgeable coaches focused on your form and your progress."
            className="mx-auto"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {onFloor.map((item, i) => (
              <Reveal key={item.title} delay={i * 100}>
                <div className="group h-full rounded-2xl border border-steel bg-background p-8 transition-all hover:border-neon-blue/50 hover:blue-glow">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue transition-colors group-hover:bg-cobalt group-hover:text-accent-foreground">
                    <item.icon className="size-6" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold uppercase tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-light-grey">
                    {item.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        headline="Real Trainers. Real Guidance."
        subheadline="Show up and start round one. Your coaches will handle the rest."
        buttonLabel="Claim Your Free Trial"
        href="/free-trial"
      />
    </main>
  )
}

import type { Metadata } from 'next'
import Image from 'next/image'
import { Target, Eye, Zap, Clock, Users, TrendingUp } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { Counter } from '@/components/counter'
import { CoachesGrid } from '@/components/coaches-grid'
import { CtaBanner } from '@/components/cta-banner'

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'The TENROUNDS story — a boutique HIIT gym in Pretoria built for busy people who want real results through coach-supported 30-minute workouts.',
  alternates: { canonical: '/about' },
}

const pillars = [
  {
    icon: Target,
    title: 'Our Mission',
    desc: 'To make effective, results-driven training accessible to busy people by removing every barrier between them and a great workout.',
  },
  {
    icon: Eye,
    title: 'Our Vision',
    desc: 'A community where fitness is sustainable, supported and built into life — not squeezed around it.',
  },
  {
    icon: Zap,
    title: 'Our Approach',
    desc: 'Intelligent programming, real coaching and 30-minute efficiency. Every minute earns its place.',
  },
]

const philosophy = [
  { icon: Clock, title: 'Efficiency Over Excess', desc: 'Thirty focused minutes beat ninety unfocused ones. We engineer intensity, not duration.' },
  { icon: Users, title: 'Coaching Is Non-Negotiable', desc: 'A real coach in every session means better form, smarter progression and zero guesswork.' },
  { icon: TrendingUp, title: 'Progress You Can Measure', desc: 'We track the numbers so motivation comes from proof, not hope.' },
]

export default function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow="About Us"
        title="Built For People Who Refuse To Wait"
        description="TENROUNDS was created for a simple reason — life is busy, but your fitness should not suffer for it."
        image="/coach-support.png"
        imageAlt="Coach supporting a member at TENROUNDS"
      />

      {/* story */}
      <section className="bg-background py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
          <Reveal className="relative overflow-hidden rounded-2xl border border-steel">
            <Image
              src="/functional-zone.png"
              alt="TENROUNDS functional training zone"
              width={800}
              height={700}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
          </Reveal>
          <div>
            <SectionHeading eyebrow="Our Story" title="The TENROUNDS Story" />
            <div className="mt-6 space-y-4 text-pretty leading-relaxed text-light-grey">
              <p>
                TENROUNDS started with a frustration shared by thousands of
                professionals in Pretoria: traditional gyms demand too much time,
                rigid class schedules, and offer too little support.
              </p>
              <p>
                So we built something different. A premium boutique facility where
                every workout is 30 minutes, every session is coach-supported, and
                there are no class times to plan your life around. Strength,
                cardio and functional fitness — combined into one efficient,
                high-energy experience.
              </p>
              <p>
                The result is a smarter way to train that real people can actually
                stick to. And that consistency is exactly what delivers results.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* mission / vision / approach */}
      <section className="bg-charcoal py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-steel bg-background p-8">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue">
                    <p.icon className="size-6" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold uppercase tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-light-grey">
                    {p.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* coaching philosophy */}
      <section className="bg-background py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Coaching Philosophy"
            title="Why The Concept Works"
            description="Three principles guide everything we program and every rep we coach."
            className="mx-auto"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {philosophy.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="group h-full rounded-2xl border border-steel bg-card p-8 transition-all hover:border-neon-blue/50 hover:blue-glow">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue transition-colors group-hover:bg-cobalt group-hover:text-accent-foreground">
                    <p.icon className="size-6" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold uppercase tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-light-grey">
                    {p.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* stat band */}
          <div className="mt-16 grid grid-cols-2 gap-4 rounded-2xl border border-steel bg-charcoal p-8 lg:grid-cols-4">
            {[
              { to: 600, suffix: '+', label: 'Members trained' },
              { to: 250000, suffix: '+', label: 'Workouts logged' },
              { to: 8, suffix: '', label: 'Expert coaches' },
              { to: 30, suffix: ' min', label: 'Per session' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl font-black uppercase text-neon-blue text-glow lg:text-4xl">
                  <Counter to={s.to} suffix={s.suffix} />
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-light-grey">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* team */}
      <CoachesGrid
        eyebrow="The Team"
        title="Coaches In Your Corner"
        description="Qualified, motivating and genuinely invested in your progress."
      />

      <CtaBanner />
    </main>
  )
}

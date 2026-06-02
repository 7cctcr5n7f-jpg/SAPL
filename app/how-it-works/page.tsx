import type { Metadata } from 'next'
import Link from 'next/link'
import { DoorOpen, HeartPulse, Repeat, Flame, HeartHandshake, Dumbbell, Timer, ArrowRight } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { TheRounds } from '@/components/how-it-works/the-rounds'
import { TrainByEffort } from '@/components/how-it-works/train-by-effort'
import { TrainingCycles } from '@/components/how-it-works/training-cycles'
import { CtaBanner } from '@/components/cta-banner'
import { JsonLd } from '@/components/json-ld'
import { breadcrumbSchema } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'How It Works | 30-Minute HIIT Boxing Workout',
  description:
    'See how a TENROUNDS session works: 10 structured rounds of boxing, functional strength and heart-rate guided HIIT. 2.5 minutes work, 30 seconds rest, no class times.',
  alternates: { canonical: '/how-it-works' },
  openGraph: {
    title: 'How It Works | TENROUNDS',
    description:
      'Ten structured rounds combining boxing, functional strength and heart-rate guided intensity — a complete 30-minute workout with no class times.',
    images: [{ url: '/round-warmup.webp', width: 1200, height: 630, alt: 'TENROUNDS boxing workout' }],
  },
}

const steps = [
  {
    icon: DoorOpen,
    step: '01',
    title: 'Arrive Anytime',
    desc: 'No class times and no waiting. Walk in when it suits you and start at Round One.',
  },
  {
    icon: HeartPulse,
    step: '02',
    title: 'Connect Your Heart Rate Monitor',
    desc: 'Strap on your monitor and track your intensity live on the big screens throughout the session.',
  },
  {
    icon: Repeat,
    step: '03',
    title: 'Move Through 10 Rounds',
    desc: '2.5 minutes of work, 30 seconds of rest. Ten rounds, one complete 30-minute workout.',
  },
]

const benefits = [
  {
    icon: Flame,
    title: 'Maximum Calorie Burn',
    desc: 'Push real intensity without spending hours in the gym.',
  },
  {
    icon: HeartHandshake,
    title: 'Improve Cardio',
    desc: 'Build endurance and long-term heart health every session.',
  },
  {
    icon: Dumbbell,
    title: 'Build Muscle',
    desc: 'Full-body strength and conditioning across all ten rounds.',
  },
  {
    icon: Timer,
    title: 'Save Time',
    desc: 'Real, measurable results in just 30 focused minutes.',
  },
]

export default function HowItWorksPage() {
  return (
    <main>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'How It Works', path: '/how-it-works' },
        ])}
      />

      <PageHero
        eyebrow="How It Works"
        title="Show Up When It Suits You. Start At Round One."
        description="TENROUNDS runs on a continuous system built around 10 structured rounds that combine boxing, functional strength and heart-rate guided intensity."
        image="/round-warmup.webp"
        imageAlt="Boxer training on a TENROUNDS bag"
      />

      {/* System overview */}
      <section className="relative overflow-hidden bg-charcoal py-24 lg:py-32">
        <div className="pointer-events-none absolute left-0 top-0 size-[500px] -translate-x-1/3 rounded-full bg-cobalt/10 blur-[150px]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="The System"
              title="A Smarter Way To Train"
              description="Each round lasts 2.5 minutes, followed by 30 seconds of recovery — a complete 30-minute workout designed to push your fitness without wasting time."
            />
            <p className="mt-6 text-base leading-relaxed text-light-grey">
              Trainers circulate throughout the gym to guide your technique, support your effort and
              keep every session running smoothly. No schedules. No waiting. Just arrive and train.
            </p>
            <Link
              href="/free-trial"
              className="group mt-8 inline-flex items-center gap-2 rounded-md bg-cobalt px-7 py-4 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
            >
              Try It Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid grid-cols-3 gap-4">
              {[
                { stat: '10', label: 'Rounds' },
                { stat: '2:30', label: 'Work' },
                { stat: '0:30', label: 'Rest' },
                { stat: '30', label: 'Minutes' },
                { stat: '0', label: 'Class Times' },
                { stat: '100%', label: 'Coach-Supported' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center justify-center rounded-xl border border-steel bg-background p-5 text-center"
                >
                  <span className="font-display text-3xl font-black text-neon-blue">{s.stat}</span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-light-grey">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3 steps */}
      <section className="relative overflow-hidden bg-background py-24 lg:py-32">
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Getting Started"
            title="Three Steps To Your First Workout"
            className="mx-auto"
          />
          <div className="relative mt-16 grid gap-8 lg:grid-cols-3">
            <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-neon-blue/50 to-transparent lg:block" />
            {steps.map((s, i) => (
              <Reveal key={s.step} delay={i * 120}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative flex size-20 items-center justify-center rounded-full border border-neon-blue/40 bg-background blue-glow">
                    <s.icon className="size-8 text-neon-blue" />
                    <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-cobalt font-display text-xs font-bold text-accent-foreground">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold uppercase tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-light-grey">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* The 10 rounds */}
      <TheRounds />

      {/* Train by effort - heart rate zones */}
      <TrainByEffort />

      {/* Structured weekly training cycles */}
      <TrainingCycles />

      {/* Why HIIT works */}
      <section className="relative overflow-hidden bg-background py-24 lg:py-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt/10 blur-[150px]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Why HIIT Works"
            title="Short Bursts. Powerful Results."
            description="High-intensity interval training triggers real fitness adaptations in a fraction of the time of a traditional gym session."
            className="mx-auto"
          />
          <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-6 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <Reveal key={b.title} delay={i * 100}>
                <div className="flex h-full flex-col rounded-xl border border-steel bg-card p-4 transition-colors hover:border-neon-blue/50 sm:p-7">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-cobalt/15 sm:size-12">
                    <b.icon className="size-5 text-neon-blue sm:size-6" />
                  </div>
                  <h3 className="mt-3 font-display text-sm font-bold uppercase leading-tight tracking-tight sm:mt-5 sm:text-lg">
                    {b.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-light-grey sm:mt-2 sm:text-sm">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        headline="Your First Round Is On Us"
        subheadline="No class times, no contracts to start. Walk in, connect your monitor and experience all 10 rounds for yourself."
        buttonLabel="Claim Your Free Trial"
      />
    </main>
  )
}

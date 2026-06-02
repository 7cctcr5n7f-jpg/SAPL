import { Dumbbell, PersonStanding, Activity } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const split = [
  { day: 'Monday', short: 'Mon', focus: 'Shoulders & Biceps', icon: Dumbbell },
  { day: 'Tuesday', short: 'Tue', focus: 'Back & Legs', icon: PersonStanding },
  { day: 'Wednesday', short: 'Wed', focus: 'Chest & Triceps', icon: Activity },
  { day: 'Thursday', short: 'Thu', focus: 'Shoulders & Biceps', icon: Dumbbell },
  { day: 'Friday', short: 'Fri', focus: 'Back & Legs', icon: PersonStanding },
  { day: 'Saturday', short: 'Sat', focus: 'Chest & Triceps', icon: Activity },
]

export function TrainingCycles() {
  return (
    <section className="relative overflow-hidden bg-charcoal py-24 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 size-[500px] -translate-x-1/2 rounded-full bg-cobalt/10 blur-[150px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Weekly Structure"
          title="Structured Training Cycles"
          description="Workouts rotate through different muscle groups across the week to ensure balanced progress, full-body development and proper recovery."
          className="mx-auto"
        />

        <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-4 lg:grid-cols-3">
          {split.map((d, i) => (
            <Reveal key={d.day} delay={i * 80}>
              <div className="group flex h-full items-center gap-3 rounded-xl border border-steel bg-background p-3 transition-colors hover:border-neon-blue/50 sm:gap-4 sm:p-5">
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border border-neon-blue/30 bg-cobalt/10 sm:size-14">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-neon-blue">
                    {d.short}
                  </span>
                  <d.icon className="mt-0.5 size-4 text-light-grey" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-light-grey">
                    {d.day}
                  </p>
                  <p className="mt-0.5 font-display text-sm font-bold uppercase leading-tight tracking-tight text-foreground sm:text-lg">
                    {d.focus}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-light-grey">
          Sundays are for rest and recovery — your body builds strength between sessions.
        </p>
      </div>
    </section>
  )
}

import { Car } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const driveTimes = [
  { area: 'Woodhill', minutes: 5 },
  { area: 'Olympus', minutes: 7 },
  { area: 'Boardwalk', minutes: 7 },
  { area: 'Moreleta Park', minutes: 8 },
  { area: 'Faerie Glen', minutes: 10 },
  { area: 'Menlyn', minutes: 12 },
]

export function DriveTimes() {
  return (
    <section className="bg-charcoal py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Minutes Away"
          title="Quick To Reach From Across Pretoria East"
          subtitle="Making it easy to fit your workout into your day."
          className="mx-auto"
        />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-6 lg:grid-cols-3">
          {driveTimes.map((d, i) => (
            <Reveal key={d.area} delay={i * 70}>
              <div className="glass flex items-center justify-between gap-3 rounded-2xl border border-steel p-5 transition-colors hover:border-neon-blue/50 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue">
                    <Car className="size-5" />
                  </span>
                  <span className="font-display text-base font-bold uppercase tracking-tight text-foreground sm:text-lg">
                    {d.area}
                  </span>
                </div>
                <span className="font-display text-sm font-black uppercase tracking-tight text-neon-blue">
                  {d.minutes} Min
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

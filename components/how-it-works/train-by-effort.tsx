import { Activity } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const zones = [
  { label: 'Maximum Effort', range: '90%+', color: '#e11d2a', text: 'text-white' },
  { label: 'Anaerobic', range: '80–89%', color: '#f06a1e', text: 'text-white' },
  { label: 'Aerobic', range: '70–79%', color: '#22a447', text: 'text-white' },
  { label: 'Weight Control', range: '60–69%', color: '#1593a8', text: 'text-white' },
  { label: 'Moderate Effort', range: '50–59%', color: '#2f7fd1', text: 'text-white' },
  { label: 'Rest', range: '–50%', color: '#6b7280', text: 'text-white' },
]

export function TrainByEffort() {
  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="pointer-events-none absolute right-0 top-1/4 size-[500px] translate-x-1/3 rounded-full bg-cobalt/10 blur-[150px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Heart Rate Zones"
            title="Train By Effort, Not Guesswork"
            description="Your heart rate shows exactly how hard you're working. TENROUNDS uses live zone tracking to guide your intensity through every round — so you always know when to push and when to recover."
          />
          <p className="mt-6 text-base leading-relaxed text-light-grey">
            Each colour represents a percentage of your maximum heart rate. As you move through the
            workout, your zone updates live on the big screens — turning effort into something you
            can actually see and measure.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex flex-col gap-3">
            {zones.map((z) => (
              <div
                key={z.label}
                className={`flex items-center justify-between rounded-xl px-5 py-4 shadow-lg ${z.text}`}
                style={{ backgroundColor: z.color }}
              >
                <span className="flex items-center gap-3">
                  <Activity className="size-5 shrink-0 opacity-90" />
                  <span className="font-display text-base font-bold uppercase tracking-tight md:text-lg">
                    {z.label}
                  </span>
                </span>
                <span className="font-display text-lg font-black tabular-nums md:text-xl">
                  {z.range}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

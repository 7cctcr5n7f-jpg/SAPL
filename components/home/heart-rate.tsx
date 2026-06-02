import Image from 'next/image'
import { HeartPulse, MonitorSmartphone, Target, TrendingUp } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const points = [
  {
    icon: MonitorSmartphone,
    title: 'Every Round On Screen',
    desc: 'Large screens guide every movement, set and round so you always know exactly what to do next.',
  },
  {
    icon: HeartPulse,
    title: 'Live Heart Rate',
    desc: 'Your real-time heart rate keeps you honest, training in the right zone for maximum results.',
  },
  {
    icon: Target,
    title: 'Effort Zones',
    desc: 'Color-coded intensity zones show when to push harder and when to recover.',
  },
  {
    icon: TrendingUp,
    title: 'Measured Improves',
    desc: 'When it is measured, it improves. Track effort and calories session after session.',
  },
]

export function HeartRate() {
  return (
    <section className="relative overflow-hidden bg-card py-24 lg:py-32">
      {/* subtle pulse accent */}
      <div className="pointer-events-none absolute -right-24 top-1/4 size-96 rounded-full bg-cobalt/10 blur-3xl" />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* copy */}
        <div>
          <SectionHeading
            eyebrow="Heart Rate Monitoring"
            title="Your Heart Rate Tells The Truth"
            description="Every round is on screen. Large screens guide every movement while your live heart rate keeps you accountable. When it is measured, it improves."
          />

          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4">
            {points.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-steel bg-background p-4 transition-colors hover:border-neon-blue/60 sm:flex-row sm:gap-4 sm:p-5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue sm:size-11">
                    <p.icon className="size-4 sm:size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold uppercase leading-tight tracking-tight text-foreground sm:text-base">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-light-grey sm:text-sm">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* visuals */}
        <Reveal delay={120}>
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-steel blue-glow">
              <Image
                src="/onscreen-wall.webp"
                alt="TENROUNDS live workout display showing round timer and member heart-rate zones on screen"
                width={1206}
                height={804}
                className="h-auto w-full object-cover"
              />
            </div>

            {/* floating watch */}
            <div className="absolute -bottom-8 -left-6 w-32 drop-shadow-2xl sm:w-40 lg:-left-10 lg:w-48">
              <Image
                src="/heart-rate-watch.png"
                alt="Fitness tracker displaying a live heart rate of 92 percent in the 90 to 100 percent zone"
                width={717}
                height={912}
                className="h-auto w-full"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

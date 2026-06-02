import {
  Timer,
  CalendarOff,
  Dumbbell,
  Flame,
  Users,
  HeartPulse,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const benefits = [
  { icon: Timer, title: '30-Minute Workouts', desc: 'Maximum impact in minimum time. In, trained, and back to your day.' },
  { icon: CalendarOff, title: 'No Class Times', desc: 'Start whenever you arrive. Your schedule sets the pace, not ours.' },
  { icon: Dumbbell, title: 'Strength + Cardio', desc: 'A complete training stimulus that builds power and conditioning together.' },
  { icon: Activity, title: 'Full-Body HIIT', desc: 'High-intensity intervals engineered to work every muscle group.' },
  { icon: HeartPulse, title: 'All Fitness Levels', desc: 'Scaled and coached to meet you exactly where you are today.' },
  { icon: Users, title: 'Coach Support', desc: 'A qualified coach guides and pushes you through every single session.' },
  { icon: Flame, title: 'Burn + Build', desc: 'Torch fat while building lean, functional strength that lasts.' },
  { icon: TrendingUp, title: 'Track Progress', desc: 'Measurable performance data so you always know you are improving.' },
]

export function WhyTenrounds() {
  return (
    <section className="relative bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Why TENROUNDS"
          title="A Smarter Way To Train"
          description="Everything is engineered around one goal: real results that fit a busy life. No wasted minutes, no guesswork, no waiting."
        />

        <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={(i % 4) * 80}>
              <div className="group relative h-full overflow-hidden rounded-xl border border-steel bg-card p-4 transition-all duration-300 hover:-translate-y-2 hover:border-neon-blue/60 hover:blue-glow sm:p-6">
                {/* growing accent bar */}
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-neon-blue transition-transform duration-300 group-hover:scale-x-100" />

                {/* big watermark number */}
                <span className="pointer-events-none absolute -right-1 -top-3 font-display text-5xl font-black leading-none text-steel/20 transition-colors duration-300 group-hover:text-neon-blue/15 sm:text-6xl">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="relative flex size-10 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-cobalt group-hover:text-accent-foreground sm:size-12">
                  <b.icon className="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" />
                </div>
                <h3 className="relative mt-3 font-display text-sm font-bold uppercase leading-tight tracking-tight text-foreground transition-colors duration-300 group-hover:text-neon-blue sm:mt-5 sm:text-lg">
                  {b.title}
                </h3>
                <p className="relative mt-1.5 text-xs leading-relaxed text-light-grey sm:mt-2 sm:text-sm">
                  {b.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

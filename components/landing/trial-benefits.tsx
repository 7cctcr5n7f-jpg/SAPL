import { ShieldCheck, Zap, HeartPulse, Users } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const benefits = [
  {
    icon: ShieldCheck,
    stat: 'ZERO',
    statLabel: 'guesswork',
    title: 'Coach-Supported, Always',
    desc: "From the moment you walk in, a coach has your back. You'll never be left wondering what to do.",
  },
  {
    icon: Zap,
    stat: '30',
    statLabel: 'minutes',
    title: 'In. Out. Transformed.',
    desc: 'Maximum impact, minimal time. A full-body burn that fits into the busiest day.',
  },
  {
    icon: HeartPulse,
    stat: 'LIVE',
    statLabel: 'heart rate',
    title: 'See Every Beat',
    desc: 'Real-time heart rate on the big screen. Watch your effort, calories and progress as you go.',
  },
  {
    icon: Users,
    stat: 'ALL',
    statLabel: 'levels',
    title: 'Built For Everybody',
    desc: "Total beginner or seasoned athlete — every workout scales to meet you exactly where you are.",
  },
]

export function TrialBenefits() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 90}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-steel bg-card p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-neon-blue/60 hover:blue-glow">
                {/* top accent bar that lights up on hover */}
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-cobalt to-neon-blue transition-transform duration-300 group-hover:scale-x-100" />

                {/* oversized index watermark */}
                <span className="pointer-events-none absolute -right-2 -top-4 font-display text-7xl font-black leading-none text-steel/40 transition-colors duration-300 group-hover:text-neon-blue/15">
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* icon orb */}
                <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cobalt to-neon-blue text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <b.icon className="size-7" />
                </span>

                {/* punchy stat */}
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-black uppercase leading-none tracking-tight text-neon-blue text-glow">
                    {b.stat}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-mid-grey">
                    {b.statLabel}
                  </span>
                </div>

                <h3 className="mt-3 font-display text-lg font-bold uppercase leading-tight tracking-tight text-balance">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-light-grey">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

import { UserPlus, Clock4, Trophy } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Join TENROUNDS',
    desc: 'Claim your free trial or pick a membership. Onboarding takes minutes, not weeks.',
  },
  {
    icon: Clock4,
    step: '02',
    title: 'Train When It Suits You',
    desc: 'Walk in, start your 30-minute session, and let your coach guide the work.',
  },
  {
    icon: Trophy,
    step: '03',
    title: 'See Results',
    desc: 'Track measurable progress as strength, conditioning and confidence climb.',
  },
]

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-charcoal py-24 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt/10 blur-[140px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="How It Works"
          title="Simple. Effective. Results-Driven."
          className="mx-auto"
        />

        <div className="relative mt-10 grid grid-cols-3 gap-3 sm:mt-16 sm:gap-8">
          {/* connector line */}
          <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-neon-blue/50 to-transparent lg:block" />
          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 120}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative flex size-14 items-center justify-center rounded-full border border-neon-blue/40 bg-background blue-glow sm:size-20">
                  <s.icon className="size-6 text-neon-blue sm:size-8" />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-cobalt font-display text-[10px] font-bold text-accent-foreground sm:size-7 sm:text-xs">
                    {s.step}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-sm font-bold uppercase leading-tight tracking-tight sm:mt-6 sm:text-xl">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-light-grey sm:mt-3 sm:text-sm">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

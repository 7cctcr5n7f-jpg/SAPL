import { Clock, Award, MapPin, Droplets, CreditCard, Smile, Check } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

type Fact = {
  icon: typeof Clock
  label: string
  value: string
  tone: 'blue' | 'green'
}

const facts: Fact[] = [
  { icon: Clock, label: 'Workout Duration', value: '30 Minutes', tone: 'blue' },
  { icon: Award, label: 'Experience Needed', value: 'None At All', tone: 'green' },
  { icon: Droplets, label: 'What To Bring', value: 'Activewear & Water', tone: 'blue' },
  { icon: CreditCard, label: 'Payment Required', value: 'Nothing. R0', tone: 'green' },
  {
    icon: MapPin,
    label: 'Where',
    value: '649 Borzoi Street, Garsfontein',
    tone: 'blue',
  },
  { icon: Smile, label: 'Pressure To Join', value: 'Absolutely None', tone: 'green' },
]

export function TrialAtAGlance() {
  return (
    <section className="bg-charcoal py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading align="center" eyebrow="The Essentials" title="Trial At A Glance" className="mx-auto" />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {facts.map((f, i) => {
            const green = f.tone === 'green'
            return (
              <Reveal key={f.label} delay={i * 70}>
                <div
                  className={`group relative flex h-full items-center gap-4 overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 ${
                    green
                      ? 'border-neon-green/25 hover:border-neon-green/60 hover:green-glow'
                      : 'border-steel hover:border-neon-blue/60 hover:blue-glow'
                  }`}
                >
                  {/* left accent rail */}
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${green ? 'bg-neon-green' : 'bg-neon-blue'}`}
                  />

                  {/* icon orb */}
                  <span
                    className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 ${
                      green ? 'bg-neon-green' : 'bg-gradient-to-br from-cobalt to-neon-blue'
                    }`}
                  >
                    <f.icon className="size-5" />
                  </span>

                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-mid-grey">
                      {f.label}
                      {green && <Check className="size-3.5 text-neon-green" />}
                    </p>
                    <p className="mt-1 font-display text-lg font-black uppercase leading-tight tracking-tight text-foreground text-balance">
                      {f.value}
                    </p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

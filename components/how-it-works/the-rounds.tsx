import Image from 'next/image'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

type Round = {
  n: number
  title: string
  desc: string
  image?: string
  alt?: string
}

const rounds: Round[] = [
  {
    n: 1,
    title: 'Warm Up',
    desc: 'Speedball or double-end bag drills to get your blood flowing and prepare your body for the work ahead.',
    image: '/round-warmup.webp',
    alt: 'Boxer warming up on a TENROUNDS double-end bag',
  },
  {
    n: 2,
    title: 'Weights Round',
    desc: 'Strength training using dumbbells, kettlebells, medicine balls and functional gym equipment.',
    image: '/round-weights.webp',
    alt: 'Athlete performing a kettlebell squat',
  },
  {
    n: 3,
    title: 'Functional Round',
    desc: 'Functional training with plates, resistance bands and equipment designed to target key muscle groups.',
    image: '/round-functional.webp',
    alt: 'Athlete training with battle ropes',
  },
  {
    n: 4,
    title: 'Boxing Bag Round',
    desc: 'Heavy bag punching and kicking to build power while pushing your heart rate into the HIIT zone.',
    image: '/round-boxing-bag.webp',
    alt: 'Boxer striking a heavy bag',
  },
  {
    n: 5,
    title: 'Maize Bag Round',
    desc: 'Build coordination, confidence and sharper striking technique with rapid maize bag work.',
  },
  {
    n: 6,
    title: 'Multi-Functional Wall',
    desc: 'TRX bands and resistance tubes build core strength, control and full-body stability.',
  },
  {
    n: 7,
    title: 'Muay Thai Bag',
    desc: 'High-intensity kicks and punches drive your heart rate back into the HIIT zone.',
  },
  {
    n: 8,
    title: 'Core',
    desc: 'Mat-based exercises that strengthen your core and stabilising muscles.',
  },
  {
    n: 9,
    title: 'Wrecking Bag',
    desc: 'Heavy endurance work that burns calories and builds lasting stamina.',
  },
  {
    n: 10,
    title: 'Aqua Bag',
    desc: 'Strike the Aqua Bag while your power and endurance are tracked to the final bell.',
  },
]

function TimePill() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-steel bg-black/60 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
      <span className="text-neon-blue">2:30 Work</span>
      <span className="h-3 w-px bg-steel" />
      <span className="text-light-grey">0:30 Rest</span>
    </div>
  )
}

export function TheRounds() {
  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="pointer-events-none absolute right-0 top-40 size-[500px] translate-x-1/3 rounded-full bg-cobalt/10 blur-[150px]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="The 10 Rounds"
          title="One System. Ten Rounds."
          description="Every session moves through the same proven structure — 2.5 minutes of work, 30 seconds of recovery, ten times over. A complete 30-minute workout, every time you walk in."
          className="mx-auto"
        />

        {/* Featured rounds with imagery */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {rounds.slice(0, 4).map((r, i) => (
            <Reveal key={r.n} delay={i * 100}>
              <article className="group relative h-72 overflow-hidden rounded-xl border border-steel">
                <Image
                  src={r.image! || '/placeholder.svg'}
                  alt={r.alt ?? r.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                <div className="absolute left-5 top-5">
                  <span className="font-display text-5xl font-black leading-none text-neon-blue/90">
                    {String(r.n).padStart(2, '0')}
                  </span>
                </div>
                <div className="absolute inset-x-5 bottom-5">
                  <TimePill />
                  <h3 className="mt-3 font-display text-2xl font-bold uppercase tracking-tight">
                    {r.title}
                  </h3>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-light-grey">
                    {r.desc}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Remaining rounds */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rounds.slice(4).map((r, i) => (
            <Reveal key={r.n} delay={i * 80}>
              <article className="relative flex h-full flex-col rounded-xl border border-steel bg-charcoal p-6 transition-colors hover:border-neon-blue/50">
                <div className="flex items-center justify-between">
                  <span className="font-display text-4xl font-black leading-none text-foreground/15">
                    {String(r.n).padStart(2, '0')}
                  </span>
                  <TimePill />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold uppercase tracking-tight">
                  {r.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-light-grey">
                  {r.desc}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

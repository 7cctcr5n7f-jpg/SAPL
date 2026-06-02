import { Trophy } from 'lucide-react'
import Image from 'next/image'
import { Reveal } from '@/components/reveal'
import type { ChowWinner } from '@/lib/db/schema'

export function ChowWinners({
  winners,
  challenge = '',
}: {
  winners: ChowWinner[]
  challenge?: string
}) {
  if (winners.length === 0) return null

  const period = winners.find((w) => w.period.trim().length > 0)?.period ?? 'this week'

  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      {/* neon glow accents */}
      <div className="animate-pulse-glow pointer-events-none absolute -left-20 top-1/4 size-80 rounded-full bg-cobalt/25 blur-[120px]" />
      <div className="animate-pulse-glow pointer-events-none absolute -right-20 bottom-1/4 size-80 rounded-full bg-neon-blue/20 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl px-5 lg:px-8">
        {/* big motivational tagline */}
        <div className="mb-14 text-center">
          <p className="font-display text-2xl font-black uppercase leading-none tracking-tight text-balance sm:text-3xl">
            <span className="text-foreground">Train Together.</span>{' '}
            <span className="text-neon-blue text-glow">Grow Together.</span>
          </p>
          <div className="mx-auto mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-neon-blue/60" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-light-grey">
              The TENROUNDS Community
            </span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-neon-blue/60" />
          </div>
        </div>

        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-neon-blue/50 bg-black/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue backdrop-blur">
            Challenge Of The Week
          </span>
          <h2 className="mt-6 font-display text-5xl font-black uppercase leading-[0.85] tracking-tight text-balance md:text-7xl">
            <span className="block text-neon-blue text-glow">CHOW</span>
            <span className="block">Winners</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-light-grey">
            Congratulations to our CHOW winners from {period.toLowerCase()}! Your dedication,
            consistency and commitment to your goals are paying off.
          </p>

          {challenge.trim() ? (
            <div className="mx-auto mt-7 inline-flex flex-col items-center gap-1 rounded-2xl border border-neon-green/50 bg-neon-green/10 px-6 py-4 green-glow">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neon-green">
                The Challenge
              </span>
              <span className="font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
                {challenge}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-12 flex flex-col gap-4">
          {winners.map((w, i) => (
            <Reveal key={w.id} delay={i * 120}>
              <div className="group flex items-center gap-5 rounded-2xl border border-neon-blue/50 bg-black/40 p-5 backdrop-blur transition-all hover:border-neon-blue hover:blue-glow sm:p-6">
                {w.imageUrl ? (
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-full border border-neon-blue/60 sm:size-16">
                    <Image src={w.imageUrl || '/placeholder.svg'} alt={w.name} fill className="object-cover" sizes="64px" />
                  </span>
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-neon-blue/60 bg-cobalt/15 text-neon-blue transition-colors group-hover:bg-cobalt group-hover:text-accent-foreground sm:size-16">
                    <Trophy className="size-7 sm:size-8" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-light-grey">{w.label}</p>
                  <p className="font-display text-4xl font-black uppercase leading-none tracking-tight text-foreground sm:text-5xl">
                    {w.name}
                  </p>
                  {w.achievement ? (
                    <p className="mt-1 text-sm font-medium text-neon-blue">{w.achievement}</p>
                  ) : null}
                  {w.quote ? (
                    <p className="mt-1 text-sm italic leading-relaxed text-light-grey">“{w.quote}”</p>
                  ) : null}
                </div>
                {w.score.trim() ? (
                  <div className="shrink-0 text-right">
                    <p className="font-display text-4xl font-black leading-none tracking-tight text-neon-green text-glow sm:text-5xl">
                      {w.score}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-light-grey">
                      Score
                    </p>
                  </div>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center font-display text-lg font-bold uppercase tracking-tight text-foreground">
          Let&apos;s give them a massive{' '}
          <span className="text-neon-blue text-glow">shoutout!</span>
        </p>
      </div>
    </section>
  )
}

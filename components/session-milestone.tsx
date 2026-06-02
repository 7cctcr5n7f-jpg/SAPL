import Image from 'next/image'
import { PartyPopper } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import type { SessionMilestone as SessionMilestoneType } from '@/lib/db/schema'

export function SessionMilestone({ milestone }: { milestone: SessionMilestoneType | null }) {
  if (!milestone) return null

  return (
    <section className="relative overflow-hidden bg-charcoal py-20 lg:py-24">
      <div className="animate-pulse-glow pointer-events-none absolute right-0 top-0 size-72 rounded-full bg-neon-green/15 blur-[120px]" />
      <div className="relative mx-auto max-w-4xl px-5 lg:px-8">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-neon-green/50 bg-black/40 backdrop-blur green-glow sm:flex">
            {milestone.imageUrl ? (
              <div className="relative h-56 w-full shrink-0 sm:h-auto sm:w-2/5">
                <Image
                  src={milestone.imageUrl || '/placeholder.svg'}
                  alt={`${milestone.name} celebrating ${milestone.sessions} sessions`}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="flex flex-1 flex-col justify-center p-7 sm:p-9">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-neon-green/50 bg-neon-green/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-neon-green">
                <PartyPopper className="size-4" /> Milestone Unlocked
              </span>
              <p className="mt-5 font-display text-6xl font-black uppercase leading-none tracking-tight text-neon-green text-glow sm:text-7xl">
                {milestone.sessions}
              </p>
              <p className="mt-1 font-display text-lg font-bold uppercase tracking-[0.2em] text-foreground">
                Sessions
              </p>
              <p className="mt-4 text-pretty leading-relaxed text-light-grey">
                Huge congratulations to{' '}
                <span className="font-display text-xl font-black uppercase tracking-tight text-foreground">
                  {milestone.name}
                </span>{' '}
                for smashing {milestone.sessions}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

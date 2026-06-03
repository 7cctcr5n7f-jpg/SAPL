import Image from 'next/image'
import { PartyPopper } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import type { SessionMilestone as SessionMilestoneType } from '@/lib/db/schema'

function MilestoneCard({
  milestone,
  compact,
}: {
  milestone: SessionMilestoneType
  compact: boolean
}) {
  return (
    <div
      className={
        'overflow-hidden rounded-3xl border border-neon-green/50 bg-black/40 backdrop-blur green-glow ' +
        (compact ? 'flex h-full flex-col lg:flex-row' : 'sm:flex')
      }
    >
      {milestone.imageUrl ? (
        <div
          className={
            'relative w-full shrink-0 bg-black/40 ' +
            (compact ? 'h-56 lg:h-auto lg:w-1/2 lg:self-stretch' : 'h-56 sm:h-auto sm:w-2/5')
          }
        >
          <Image
            src={milestone.imageUrl || '/placeholder.svg'}
            alt={`${milestone.name} celebrating ${milestone.sessions} sessions`}
            fill
            sizes={compact ? '(max-width: 1024px) 100vw, 400px' : '(max-width: 640px) 100vw, 320px'}
            className={compact ? 'object-cover lg:object-contain' : 'object-cover'}
          />
        </div>
      ) : null}
      <div className={'flex flex-1 flex-col justify-center ' + (compact ? 'p-6 lg:p-8' : 'p-7 sm:p-9')}>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-neon-green/50 bg-neon-green/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-neon-green">
          <PartyPopper className="size-4" /> Milestone Unlocked
        </span>
        <p
          className={
            'mt-5 font-display font-black uppercase leading-none tracking-tight text-neon-green text-glow ' +
            (compact ? 'text-5xl lg:text-6xl' : 'text-6xl sm:text-7xl')
          }
        >
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
  )
}

export function SessionMilestone({
  milestones,
}: {
  milestones: SessionMilestoneType[]
}) {
  if (!milestones || milestones.length === 0) return null

  const count = milestones.length
  const compact = count > 1

  // Container + grid widths scale with how many celebrations are active.
  const container =
    count === 1 ? 'max-w-4xl' : count === 2 ? 'max-w-6xl' : 'max-w-7xl'
  const grid =
    count === 1
      ? 'grid-cols-1'
      : count === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="relative overflow-hidden bg-charcoal py-20 lg:py-24">
      <div className="animate-pulse-glow pointer-events-none absolute right-0 top-0 size-72 rounded-full bg-neon-green/15 blur-[120px]" />
      <div className={`relative mx-auto px-5 lg:px-8 ${container}`}>
        <Reveal>
          <div className={`grid gap-6 ${grid}`}>
            {milestones.map((m) => (
              <MilestoneCard key={m.id} milestone={m} compact={compact} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

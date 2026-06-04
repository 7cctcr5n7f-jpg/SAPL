import { MapPin, Check, Flame } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { sessionPacks, sessionPrice, formatRand } from '@/lib/memberships'
import { cn } from '@/lib/utils'
import type { Special } from '@/lib/db/schema'

export function SessionPacks({
  discounts = {},
  special,
}: {
  discounts?: Record<number, number>
  special?: Special | null
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeading
        eyebrow="No Monthly Commitment"
        title="Prefer to Pay as You Train?"
        description="Not ready to commit monthly? Grab a session pack and train on your own terms. The more you buy, the less you pay per session."
      />

      {/* Sessions special — shown just above the session prices */}
      {special ? (
        <div className="green-glow relative mt-8 flex flex-col items-start gap-2 rounded-2xl border-2 border-neon-green/70 bg-neon-green/5 p-5 sm:mt-10 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-neon-green px-3 py-1 font-display text-[11px] font-black uppercase tracking-widest text-background">
            <Flame className="size-3.5" /> {special.badge || 'Sessions Special'}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-neon-green sm:text-xl">
              {special.title}
            </h3>
            {special.description ? (
              <p className="mt-0.5 text-sm leading-relaxed text-light-grey">{special.description}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
        {sessionPacks.map((pack) => {
          const specialPrice = discounts[pack.quantity]
          const hasSpecial = specialPrice != null && specialPrice < pack.price
          const per = sessionPrice(
            hasSpecial ? { ...pack, price: specialPrice } : pack,
          )
          return (
            <div
              key={pack.quantity}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-card p-4 transition-all duration-200 sm:p-6',
                hasSpecial
                  ? 'border-2 border-neon-green/70 green-glow'
                  : pack.popular
                    ? 'border-neon-blue blue-glow'
                    : 'border-steel hover:border-neon-blue/60',
              )}
            >
              {hasSpecial ? (
                <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-neon-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background sm:left-6 sm:px-3 sm:text-xs">
                  <Flame className="size-3" /> Special
                </span>
              ) : pack.popular ? (
                <span className="absolute -top-3 left-4 inline-flex items-center rounded-full bg-neon-blue px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background sm:left-6 sm:px-3 sm:text-xs">
                  Best Value
                </span>
              ) : null}
              <p
                className={cn(
                  'font-display text-xs font-bold uppercase tracking-widest sm:text-sm',
                  hasSpecial ? 'text-neon-green' : 'text-neon-blue',
                )}
              >
                {pack.quantity === 1 ? 'Single' : `${pack.quantity} Pack`}
              </p>
              {hasSpecial ? (
                <p className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
                  <span className="font-display text-xl font-bold tracking-tight text-light-grey line-through sm:text-2xl">
                    {formatRand(pack.price)}
                  </span>
                  <span className="font-display text-3xl font-black tracking-tight text-neon-green sm:text-4xl">
                    {formatRand(specialPrice)}
                  </span>
                </p>
              ) : (
                <p className="mt-3 flex items-end gap-1">
                  <span className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                    {formatRand(pack.price)}
                  </span>
                </p>
              )}
              <p className="mt-2 text-xs text-light-grey sm:text-sm">
                {pack.quantity === 1
                  ? 'Single drop-in session'
                  : `${pack.quantity} sessions`}
              </p>
              <p className="mt-3 border-t border-steel/60 pt-3 text-xs text-light-grey sm:mt-4 sm:pt-4 sm:text-sm">
                <span className={cn('font-semibold', hasSpecial ? 'text-neon-green' : 'text-foreground')}>
                  {formatRand(per)}
                </span>{' '}
                per session
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-steel bg-charcoal p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-light-grey">
          <MapPin className="size-4 shrink-0 text-neon-blue" />
          Session packs are purchased in person at the club — no booking or contract required.
        </p>
        <p className="flex items-center gap-2 text-sm text-light-grey">
          <Check className="size-4 shrink-0 text-neon-blue" />
          Same coach-supported 30-minute workout as our members.
        </p>
      </div>
    </div>
  )
}

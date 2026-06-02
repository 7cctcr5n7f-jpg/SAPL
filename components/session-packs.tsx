import { MapPin, Check } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { sessionPacks, sessionPrice, formatRand } from '@/lib/memberships'
import { cn } from '@/lib/utils'

export function SessionPacks() {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeading
        eyebrow="No Monthly Commitment"
        title="Prefer to Pay as You Train?"
        description="Not ready to commit monthly? Grab a session pack and train on your own terms. The more you buy, the less you pay per session."
      />

      <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-4">
        {sessionPacks.map((pack) => {
          const per = sessionPrice(pack)
          return (
            <div
              key={pack.quantity}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-card p-4 transition-all duration-200 sm:p-6',
                pack.popular
                  ? 'border-neon-blue blue-glow'
                  : 'border-steel hover:border-neon-blue/60',
              )}
            >
              {pack.popular && (
                <span className="absolute -top-3 left-4 inline-flex items-center rounded-full bg-neon-blue px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background sm:left-6 sm:px-3 sm:text-xs">
                  Best Value
                </span>
              )}
              <p className="font-display text-xs font-bold uppercase tracking-widest text-neon-blue sm:text-sm">
                {pack.quantity === 1 ? 'Single' : `${pack.quantity} Pack`}
              </p>
              <p className="mt-3 flex items-end gap-1">
                <span className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  {formatRand(pack.price)}
                </span>
              </p>
              <p className="mt-2 text-xs text-light-grey sm:text-sm">
                {pack.quantity === 1
                  ? 'Single drop-in session'
                  : `${pack.quantity} sessions`}
              </p>
              <p className="mt-3 border-t border-steel/60 pt-3 text-xs text-light-grey sm:mt-4 sm:pt-4 sm:text-sm">
                <span className="font-semibold text-foreground">{formatRand(per)}</span> per session
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

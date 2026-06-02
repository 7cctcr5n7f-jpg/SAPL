import Image from 'next/image'
import Link from 'next/link'
import { Flame, ArrowRight } from 'lucide-react'
import type { Special } from '@/lib/db/schema'

export function SpecialInline({ specials }: { specials: Special[] }) {
  if (specials.length === 0) return null

  return (
    <section className="relative overflow-hidden bg-background pb-4 pt-16 lg:pt-20">
      {/* soft ambient glow — keeps it lively without any hard box */}
      <div className="animate-pulse-glow pointer-events-none absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-green/15 blur-[140px]" />

      <div className="relative mx-auto max-w-3xl px-5 text-center lg:px-8">
        <span className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.25em] text-neon-green">
          <Flame className="size-4" /> Limited-Time Offer
        </span>

        <div className="mt-5 flex flex-col gap-8">
          {specials.map((s) => (
            <div key={s.id} className="flex flex-col items-center">
              {s.imageUrl ? (
                <div className="relative mb-4 size-20 overflow-hidden rounded-full ring-2 ring-neon-green/40">
                  <Image
                    src={s.imageUrl || '/placeholder.svg'}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ) : null}

              <h3 className="font-display text-3xl font-black uppercase leading-[1.05] tracking-tight text-balance text-foreground sm:text-4xl">
                {s.title}
              </h3>

              {s.discountPercent > 0 ? (
                <p className="mt-2 font-display text-lg font-black uppercase tracking-wide text-neon-green">
                  {s.discountPercent}% Off
                </p>
              ) : s.badge ? (
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-neon-green">
                  {s.badge}
                </p>
              ) : null}

              {s.description ? (
                <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-light-grey">
                  {s.description}
                </p>
              ) : null}

              {s.ctaHref ? (
                <Link
                  href={s.ctaHref}
                  className="group mt-4 inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-neon-green transition-colors hover:text-foreground"
                >
                  {s.ctaLabel || 'Claim'}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

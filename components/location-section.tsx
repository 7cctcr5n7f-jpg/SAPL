import { MapPin, Clock, Phone, Navigation } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { business, fullAddress } from '@/lib/business'
import { cn } from '@/lib/utils'
import { MapEmbed } from '@/components/map-embed'

export function LocationSection({ dark = false }: { dark?: boolean }) {
  return (
    <section className={dark ? 'bg-charcoal py-20 lg:py-28' : 'bg-background py-20 lg:py-28'}>
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Find Us"
          title="In The Heart Of Pretoria East"
          description={`TENROUNDS is based in Garsfontein — minutes from ${business.areasServed
            .slice(1, 6)
            .join(', ')} and the wider Pretoria East area.`}
        />

        <div className="mt-10 grid gap-6 sm:mt-12 sm:gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
          {/* details */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <DetailCard icon={MapPin} title="Address">
              {fullAddress}
            </DetailCard>
            <DetailCard icon={Clock} title="Opening Hours">
              <span className="space-y-1">
                {business.hoursDisplay.map((h) => (
                  <span key={h.days} className="block">
                    <span className="text-foreground">{h.days}:</span> {h.time}
                  </span>
                ))}
              </span>
            </DetailCard>
            <DetailCard icon={Phone} title="Call Us">
              <a href={`tel:${business.phoneE164}`} className="hover:text-neon-blue">
                {business.phoneDisplay}
              </a>
            </DetailCard>
            <a
              href={business.directionsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-cobalt px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow lg:mt-2"
            >
              <Navigation className="size-4" /> Get Directions
            </a>
          </div>

          {/* map — deferred until clicked so Google Maps never blocks initial load */}
          <div className="overflow-hidden rounded-2xl border border-steel">
            <MapEmbed
              src={business.mapsEmbed}
              title={`Map showing ${business.name} in Garsfontein, Pretoria East`}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function DetailCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: typeof MapPin
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex gap-4 rounded-xl border border-steel bg-card p-4 sm:p-5', className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
          {title}
        </p>
        <div className="mt-1 text-sm leading-relaxed text-light-grey">{children}</div>
      </div>
    </div>
  )
}

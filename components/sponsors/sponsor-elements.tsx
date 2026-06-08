import Link from "next/link"
import Image from "next/image"
import { Trophy } from "lucide-react"

export type PublicSponsor = {
  id: number
  name: string
  level: string | null
  website: string | null
  description: string | null
  tagline: string | null
  logoUrl: string | null
  mainSponsor: boolean
}

function SponsorLogo({ s, className }: { s: PublicSponsor; className?: string }) {
  if (s.logoUrl) {
    return (
      <Image
        src={s.logoUrl || "/placeholder.svg"}
        alt={`${s.name} logo`}
        width={160}
        height={60}
        className={className}
      />
    )
  }
  return <span className="heading text-sm tracking-wide text-foreground">{s.name}</span>
}

/** Title-sponsor lockup shown under the SAPL logo (e.g. in the header / hero). */
export function MainSponsorLockup({
  sponsor,
  className = "",
}: {
  sponsor: PublicSponsor | null
  className?: string
}) {
  if (!sponsor) return null
  const label = sponsor.tagline?.trim() || `by ${sponsor.name}`
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground ${className}`}>
      {label}
    </span>
  )
}

/** Big "Presented by" lockup for the homepage hero. */
export function PresentedBy({ sponsor }: { sponsor: PublicSponsor | null }) {
  if (!sponsor) return null
  const inner = (
    <span className="inline-flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Presented by</span>
      {sponsor.logoUrl ? (
        <SponsorLogo s={sponsor} className="h-8 w-auto object-contain md:h-9" />
      ) : (
        <span className="heading text-lg text-foreground">{sponsor.name}</span>
      )}
    </span>
  )
  return sponsor.website ? (
    <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="inline-block transition hover:opacity-80">
      {inner}
    </a>
  ) : (
    inner
  )
}

/** Sitewide sponsor band — a quiet strip of partner logos. */
export function SponsorBand({ sponsors }: { sponsors: PublicSponsor[] }) {
  if (!sponsors.length) return null
  return (
    <section className="border-y border-border bg-card/40" aria-label="League partners">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 md:flex-row md:justify-between md:px-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Our Partners
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {sponsors.map((s) => {
            const logo = (
              <span className="inline-flex items-center opacity-70 transition hover:opacity-100">
                {s.logoUrl ? (
                  <SponsorLogo s={s} className="h-7 w-auto object-contain md:h-8" />
                ) : (
                  <span className="heading text-sm tracking-wide text-foreground">{s.name}</span>
                )}
              </span>
            )
            return (
              <div key={s.id}>
                {s.website ? (
                  <a href={s.website} target="_blank" rel="noopener noreferrer" aria-label={s.name}>
                    {logo}
                  </a>
                ) : (
                  logo
                )}
              </div>
            )
          })}
        </div>
        <Link
          href="/sponsors"
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary hover:underline"
        >
          View all
        </Link>
      </div>
    </section>
  )
}

/** Prize-pool callout. Always shows whenever an amount is set. */
export function PrizeCallout({
  prizePool,
  sponsor,
}: {
  prizePool: { amount: string; label: string; hasAmount: boolean }
  sponsor: PublicSponsor | null
}) {
  if (!prizePool.hasAmount) return null
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-12 text-center md:px-6">
        <Trophy className="h-8 w-8" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">{prizePool.label}</p>
        <p className="heading text-5xl leading-none md:text-7xl">{prizePool.amount}</p>
        {sponsor ? (
          <p className="text-sm opacity-90">
            Powered by <span className="font-semibold">{sponsor.name}</span>
          </p>
        ) : null}
      </div>
    </section>
  )
}

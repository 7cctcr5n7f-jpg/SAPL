import Image from "next/image"
import { SectionTitle } from "@/components/brand/bits"
import { getSponsors, getMainSponsor, getPrizePool } from "@/lib/queries"
import { PrizeCallout, type PublicSponsor } from "@/components/sponsors/sponsor-elements"
import { ExternalLink, Star } from "lucide-react"

export const metadata = { title: "Sponsors | SAPL" }

const TIER_ORDER = ["Title", "Platinum", "Gold", "Silver", "Partner"]

export default async function SponsorsPage() {
  const [sponsorsRaw, mainSponsorRaw, prizePool] = await Promise.all([
    getSponsors(),
    getMainSponsor(),
    getPrizePool(),
  ])
  const sponsors = sponsorsRaw as unknown as PublicSponsor[]
  const mainSponsor = mainSponsorRaw as unknown as PublicSponsor | null

  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    items: sponsors.filter((s) => (s.level ?? "Partner") === tier),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <SectionTitle eyebrow="Powered By" title="Our Partners" />
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The South African Padel League is made possible by partners who share our commitment to growing competitive
          padel across South Africa.
        </p>

        {/* Main title sponsor highlight */}
        {mainSponsor ? (
          <div className="mt-10 flex flex-col items-center gap-5 border border-primary bg-card p-8 text-center md:p-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              <Star className="h-4 w-4" /> Title Sponsor
            </span>
            {mainSponsor.logoUrl ? (
              <Image
                src={mainSponsor.logoUrl || "/placeholder.svg"}
                alt={`${mainSponsor.name} logo`}
                width={360}
                height={140}
                className="h-24 w-auto object-contain md:h-28"
              />
            ) : (
              <h2 className="heading text-3xl md:text-4xl">{mainSponsor.name}</h2>
            )}
            {mainSponsor.description ? (
              <p className="max-w-2xl text-pretty text-muted-foreground">{mainSponsor.description}</p>
            ) : null}
            {mainSponsor.website ? (
              <a
                href={mainSponsor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Visit site <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-12 flex flex-col gap-12">
          {byTier.map((group) => (
            <div key={group.tier}>
              <h2 className="heading text-xl text-primary">{group.tier} Partners</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((s) => (
                  <div key={s.id} className="flex flex-col gap-3 border border-border bg-card p-6">
                    {s.logoUrl ? (
                      <div className="flex h-16 items-center">
                        <Image
                          src={s.logoUrl || "/placeholder.svg"}
                          alt={`${s.name} logo`}
                          width={220}
                          height={64}
                          className="h-full w-auto max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <h3 className="heading text-lg">{s.name}</h3>
                    )}
                    {s.logoUrl ? <h3 className="heading text-base">{s.name}</h3> : null}
                    {s.description ? <p className="text-sm text-muted-foreground">{s.description}</p> : null}
                    {s.website ? (
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Visit site <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {byTier.length === 0 ? <p className="text-muted-foreground">Partner announcements coming soon.</p> : null}
        </div>
      </div>

      <PrizeCallout prizePool={prizePool} sponsor={mainSponsor} />
    </div>
  )
}

import { SectionTitle } from "@/components/brand/bits"
import { getSponsors } from "@/lib/queries"
import { ExternalLink } from "lucide-react"

export const metadata = { title: "Sponsors | SAPL" }

const TIER_ORDER = ["Title", "Platinum", "Gold", "Silver", "Partner"]

export default async function SponsorsPage() {
  const sponsors = await getSponsors()
  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    items: sponsors.filter((s) => (s.level ?? "Partner") === tier),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <SectionTitle eyebrow="Powered By" title="Our Partners" />
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The South African Padel League is made possible by partners who share our commitment to growing competitive
        padel across South Africa.
      </p>

      <div className="mt-10 flex flex-col gap-12">
        {byTier.map((group) => (
          <div key={group.tier}>
            <h2 className="heading text-xl text-primary">{group.tier} Partners</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((s) => (
                <div key={s.id} className="flex flex-col gap-3 border border-border bg-card p-6">
                  <h3 className="heading text-lg">{s.name}</h3>
                  {s.description ? (
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  ) : null}
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
        {byTier.length === 0 ? (
          <p className="text-muted-foreground">Partner announcements coming soon.</p>
        ) : null}
      </div>
    </div>
  )
}

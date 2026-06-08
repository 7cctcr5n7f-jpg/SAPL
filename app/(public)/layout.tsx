import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { PublicMobileNav } from "@/components/site/public-mobile-nav"
import { getCurrentUser } from "@/lib/session"
import { getMainSponsor, getSponsors } from "@/lib/queries"
import { SponsorBand, type PublicSponsor } from "@/components/sponsors/sponsor-elements"

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [user, mainSponsor, allSponsors] = await Promise.all([getCurrentUser(), getMainSponsor(), getSponsors()])
  const bandSponsors = allSponsors as unknown as PublicSponsor[]
  const sponsorLabel = mainSponsor ? mainSponsor.tagline?.trim() || `by ${mainSponsor.name}` : null

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        user={user ? { name: user.name, email: user.email, role: user.role } : null}
        mainSponsorLabel={sponsorLabel}
      />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <SponsorBand sponsors={bandSponsors} />
      <SiteFooter />
      <PublicMobileNav authed={!!user} />
    </div>
  )
}

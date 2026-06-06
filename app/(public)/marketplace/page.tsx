import { SectionTitle } from "@/components/brand/bits"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getFreeAgents, getClubOptions } from "@/lib/queries"
import { MarketplaceBoard } from "@/components/marketplace/marketplace-board"

export const metadata = { title: "Player Marketplace | SAPL" }

export default async function MarketplacePage() {
  const [players, clubs] = await Promise.all([getFreeAgents(), getClubOptions()])

  const agents = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    gender: p.gender,
    city: p.city,
    province: p.province,
    currentLi: p.currentLi,
    bio: p.bio,
    preferredFormats: (p.preferredFormats ?? []) as string[],
    preferredClubIds: (p.preferredClubIds ?? []) as number[],
    anyClub: p.anyClub,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle eyebrow="Free Agents" title="Player Marketplace" />
        <Button render={<Link href="/sign-up" />}>List Yourself</Button>
      </div>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Captains scouting for their roster — these players are available and looking for a team this season. Browse Men
        and Ladies, then filter by preferred club.
      </p>

      <MarketplaceBoard agents={agents} clubs={clubs} />
    </div>
  )
}

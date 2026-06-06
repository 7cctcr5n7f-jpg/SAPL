import Link from "next/link"
import Image from "next/image"
import { SectionTitle } from "@/components/brand/bits"
import { getPublicClubs } from "@/lib/queries-landing"
import { Building2 } from "lucide-react"

export const metadata = { title: "Clubs | SAPL" }

export default async function ClubsPage() {
  const clubs = await getPublicClubs()

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <SectionTitle eyebrow="Club Performance Index" title="Clubs" />
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every padel club competing in the league, ranked by Club Performance Index on the road to SAPL Club of the
        Year.
      </p>

      {clubs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Clubs will appear here once they are added in the admin portal.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c, i) => (
            <Link
              key={c.id}
              href={c.slug ? `/clubs/${c.slug}` : "/clubs"}
              className="group flex flex-col gap-3 border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className="heading text-3xl text-primary tabular-nums">#{i + 1}</span>
                {c.logoUrl ? (
                  <span className="relative h-12 w-12 overflow-hidden rounded-sm ring-1 ring-border">
                    <Image src={c.logoUrl} alt={`${c.name} logo`} fill className="object-cover" />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-muted text-muted-foreground ring-1 ring-border">
                    <Building2 className="h-5 w-5" />
                  </span>
                )}
              </div>
              <h3 className="heading text-xl group-hover:text-primary">{c.name}</h3>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {c.saplRegion ?? "Tshwane"}
              </div>
              <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
                <div>
                  <div className="heading text-2xl tabular-nums">{Math.round(c.cpi)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">CPI</div>
                </div>
                <span className="text-xs text-muted-foreground">{c.teamCount} teams</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

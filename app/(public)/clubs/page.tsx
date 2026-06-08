import Link from "next/link"
import Image from "next/image"
import { SectionTitle } from "@/components/brand/bits"
import { getPublicClubs } from "@/lib/queries-landing"
import { Building2 } from "lucide-react"

export const metadata = { title: "Clubs | SAPL" }

export default async function ClubsPage() {
  const clubs = await getPublicClubs()

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-12">
      <SectionTitle eyebrow="Club Performance Index" title="Clubs" />
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:mt-3 md:text-base">
        Every padel club competing in the league, ranked by Club Performance Index on the road to SAPL Club of the
        Year.
      </p>

      {clubs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Clubs will appear here once they are added in the admin portal.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:mt-8">
          {clubs.map((c, i) => (
            <Link
              key={c.id}
              href={c.slug ? `/clubs/${c.slug}` : "/clubs"}
              className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary md:p-4"
            >
              <span className="heading w-7 shrink-0 text-2xl text-primary tabular-nums md:text-3xl">{i + 1}</span>
              {c.logoUrl ? (
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm ring-1 ring-border">
                  <Image src={c.logoUrl} alt={`${c.name} logo`} fill className="object-cover" />
                </span>
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground ring-1 ring-border">
                  <Building2 className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="heading truncate text-base group-hover:text-primary md:text-lg">{c.name}</h3>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {c.saplRegion ?? "Tshwane"} · {c.teamCount} teams
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="heading text-xl tabular-nums md:text-2xl">{Math.round(c.cpi)}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">CPI</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

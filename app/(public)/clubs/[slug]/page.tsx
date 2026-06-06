import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Stat, DivisionTag } from "@/components/brand/bits"
import { getClubBySlug } from "@/lib/queries-landing"
import { ArrowLeft, Building2, MapPin, ExternalLink } from "lucide-react"

export default async function ClubDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getClubBySlug(slug)
  if (!data) notFound()
  const { club, teams } = data
  const bestTpr = teams.length ? Math.max(...teams.map((t) => Number(t.tpr ?? 0))) : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <Link href="/clubs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> All clubs
      </Link>

      <div className="mt-6 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end">
        {club.logoUrl ? (
          <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm ring-1 ring-border">
            <Image src={club.logoUrl} alt={`${club.name} logo`} fill className="object-cover" />
          </span>
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground ring-1 ring-border">
            <Building2 className="h-8 w-8" />
          </span>
        )}
        <div>
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-primary">
            <MapPin className="h-3 w-3" /> {club.saplRegion ?? "Tshwane"}
          </span>
          <h1 className="heading mt-2 text-4xl md:text-6xl">{club.name}</h1>
          {club.address ? (
            <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {club.address}
            </div>
          ) : null}
        </div>
      </div>

      {club.description ? <p className="mt-6 max-w-2xl text-muted-foreground">{club.description}</p> : null}

      <div className="grid grid-cols-2 gap-6 border-b border-border py-8 md:grid-cols-4">
        <Stat label="Club Performance Index" value={Math.round(club.cpi)} />
        <Stat label="Teams" value={teams.length} />
        <Stat label="Best Team TPR" value={Math.round(bestTpr)} />
        <Stat label="Courts" value={club.courts || "—"} />
      </div>

      {club.playtomicUrl ? (
        <a
          href={club.playtomicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Book on Playtomic <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}

      <h2 className="heading mt-10 text-2xl">Teams</h2>
      {teams.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No teams play out of this club yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-4">
              <div>
                <Link href={`/teams/${t.id}`} className="font-semibold hover:text-primary">
                  {t.name}
                </Link>
                <div className="mt-1">{t.divisionName ? <DivisionTag name={t.divisionName} /> : null}</div>
              </div>
              <div className="text-right">
                <div className="heading text-xl tabular-nums">{Math.round(Number(t.tpr ?? 0))}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">TPR</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

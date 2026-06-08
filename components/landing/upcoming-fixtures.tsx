import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { UpcomingFixture } from "@/lib/queries-landing"
import { fmtDate } from "@/lib/format"
import { CalendarDays, MapPin } from "lucide-react"
import { Reveal } from "./reveal"

export function UpcomingFixtures({ fixtures }: { fixtures: UpcomingFixture[] }) {
  if (fixtures.length === 0) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Match Night</span>
          <h2 className="heading mt-3 text-4xl text-balance md:text-5xl">Upcoming Fixtures</h2>
        </div>
        <Button render={<Link href="/league-centre" />} variant="outline" size="sm">
          View League Centre
        </Button>
      </Reveal>

      <div className="mt-10 grid gap-px overflow-hidden bg-border/60 md:grid-cols-2 lg:grid-cols-3">
        {fixtures.map((f, i) => (
          <Reveal key={f.id} delay={i * 60} className="flex flex-col gap-5 bg-background p-6 transition-colors hover:bg-card">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>Week {f.week}</span>
              {f.divisionName ? <span className="text-primary">{f.divisionName}</span> : null}
            </div>
            <div className="flex items-center gap-4">
              <span className="heading flex-1 text-xl leading-tight">{f.homeTeamName}</span>
              <span className="heading text-sm text-primary">VS</span>
              <span className="heading flex-1 text-right text-xl leading-tight">{f.awayTeamName}</span>
            </div>
            <div className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(f.matchDate)}
              </span>
              {(f.venue || f.saplRegion) && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> {f.venue ?? f.saplRegion}
                </span>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

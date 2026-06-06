import type { RegionBreakdown } from "@/lib/queries-landing"
import { Reveal } from "./reveal"

export function RegionsSection({ regions }: { regions: RegionBreakdown[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
      <Reveal className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Represent Your Region</span>
        <h2 className="heading mt-3 text-4xl text-balance md:text-6xl">The Battle For Tshwane</h2>
        <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
          Regional champions qualify for the Tshwane Masters. Every club, team and player flies the flag for their
          part of the city.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-px overflow-hidden bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
        {regions.map((r, i) => (
          <Reveal
            key={r.name}
            delay={i * 80}
            className="group relative overflow-hidden bg-background p-7 transition-colors hover:bg-card"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">Tshwane</span>
            <h3 className="heading mt-1 text-3xl leading-none">{r.name.replace("Tshwane ", "")}</h3>
            <div className="mt-8 flex items-end gap-6">
              <div>
                <div className="heading text-4xl tabular-nums leading-none">{r.teams}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Teams</div>
              </div>
              <div>
                <div className="heading text-4xl tabular-nums leading-none">{r.clubs}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Clubs</div>
              </div>
              <div>
                <div className="heading text-4xl tabular-nums leading-none text-primary">{r.players}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Players</div>
              </div>
            </div>
            <span className="absolute bottom-0 left-0 h-1 w-0 bg-primary transition-all duration-500 group-hover:w-full" />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

import { Stat } from "@/components/brand/bits"

export function LeagueCentreHero({
  stats,
}: {
  stats: {
    seasonName: string | null
    teamCount: number
    clubCount: number
    matchesPlayed: number
    matchesRemaining: number
  }
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-card">
      {/* Branded gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 85% 0%, color-mix(in oklch, var(--color-primary) 22%, transparent) 0%, transparent 55%)",
        }}
      />
      {/* Court-line pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {stats.seasonName ?? "SAPL Season"}
        </span>
        <h1 className="mt-3 heading text-4xl text-balance md:text-6xl">League Centre</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground md:text-base">
          Follow the action. Track the standings. View results. See upcoming fixtures.
        </p>

        <div className="mt-6 grid max-w-3xl grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-5">
          <Stat label="Season" value={stats.seasonName ?? "—"} />
          <Stat label="Teams" value={stats.teamCount} />
          <Stat label="Clubs" value={stats.clubCount} />
          <Stat label="Played" value={stats.matchesPlayed} />
          <Stat label="Remaining" value={stats.matchesRemaining} />
        </div>
      </div>
    </section>
  )
}

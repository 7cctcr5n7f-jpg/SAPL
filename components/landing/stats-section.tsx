import Image from "next/image"
import { AnimatedCounter } from "./animated-counter"
import { Reveal } from "./reveal"

type Stats = {
  players: number
  teams: number
  venues: number
  matchesPlayed: number
  foundingClubs: number
  foundingTeams: number
  foundingCompanies: number
}

const PRIMARY = [
  { key: "players", label: "Players Registered" },
  { key: "teams", label: "Teams Registered" },
  { key: "venues", label: "Venues Joined" },
  { key: "matchesPlayed", label: "Matches Played" },
] as const

const FOUNDING = [
  { key: "foundingClubs", label: "Founding Clubs" },
  { key: "foundingTeams", label: "Founding Teams" },
  { key: "foundingCompanies", label: "Founding Companies" },
] as const

export function StatsSection({ stats }: { stats: Stats }) {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/landing/stats-action.png"
        alt=""
        fill
        className="object-cover object-center opacity-40 motion-safe:animate-[heroZoom_24s_ease-in-out_infinite_alternate]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/55 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal className="flex items-center justify-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/80">
            Live League Stats &middot; Growing Every Day
          </span>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 md:mt-16 md:grid-cols-4">
          {PRIMARY.map(({ key, label }, i) => (
            <Reveal
              key={key}
              delay={i * 90}
              className="group relative flex flex-col items-center text-center"
            >
              <AnimatedCounter
                value={stats[key]}
                className="heading text-6xl tabular-nums leading-none text-foreground drop-shadow-[0_2px_30px_rgba(0,0,0,0.6)] sm:text-7xl md:text-8xl"
              />
              <span className="mt-4 h-0.5 w-8 bg-primary transition-all duration-300 group-hover:w-14" />
              <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {label}
              </span>
            </Reveal>
          ))}
        </div>

        <Reveal
          delay={200}
          className="mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4"
        >
          {FOUNDING.map(({ key, label }) => (
            <div key={key} className="flex items-baseline gap-2">
              <AnimatedCounter value={stats[key]} className="heading text-2xl tabular-nums text-primary" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

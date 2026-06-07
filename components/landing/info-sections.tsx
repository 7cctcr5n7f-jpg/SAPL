import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Reveal } from "./reveal"
import {
  Swords,
  ArrowUpDown,
  Flame,
  Trophy,
  BarChart3,
  Crown,
  Globe2,
  Shield,
  Medal,
  Building2,
  Briefcase,
  Users,
  ArrowUp,
  ArrowRight,
  Gauge,
  Activity,
  Target,
  UserPlus,
  Search,
  Clock,
} from "lucide-react"

/* ----------------------------- Section 1: Why SAPL ----------------------------- */

const WHY_FEATURES = [
  { icon: Swords, title: "Team Competition", desc: "Compete as an 8-player squad across four pairings every match night." },
  { icon: ArrowUpDown, title: "Promotion & Relegation", desc: "Win to rise, lose and fall. Every division is earned." },
  { icon: Flame, title: "Regional Rivalries", desc: "Battle rival clubs and companies across Tshwane." },
  { icon: Trophy, title: "Playoffs", desc: "Top teams fight through the playoffs for division glory." },
  { icon: BarChart3, title: "Live Rankings", desc: "TPR, CPI and LI ratings track every team and player." },
  { icon: Crown, title: "Tshwane Masters", desc: "Regional champions meet in the season's showpiece event." },
]

export function WhySapl() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid items-stretch lg:grid-cols-2">
        <div className="relative min-h-[440px] overflow-hidden lg:min-h-[680px]">
          <Image
            src="/landing/celebrate.png"
            alt="A padel team celebrating victory on court under the lights"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:bg-gradient-to-r" />
          <div className="absolute bottom-0 left-0 p-6 md:p-10">
            <span className="heading text-5xl leading-none text-foreground/90 md:text-7xl">This Is</span>
            <span className="heading block text-5xl leading-none text-primary md:text-7xl">SAPL</span>
          </div>
        </div>

        <div className="flex flex-col justify-center px-4 py-16 md:px-12 md:py-20">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Why SAPL</span>
            <h2 className="heading mt-3 text-4xl text-balance md:text-5xl">
              More Than A Match. A Season. A Legacy.
            </h2>
            <p className="mt-5 max-w-xl text-pretty leading-relaxed text-muted-foreground">
              SAPL is South Africa&apos;s structured team-based padel competition designed for clubs, companies and
              private teams. Show up. Fight for points. Climb the divisions.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {WHY_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70} className="flex gap-4">
                <f.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h3 className="heading text-lg leading-tight">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------- Section 2: Road To The Title ------------------------- */

const ROAD = [
  { label: "Challenge", icon: Swords },
  { label: "Shield", icon: Shield },
  { label: "Championship", icon: Medal },
  { label: "Premier", icon: Trophy },
  { label: "Regional Finals", icon: Flame },
  { label: "Tshwane Masters", icon: Crown },
]

export function RoadToTitle() {
  return (
    <section className="relative isolate overflow-hidden border-y border-border/60">
      <Image src="/landing/promotion-action.png" alt="" fill className="object-cover object-top opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/85 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">The Climb</span>
          <h2 className="heading mt-3 text-4xl text-balance md:text-6xl">The Road To The Title</h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Every team starts somewhere. Win. Get promoted. Build a legacy. Six steps stand between you and the
            Tshwane Masters.
          </p>
        </Reveal>

        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-primary/10 via-primary/50 to-primary lg:block" />
          <ol className="relative grid gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
            {ROAD.map((s, i) => {
              const isFinal = i === ROAD.length - 1
              return (
                <Reveal as="li" key={s.label} delay={i * 90} className="flex flex-col items-center text-center">
                  <div
                    className={
                      "flex h-20 w-20 items-center justify-center rounded-full border-2 backdrop-blur " +
                      (isFinal
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_40px_-8px_var(--primary)]"
                        : "border-primary/40 bg-background/80 text-primary")
                    }
                  >
                    <s.icon className="h-8 w-8" />
                  </div>
                  <span className="heading mt-4 text-base leading-tight">{s.label}</span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {isFinal ? "The Crown" : `Stage 0${i + 1}`}
                  </span>
                </Reveal>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* --------------------------- Section 3: Build Your Team -------------------------- */

const TEAM_TYPES = [
  {
    img: "/landing/team-club.png",
    icon: Building2,
    title: "Club Team",
    desc: "Represent your padel club and compete against rival clubs across the city.",
    cta: "Register A Club Team",
    href: "/sign-up",
  },
  {
    img: "/landing/team-company.png",
    icon: Briefcase,
    title: "Company Team",
    desc: "Bring colleagues together and settle the rivalry against other companies.",
    cta: "Register A Company Team",
    href: "/sign-up",
  },
  {
    img: "/landing/team-private.png",
    icon: Users,
    title: "Private Team",
    desc: "Create a team with friends, build your identity and climb the divisions.",
    cta: "Register A Private Team",
    href: "/sign-up",
  },
]

export function BuildYourTeam() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
      <Reveal className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Build Your Team</span>
        <h2 className="heading mt-3 text-4xl text-balance md:text-6xl">Create Your Team. Your Way.</h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {TEAM_TYPES.map((t, i) => (
          <Reveal key={t.title} delay={i * 110}>
            <Link
              href={t.href}
              className="group relative isolate flex min-h-[480px] flex-col justify-end overflow-hidden"
            >
              <Image
                src={t.img || "/placeholder.svg"}
                alt={t.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
              <div className="absolute inset-0 ring-1 ring-inset ring-foreground/5 transition-colors group-hover:ring-primary/60" />
              <div className="relative p-7">
                <t.icon className="h-7 w-7 text-primary" />
                <h3 className="heading mt-4 text-3xl">{t.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-foreground">
                  {t.cta}
                  <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ----------------------- Section 4: What Does A Team Look Like ------------------- */

const CATEGORIES = [
  { name: "Mens Beginner", li: "Avg up to 2.5 LI", group: "Mens" },
  { name: "Mens Intermediate", li: "Avg up to 3.5 LI", group: "Mens" },
  { name: "Mens Open", li: "Avg over 3.5 LI", group: "Mens" },
  { name: "Ladies Open", li: "Any LI", group: "Ladies" },
]

export function TeamComposition() {
  return (
    <section className="border-y border-border/60 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Squad Structure</span>
            <h2 className="heading mt-3 text-4xl text-balance md:text-6xl">
              8 Players. 4 Pairings. 1 Goal.
            </h2>
            <p className="mt-5 max-w-md text-pretty leading-relaxed text-muted-foreground">
              Each SAPL team fields 8 players: three mens pairings split by average League Index, plus one open ladies
              pairing. Every pairing earns points for the team.
            </p>
            <div className="mt-10 flex gap-10">
              {[
                { v: "4", l: "Pairings" },
                { v: "8", l: "Players" },
                { v: "1", l: "Team" },
              ].map((s) => (
                <div key={s.l} className="border-l-2 border-primary pl-4">
                  <div className="heading text-5xl tabular-nums">{s.v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {CATEGORIES.map((c) => (
                <li key={c.name} className="flex items-center justify-between py-5">
                  <span className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-primary">{c.group}</span>
                    <span className="heading text-xl md:text-2xl">{c.name}</span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="heading text-lg tabular-nums text-primary md:text-xl">{c.li}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* --------------------------- Section 5: Match Night ----------------------------- */

const SESSIONS = [
  {
    no: "01",
    label: "Session 1",
    support: { name: "Mens Beginner", tag: "Avg up to 2.5 LI" },
    main: { name: "Mens Intermediate", tag: "Avg up to 3.5 LI" },
  },
  {
    no: "02",
    label: "Session 2",
    support: { name: "Ladies Open", tag: "Any LI" },
    main: { name: "Mens Open", tag: "Avg over 3.5 LI" },
  },
]

export function MatchNight() {
  return (
    <section className="relative isolate overflow-hidden border-y border-border/60">
      <Image
        src="/landing/match-night.png"
        alt=""
        fill
        className="object-cover object-center opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/85 to-background" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">How A Match Night Works</span>
          <h2 className="heading mt-3 text-4xl text-balance md:text-6xl">Thursday Night Lights</h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            Two sessions, four pairings. Each session has a headline <span className="text-foreground">Main Game</span>{" "}
            and a supporting fixture &mdash; or all four pairings hit the courts at once when the venue has the space.
          </p>
        </Reveal>

        {/* Session cards */}
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {SESSIONS.map((s, i) => (
            <Reveal key={s.label} delay={i * 110}>
              <div className="relative flex h-full flex-col bg-card/70 p-6 ring-1 ring-inset ring-border/60 backdrop-blur md:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {s.label}
                  </span>
                  <span className="heading text-5xl leading-none text-foreground/10 md:text-6xl">{s.no}</span>
                </div>

                {/* Main game */}
                <div className="mt-5 flex items-center justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground shadow-[0_0_40px_-12px_var(--primary)]">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-80">Main Game</div>
                    <div className="heading mt-1 text-2xl leading-none md:text-3xl">{s.main.name}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-widest opacity-90">
                    {s.main.tag}
                  </span>
                </div>

                {/* Supporting game */}
                <div className="mt-3 flex items-center justify-between gap-4 border border-border/60 px-5 py-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                      Supporting Game
                    </div>
                    <div className="heading mt-1 text-xl leading-none md:text-2xl">{s.support.name}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {s.support.tag}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Format + scoring strip */}
        <Reveal delay={150} className="mt-5 flex flex-col gap-6 bg-card/70 p-6 ring-1 ring-inset ring-border/60 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <Clock className="h-6 w-6 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Flexible format.</span> Run two back-to-back sessions, or
              play all four pairings simultaneously &mdash; it depends on the courts available at the venue.
            </p>
          </div>
          <div className="flex shrink-0 gap-8 border-t border-border/60 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <div className="flex items-baseline gap-2">
              <span className="heading text-4xl tabular-nums text-primary">1</span>
              <span className="max-w-[7rem] text-xs leading-tight text-muted-foreground">Point per set won</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="heading text-4xl tabular-nums text-primary">+1</span>
              <span className="max-w-[7rem] text-xs leading-tight text-muted-foreground">Bonus for match winner</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* -------------------------- Section 6: The Season Journey ------------------------ */

const JOURNEY = [
  "Round-Robin Weeks",
  "Five To Seven Match Nights",
  "Play Every Rival",
  "Promotion & Relegation",
  "Regional Finals",
  "Tshwane Masters",
]

export function SeasonJourney() {
  return (
    <section className="border-y border-border/60 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">The Season Journey</span>
          <h2 className="heading mt-3 text-4xl text-balance md:text-5xl">5&ndash;7 Weeks. One Goal.</h2>
          <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Divisions run 6&ndash;8 teams, so the regular season spans 5 to 7 match nights before the finals and the
            Tshwane Masters.
          </p>
        </Reveal>

        <div className="relative mt-14">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border lg:left-0 lg:right-0 lg:top-3 lg:bottom-auto lg:h-px lg:w-full" />
          <ol className="relative grid gap-y-8 lg:grid-cols-6">
            {JOURNEY.map((step, i) => {
              const isFinal = i >= 5
              return (
                <Reveal
                  as="li"
                  key={step}
                  delay={i * 70}
                  className="relative flex items-center gap-4 pl-10 lg:flex-col lg:pl-0 lg:text-center"
                >
                  <span
                    className={
                      "absolute left-2 h-3 w-3 -translate-x-1/2 rounded-full lg:static lg:translate-x-0 " +
                      (isFinal ? "bg-primary shadow-[0_0_16px_var(--primary)]" : "bg-foreground/60")
                    }
                  />
                  <div className="lg:mt-4">
                    <span
                      className={"heading block text-2xl tabular-nums " + (isFinal ? "text-primary" : "text-muted-foreground")}
                    >
                      {i < 5 ? `0${i + 1}` : <Crown className="h-6 w-6 lg:mx-auto" />}
                    </span>
                    <span className="heading mt-1 block text-sm leading-tight">{step}</span>
                  </div>
                </Reveal>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ----------------------- Section 8: Promotion & Relegation ---------------------- */

const LADDER = ["Premier", "Championship", "Shield", "Challenge"]

export function PromotionRelegation() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid items-stretch lg:grid-cols-2">
        <div className="relative min-h-[420px] overflow-hidden lg:min-h-[640px]">
          <Image
            src="/landing/promotion-action.png"
            alt="A padel player leaping to smash overhead"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:bg-gradient-to-r" />
        </div>

        <div className="flex flex-col justify-center px-4 py-16 md:px-12 md:py-20">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Promotion &amp; Relegation</span>
            <h2 className="heading mt-3 text-4xl text-balance md:text-6xl">Every Match Matters</h2>
            <ul className="mt-6 flex flex-col gap-3 text-muted-foreground">
              {[
                "Top teams fight for promotion",
                "Bottom teams fight for survival",
                "No meaningless matches",
                "Every season has consequences",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <ArrowUp className="h-4 w-4 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120} className="mt-10 flex flex-col gap-2">
            {LADDER.map((d, i) => (
              <div
                key={d}
                className={
                  "flex items-center justify-between px-5 py-4 transition-colors " +
                  (i === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-secondary")
                }
                style={{ marginLeft: `${i * 1.5}rem` }}
              >
                <span className="heading text-lg">{d}</span>
                {i === 0 ? <Crown className="h-5 w-5" /> : <ArrowUp className="h-4 w-4 text-primary" />}
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------ Section 9: Rankings & Ratings ------------------------- */

const RATINGS = [
  { icon: Gauge, abbr: "TPR", title: "Team Power Rating", desc: "An ELO-style ranking that rises and falls with every result." },
  { icon: Activity, abbr: "CPI", title: "Club Performance Index", desc: "Measures club strength using the performance of its top teams." },
  { icon: Target, abbr: "LI", title: "League Index", desc: "Drives player eligibility and balances divisions across categories." },
]

export function RankingsRatings() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
      <Reveal className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">The Numbers</span>
        <h2 className="heading mt-3 text-4xl text-balance md:text-5xl">Ratings That Drive The League</h2>
      </Reveal>

      <div className="mt-12 grid gap-px overflow-hidden bg-border/60 sm:grid-cols-3">
        {RATINGS.map((r, i) => (
          <Reveal key={r.abbr} delay={i * 90} className="relative overflow-hidden bg-background p-8">
            <span className="heading pointer-events-none absolute -right-2 -top-4 text-8xl text-primary/10">
              {r.abbr}
            </span>
            <r.icon className="h-7 w-7 text-primary" />
            <h3 className="heading mt-5 text-2xl">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* --------------------------- Section 10: Founding Season ------------------------- */

const ROADMAP = ["Tshwane Launch", "Regional Expansion", "Provincial Expansion", "National Championship"]

export function FoundingSeason() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image src="/landing/founding.png" alt="" fill className="object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/60" />

      <div className="relative mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
        <Reveal className="max-w-3xl">
          <span className="inline-flex items-center gap-2 border border-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Founding Season
          </span>
          <h2 className="heading mt-6 text-5xl text-balance md:text-7xl">
            Become A <span className="text-primary">Founding</span> Team
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            SAPL launches in Tshwane first. The journey starts here, with expansion planned across South Africa. Write
            your name into the history of the league.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((step, i) => (
            <Reveal key={step} delay={i * 90} className="border-l-2 border-primary/40 pl-5">
              <span className="heading text-4xl tabular-nums text-primary/40">0{i + 1}</span>
              <p className="heading mt-2 text-lg leading-tight">{step}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="mt-12 flex flex-wrap gap-3">
          <Button render={<Link href="/sign-up" />} size="lg">
            Register Founding Team
          </Button>
          <Button render={<Link href="/sign-up" />} size="lg" variant="outline">
            Register Founding Club
          </Button>
          <Button render={<Link href="/sign-up" />} size="lg" variant="outline">
            Register Founding Company
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

/* ----------------------------- Section 11: No Team ------------------------------ */

export function NoTeam() {
  return (
    <section className="border-y border-border/60 bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-16 md:flex-row md:items-center md:justify-between md:px-6 md:py-20">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">No Team? No Problem.</span>
          <h2 className="heading mt-3 text-4xl text-balance md:text-5xl">Looking For A Team?</h2>
          <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Register individually and get noticed. Captains can recruit you, teams can send invitations, and you can
            request to join any team.
          </p>
        </Reveal>
        <Reveal delay={120} className="flex shrink-0 flex-wrap gap-3">
          <Button render={<Link href="/marketplace" />} size="lg">
            <Search className="h-4 w-4" /> Find A Team
          </Button>
          <Button render={<Link href="/sign-up" />} size="lg" variant="outline">
            <UserPlus className="h-4 w-4" /> Register As Player
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------- Final CTA -------------------------------------- */

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/cta-padel-arena.png"
        alt=""
        fill
        className="object-cover opacity-40 motion-safe:animate-[heroZoom_24s_ease-in-out_infinite_alternate]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/60" />
      <div className="relative mx-auto max-w-7xl px-4 py-28 text-center md:px-6 md:py-40">
        <Reveal>
          <h2 className="heading mx-auto max-w-4xl text-5xl text-balance md:text-7xl lg:text-8xl">
            Build Your Team. <span className="text-primary">Climb</span> The Divisions.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            The South African Padel League is launching in Tshwane. Be part of the founding season.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/sign-up" />} size="lg">
              Register Team
            </Button>
            <Button render={<Link href="/sign-up" />} size="lg" variant="outline">
              Register As Player
            </Button>
            <Button render={<Link href="/rankings" />} size="lg" variant="outline">
              View Rankings
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

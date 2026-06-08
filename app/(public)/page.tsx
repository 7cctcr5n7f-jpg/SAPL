import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getCurrentSeason, getTeamRankings, getMainSponsor, getPrizePool } from "@/lib/queries"
import {
  getLandingStats,
  getRegionBreakdown,
  getFeaturedClubs,
  getPublicClubs,
  getUpcomingFixtures,
} from "@/lib/queries-landing"
import { StatsSection } from "@/components/landing/stats-section"
import { RegionsSection } from "@/components/landing/regions-section"
import { FeaturedClubs } from "@/components/landing/featured-clubs"
import { UpcomingFixtures } from "@/components/landing/upcoming-fixtures"
import { LatestRankings } from "@/components/landing/latest-rankings"
import {
  WhySapl,
  RoadToTitle,
  BuildYourTeam,
  TeamComposition,
  MatchNight,
  SeasonJourney,
  PromotionRelegation,
  RankingsRatings,
  FoundingSeason,
  NoTeam,
  FinalCta,
} from "@/components/landing/info-sections"
import { PresentedBy, PrizeCallout, type PublicSponsor } from "@/components/sponsors/sponsor-elements"

export default async function HomePage() {
  const season = await getCurrentSeason()
  const [stats, regions, featuredClubs, rankings, topClubs, upcoming, mainSponsor, prizePool] = await Promise.all([
    getLandingStats(),
    getRegionBreakdown(),
    getFeaturedClubs(),
    getTeamRankings(5),
    getPublicClubs(5),
    season ? getUpcomingFixtures(season.id, 6) : Promise.resolve([]),
    getMainSponsor(),
    getPrizePool(),
  ])
  const sponsor = mainSponsor as unknown as PublicSponsor | null

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[88vh] items-end overflow-hidden">
        <Image
          src="/hero-padel.png"
          alt="Padel player smashing under stadium lights"
          fill
          priority
          className="scale-105 object-cover opacity-60 motion-safe:animate-[heroZoom_18s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-32 md:px-6 md:pb-28 md:pt-40">
          <span className="inline-flex items-center gap-2 border border-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            {season?.name ?? "Season"} &middot; Tshwane &middot; Now Recruiting
          </span>
          <h1 className="heading mt-6 max-w-4xl text-balance text-6xl leading-[0.9] md:text-8xl lg:text-9xl">
            THE PINNACLE OF <span className="text-primary">PADEL</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-xl font-semibold text-foreground">
            South Africa&apos;s Team-Based Padel Competition.
          </p>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            Promotion. Relegation. Rankings. Playoffs. Represent your club. Represent your company. Build your legacy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button render={<Link href="/sign-up" />} size="lg">
              Join the League
            </Button>
            <Button render={<Link href="/rankings" />} size="lg" variant="outline">
              View Rankings
            </Button>
          </div>
          {sponsor ? (
            <div className="mt-10">
              <PresentedBy sponsor={sponsor} />
            </div>
          ) : null}
        </div>
      </section>

      <PrizeCallout prizePool={prizePool} sponsor={sponsor} />
      <StatsSection stats={stats} />
      <WhySapl />
      <RoadToTitle />
      <BuildYourTeam />
      <TeamComposition />
      <MatchNight />
      <SeasonJourney />
      <RegionsSection regions={regions} />
      <PromotionRelegation />
      <RankingsRatings />
      <FoundingSeason />
      <NoTeam />
      <FeaturedClubs clubs={featuredClubs} />
      <UpcomingFixtures fixtures={upcoming} />
      <LatestRankings teams={rankings} clubs={topClubs} />
      <FinalCta />
    </>
  )
}

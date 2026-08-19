import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getConferenceLeaders, getCurrentSeason, getMainSponsor, getPrizePool, getSponsors, getTeamRankings } from "@/lib/queries"
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
import { PartneredBy, PresentedBy, PrizeCallout, type PublicSponsor } from "@/components/sponsors/sponsor-elements"
import { ArticleCard } from "@/components/news/article-card"
import { getFeaturedOrLatestPublishedArticle, getLatestPublishedArticles, getNewsMatchOfWeekFixtureId } from "@/lib/queries-news"

export default async function HomePage() {
  const season = await getCurrentSeason()
  const [stats, regions, featuredClubs, conferenceLeaders, rankings, topClubs, upcoming, mainSponsor, allSponsors, prizePool, featuredStory, selectedMatchOfWeekFixtureId] = await Promise.all([
    getLandingStats(),
    getRegionBreakdown(),
    getFeaturedClubs(),
    getConferenceLeaders(12),
    getTeamRankings(5),
    getPublicClubs(5),
    season ? getUpcomingFixtures(season.id, 60) : Promise.resolve([]),
    getMainSponsor(),
    getSponsors(),
    getPrizePool(),
    getFeaturedOrLatestPublishedArticle(),
    getNewsMatchOfWeekFixtureId(),
  ])
  const latestStories = await getLatestPublishedArticles(6, featuredStory?.id)
  const sponsor = mainSponsor as unknown as PublicSponsor | null
  const partners = (allSponsors as unknown as PublicSponsor[]).filter((s) => !s.mainSponsor)
  const featuredPublished = featuredStory?.publishedAt ?? featuredStory?.createdAt ?? null
  const matchOfTheWeek = (selectedMatchOfWeekFixtureId
    ? upcoming.find((fixture) => fixture.id === selectedMatchOfWeekFixtureId)
    : null) ?? upcoming[0] ?? null

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-8 md:px-6 md:pt-10">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151515] via-[#101010] to-[#171717]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 md:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
                <span>{featuredStory?.categoryName ?? "SAPL Editorial"}</span>
                <span className="h-1 w-1 rounded-full bg-red-300" />
                <span>Featured</span>
              </div>
              <h1 className="mt-5 text-balance text-3xl font-extrabold leading-tight text-white md:text-5xl">
                {featuredStory?.title ?? "The Pinnacle of Padel"}
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-300 md:text-base">
                {featuredStory?.excerpt ?? "South Africa's team-based padel competition — live stories, previews, and match-week insight."}
              </p>
              <p className="mt-4 text-sm text-slate-400">
                {featuredPublished ? new Date(featuredPublished).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "Latest update"}
                {featuredStory?.authorName ? ` · ${featuredStory.authorName}` : ""}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button render={<Link href={featuredStory ? `/news/${featuredStory.slug}` : "/news"} />} size="lg">
                  Read Story
                </Button>
                <Button render={<Link href="/news" />} size="lg" variant="outline">
                  More News
                </Button>
              </div>
            </div>

            {featuredStory?.featuredImage ? (
              <div className="relative min-h-[260px] border-t border-white/10 bg-black/30 lg:min-h-full lg:border-l lg:border-t-0">
                <Image
                  src={featuredStory.featuredImage}
                  alt={featuredStory.featuredImageAlt || featuredStory.title}
                  fill
                  priority
                  className="object-contain p-4 md:p-6"
                />
              </div>
            ) : (
              <div className="hidden items-end justify-end border-l border-white/10 bg-[radial-gradient(circle_at_70%_20%,rgba(239,68,68,0.25),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.1),transparent_40%)] p-8 lg:flex">
                <p className="max-w-[18rem] text-right text-sm font-medium uppercase tracking-[0.15em] text-slate-300">
                  Match-week stories, previews and highlights
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#121212] px-6 py-5">
          {sponsor ? (
            <div>
              <PresentedBy sponsor={sponsor} />
            </div>
          ) : null}
          <div className={sponsor && partners.length > 0 ? "mt-3" : ""}>
            <PartneredBy sponsors={partners} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Latest SAPL Stories</h2>
          <Link href="/news" className="text-sm font-semibold text-red-600 hover:text-red-700">View all →</Link>
        </div>
        {latestStories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestStories.map((article) => (
              <ArticleCard key={article.id} article={article} compact />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-[#121212] px-4 py-8 text-sm text-slate-300">No published stories yet. Check back soon.</p>
        )}
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 md:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">This Week in SAPL</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Match of the Week</p>
              {matchOfTheWeek ? (
                <>
                  <p className="mt-2 text-lg font-bold text-white">
                    {matchOfTheWeek.homeTeamName ?? "TBD"} vs {matchOfTheWeek.awayTeamName ?? "TBD"}
                  </p>
                  <p className="text-sm text-slate-300">
                    Week {matchOfTheWeek.week}
                    {matchOfTheWeek.matchDate ? ` · ${new Date(matchOfTheWeek.matchDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                  </p>
                  <p className="text-sm text-slate-300">{matchOfTheWeek.venue ?? "Venue TBC"}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-300">Fixtures will appear once published.</p>
              )}
              <Button render={<Link href="/league-centre" />} variant="outline" className="mt-4">View fixtures</Button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Conference Leaders</p>
              <ol className="mt-2 space-y-2 text-sm text-slate-200">
                {conferenceLeaders.slice(0, 3).map((team) => (
                  <li key={team.teamId} className="flex items-center justify-between gap-3">
                    <span>
                      {team.divisionName ?? "Conference"}: {team.teamName}
                    </span>
                    <span className="font-semibold">{team.tpr.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
              <Button render={<Link href="/league-centre" />} variant="outline" className="mt-4">Full standings</Button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">League Centre</p>
              <p className="mt-2 text-sm text-slate-300">
                Live fixtures, standings, and match details are updated throughout the season.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button render={<Link href="/league-centre" />}>Open League Centre</Button>
                <Button render={<Link href="/news" />} variant="outline">Read previews</Button>
              </div>
            </div>
          </div>
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

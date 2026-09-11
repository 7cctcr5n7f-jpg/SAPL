import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getConferenceLeaders, getCurrentSeason, getDonutFactoryLeaders, getFixtureCategoryMatchups, getMainSponsor, getPrizePool, getSponsors, getTeamRankings } from "@/lib/queries"
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

function shortConferenceName(name: string | null | undefined) {
  if (!name) return "Conference"
  return name
    .replace(/\s+conference$/i, "")
    .replace(/^northern$/i, "North")
    .replace(/^southern$/i, "South")
    .replace(/^eastern$/i, "East")
    .replace(/^western$/i, "West")
}

function conferenceIndicator(name: string | null | undefined) {
  const normalized = (name ?? "").toLowerCase().trim()
  if (normalized.includes("north")) return "N"
  if (normalized.includes("south")) return "S"
  if (normalized.includes("east")) return "E"
  return "N"
}

function genderIndicator(category: string | null | undefined) {
  const value = (category ?? "").toLowerCase()
  if (value.includes("ladies") || value.includes("women")) return { label: "♀", className: "text-pink-300" }
  if (value.includes("mens") || value.includes("men")) return { label: "♂", className: "text-sky-300" }
  return { label: "•", className: "text-slate-300" }
}

export default async function HomePage() {
  const season = await getCurrentSeason()
  const [stats, regions, featuredClubs, conferenceLeaders, donutLeaders, rankings, topClubs, upcoming, mainSponsor, allSponsors, prizePool, featuredStory, selectedMatchOfWeekFixtureId] = await Promise.all([
    getLandingStats(),
    getRegionBreakdown(),
    getFeaturedClubs(),
    getConferenceLeaders(8),
    getDonutFactoryLeaders(10),
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
  const matchOfWeekCategories = matchOfTheWeek ? await getFixtureCategoryMatchups(matchOfTheWeek.id) : []

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
              <div className="relative aspect-[4/3] max-h-[240px] w-full overflow-hidden border-t border-white/10 bg-black/30 sm:aspect-[16/10] sm:max-h-[320px] lg:min-h-full lg:max-h-none lg:border-l lg:border-t-0 lg:aspect-auto">
                <Image
                  src={featuredStory.featuredImage}
                  alt={featuredStory.featuredImageAlt || featuredStory.title}
                  fill
                  priority
                  className="object-contain p-3 sm:p-4 md:p-6"
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
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {latestStories.map((article) => (
              <div key={article.id} className="min-w-[300px] max-w-[300px] shrink-0 sm:min-w-[340px] sm:max-w-[340px]">
                <ArticleCard article={article} compact />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-[#121212] px-4 py-8 text-sm text-slate-300">No published stories yet. Check back soon.</p>
        )}
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 md:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#121212] p-4 md:p-5">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">This Week in SAPL</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Match of the Week</p>
              {matchOfTheWeek ? (
                <>
                  <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-black/40 sm:h-12 sm:w-12">
                        {matchOfTheWeek.homeTeamLogoUrl ? (
                          <Image src={matchOfTheWeek.homeTeamLogoUrl} alt={`${matchOfTheWeek.homeTeamName ?? "Home"} logo`} fill className="object-cover" />
                        ) : null}
                        </div>
                        <span className="text-sm font-bold leading-tight text-white">{matchOfTheWeek.homeTeamName ?? "TBD"}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-3xl font-black uppercase tracking-[0.14em] text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">VS</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-black/40 sm:h-12 sm:w-12">
                        {matchOfTheWeek.awayTeamLogoUrl ? (
                          <Image src={matchOfTheWeek.awayTeamLogoUrl} alt={`${matchOfTheWeek.awayTeamName ?? "Away"} logo`} fill className="object-cover" />
                        ) : null}
                        </div>
                        <span className="text-sm font-bold leading-tight text-white">{matchOfTheWeek.awayTeamName ?? "TBD"}</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {matchOfTheWeek.matchDate ? new Date(matchOfTheWeek.matchDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "Date TBC"}
                  </p>
                  <p className="text-sm text-slate-300">{matchOfTheWeek.venue ?? "Venue TBC"}</p>
                  <div className="mt-2 space-y-1.5 rounded-md border border-white/10 bg-black/25 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category battles</p>
                    {matchOfWeekCategories.length > 0 ? (
                      matchOfWeekCategories.map((rubber) => (
                        <div key={`${rubber.category}-${rubber.homePair}-${rubber.awayPair}`} className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300">{rubber.category}</p>
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <p className="text-right text-xs text-slate-100">{rubber.homePair || "TBC"}</p>
                            <span className="text-xs font-bold uppercase tracking-wide text-red-400">VS</span>
                            <p className="text-left text-xs text-slate-100">{rubber.awayPair || "TBC"}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-300">Player pairings to be announced.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-300">Fixtures will appear once published.</p>
              )}
              <Button render={<Link href="/league-centre" />} variant="outline" className="mt-3 h-9 px-3">View fixtures</Button>
            </div>

            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950/25 via-white/[0.02] to-emerald-950/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Playoff Race</p>
              <ol className="mt-2 space-y-1.5 text-sm text-slate-200">
                {conferenceLeaders.slice(0, 8).map((team, index) => (
                  <li key={team.teamId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1">
                    <span className="min-w-0">
                      <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                        conferenceIndicator(team.conference) === "N" ? "border-sky-400/50 bg-sky-500/20 text-sky-200" :
                        conferenceIndicator(team.conference) === "S" ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200" :
                        "border-amber-400/50 bg-amber-500/20 text-amber-200"
                      }`}>
                        {conferenceIndicator(team.conference)}
                      </span>
                      <span className="mr-2 text-slate-400">{index + 1}.</span>
                      <span className="truncate">{team.teamName}</span>
                    </span>
                    <span className="font-semibold">{team.points}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-[11px] text-slate-300">Top 2 per conference + 2 best third-place teams</p>
              <Button render={<Link href="/league-centre" />} variant="outline" className="mt-3 h-9 px-3">Full standings</Button>
            </div>

            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-amber-950/20 via-white/[0.02] to-orange-950/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">🍩 Donut Factory</p>
              <ol className="mt-2 space-y-0.5 text-sm text-slate-200">
                {donutLeaders.length > 0 ? (
                  donutLeaders.map((entry, index) => (
                    <li key={`${entry.teamId}-${entry.category}-${entry.pairLabel}-${index}`} className="grid grid-cols-[20px_1fr_auto] items-center gap-1.5 border-b border-white/10 py-1 last:border-b-0">
                      <span className="text-xs text-slate-400">{index + 1}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`text-sm ${genderIndicator(entry.category).className}`}>{genderIndicator(entry.category).label}</span>
                        {entry.teamLogoUrl ? (
                          <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/30">
                            <Image src={entry.teamLogoUrl} alt={entry.teamName} fill className="object-cover" />
                          </span>
                        ) : null}
                        <span className={`truncate text-sm ${genderIndicator(entry.category).className}`}>{entry.pairLabel || "Unknown pair"}</span>
                      </span>
                      <span className="text-sm font-semibold">{entry.donuts}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-300">No 6–0 sets recorded yet.</li>
                )}
              </ol>
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

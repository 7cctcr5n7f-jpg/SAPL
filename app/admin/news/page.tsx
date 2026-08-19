import { requirePermissionPage } from "@/lib/access"
import { PageHeader } from "@/components/dashboard/page-header"
import { NewsManager } from "@/components/admin/news-manager"
import { getCurrentSeason } from "@/lib/queries"
import { getUpcomingFixtures } from "@/lib/queries-landing"
import { getNewsAdminArticles, getNewsCategoriesWithCounts, getNewsMatchOfWeekFixtureId } from "@/lib/queries-news"

export const dynamic = "force-dynamic"

export default async function AdminNewsPage() {
  await requirePermissionPage("league_management")
  const season = await getCurrentSeason()
  const [categories, articles, selectedMatchOfWeekFixtureId, upcomingFixtures] = await Promise.all([
    getNewsCategoriesWithCounts(),
    getNewsAdminArticles(),
    getNewsMatchOfWeekFixtureId(),
    season ? getUpcomingFixtures(season.id, 60) : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="News & Articles"
        subtitle="Create weekly stories, predictions, match previews, and featured editorial content for SAPL."
      />
      <NewsManager
        categories={categories}
        articles={articles}
        selectedMatchOfWeekFixtureId={selectedMatchOfWeekFixtureId}
        upcomingFixtures={upcomingFixtures}
      />
    </div>
  )
}

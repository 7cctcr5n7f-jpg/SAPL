import Link from "next/link"
import { getFeaturedOrLatestPublishedArticle, getLatestPublishedArticles } from "@/lib/queries-news"
import { ArticleCard } from "@/components/news/article-card"

export const dynamic = "force-dynamic"

export default async function NewsPage() {
  const featured = await getFeaturedOrLatestPublishedArticle()
  const latest = await getLatestPublishedArticles(12, featured?.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
        <div>
          <h1 className="heading text-4xl text-white md:text-5xl">SAPL News</h1>
          <p className="mt-1 text-sm text-slate-300">Latest stories, previews, predictions, and league updates.</p>
        </div>
      </div>

      {featured ? (
        <section className="mb-8">
          <ArticleCard article={featured} />
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Latest Stories</h2>
          <Link href="/league-centre" className="text-sm font-semibold text-red-600 hover:text-red-700">
            League Centre →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-[#121212] px-4 py-8 text-sm text-slate-300">No published stories yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

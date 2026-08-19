import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArticleCard } from "@/components/news/article-card"
import { NewsRichContent } from "@/components/news/news-rich-content"
import { getPublishedNewsArticleBySlug, getRelatedPublishedArticles } from "@/lib/queries-news"

type Params = { slug: string }

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedNewsArticleBySlug(slug)
  if (!article) return { title: "Story not found" }
  const title = article.metaTitle || article.title
  const description = article.metaDescription || article.excerpt || "Latest SAPL editorial coverage."
  const image = article.featuredImage || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
      type: "article",
    },
  }
}

export default async function NewsArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const article = await getPublishedNewsArticleBySlug(slug)
  if (!article) notFound()
  const related = await getRelatedPublishedArticles(article, 3)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Link href="/news" className="text-sm font-semibold text-red-600 hover:text-red-700">
        ← Back to News
      </Link>
      <article className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#121212]">
        {article.featuredImage ? (
          <div className="relative aspect-[16/8]">
            <Image src={article.featuredImage} alt={article.featuredImageAlt || article.title} fill className="object-cover" />
          </div>
        ) : null}
        <div className="space-y-4 p-6 md:p-8">
          {article.categoryName ? (
            <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-red-700">
              {article.categoryName}
            </span>
          ) : null}
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">{article.title}</h1>
          {article.excerpt ? <p className="text-lg text-slate-300">{article.excerpt}</p> : null}
          <p className="text-sm text-slate-400">
            {formatDate(article.publishedAt ?? article.createdAt)}
            {article.authorName ? ` · ${article.authorName}` : ""}
            {article.readTime ? ` · ${article.readTime} min read` : ""}
          </p>
          <NewsRichContent content={article.content} />
        </div>
      </article>

      {related.length > 0 ? (
        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-bold text-white">Related Stories</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

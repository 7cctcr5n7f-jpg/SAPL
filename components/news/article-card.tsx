import Link from "next/link"
import Image from "next/image"
import type { NewsArticleSummary } from "@/lib/queries-news"

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function ArticleCard({
  article,
  compact = false,
}: {
  article: NewsArticleSummary
  compact?: boolean
}) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className={`group overflow-hidden rounded-xl border border-white/10 bg-[#121212] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg ${compact ? "" : "md:grid md:grid-cols-[340px_1fr]"}`}
    >
      {article.featuredImage ? (
        <div className={compact ? "relative aspect-[16/10]" : "relative h-56 md:h-full"}>
          <Image
            src={article.featuredImage}
            alt={article.featuredImageAlt || article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <div className="space-y-2 p-4">
        {article.categoryName ? (
          <span className="inline-flex rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
            {article.categoryName}
          </span>
        ) : null}
        <h3 className={compact ? "line-clamp-2 text-base font-bold text-white" : "line-clamp-2 text-lg font-bold text-white"}>
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className={compact ? "line-clamp-2 text-sm text-slate-300" : "line-clamp-3 text-sm text-slate-300"}>{article.excerpt}</p>
        ) : null}
        <p className="text-xs text-slate-400">
          {formatDate(article.publishedAt ?? article.createdAt)}
          {article.authorName ? ` · ${article.authorName}` : ""}
        </p>
      </div>
    </Link>
  )
}

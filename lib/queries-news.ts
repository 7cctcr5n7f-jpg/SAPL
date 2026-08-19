import "server-only"

import { db } from "@/lib/db"
import { newsArticles, newsCategories, settings } from "@/lib/db/schema"
import { and, asc, desc, eq, ne, sql } from "drizzle-orm"

export type NewsArticleSummary = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  featuredImage: string | null
  featuredImageAlt: string | null
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  authorName: string | null
  status: string
  featured: boolean
  publishedAt: string | null
  createdAt: string
}

export type NewsArticleDetail = NewsArticleSummary & {
  content: string
  metaTitle: string | null
  metaDescription: string | null
  tags: string[]
  readTime: number | null
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

export async function getNewsMatchOfWeekFixtureId() {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "news_match_of_week_fixture_id"))
      .limit(1)
    const raw = (row?.value ?? "").trim()
    if (!raw) return null
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch (error) {
    console.error("[news] getNewsMatchOfWeekFixtureId failed:", error)
    return null
  }
}

export async function getNewsCategories() {
  try {
    return await db
      .select({
        id: newsCategories.id,
        name: newsCategories.name,
        slug: newsCategories.slug,
        createdAt: newsCategories.createdAt,
        updatedAt: newsCategories.updatedAt,
      })
      .from(newsCategories)
      .orderBy(asc(newsCategories.name))
  } catch (error) {
    console.error("[news] getNewsCategories failed:", error)
    return []
  }
}

export async function getNewsCategoriesWithCounts() {
  try {
    const rows = await db
      .select({
        id: newsCategories.id,
        name: newsCategories.name,
        slug: newsCategories.slug,
        publishedCount: sql<number>`count(${newsArticles.id})::int`,
      })
      .from(newsCategories)
      .leftJoin(
        newsArticles,
        and(eq(newsArticles.categoryId, newsCategories.id), eq(newsArticles.status, "published")),
      )
      .groupBy(newsCategories.id)
      .orderBy(asc(newsCategories.name))
    return rows
  } catch (error) {
    console.error("[news] getNewsCategoriesWithCounts failed:", error)
    return []
  }
}

export async function getNewsAdminArticles() {
  try {
    const rows = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      slug: newsArticles.slug,
      excerpt: newsArticles.excerpt,
      featuredImage: newsArticles.featuredImage,
      featuredImageAlt: newsArticles.featuredImageAlt,
      categoryId: newsArticles.categoryId,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      authorName: newsArticles.authorName,
      status: newsArticles.status,
      featured: newsArticles.featured,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
      content: newsArticles.content,
      metaTitle: newsArticles.metaTitle,
      metaDescription: newsArticles.metaDescription,
      tags: newsArticles.tags,
      readTime: newsArticles.readTime,
    })
    .from(newsArticles)
    .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
    .orderBy(desc(newsArticles.updatedAt), desc(newsArticles.createdAt))

    return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    featuredImage: row.featuredImage,
    featuredImageAlt: row.featuredImageAlt,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    authorName: row.authorName,
    status: row.status,
    featured: row.featured,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    content: row.content,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [],
    readTime: row.readTime,
    }))
  } catch (error) {
    console.error("[news] getNewsAdminArticles failed:", error)
    return []
  }
}

export async function getPublishedNewsArticleBySlug(slug: string): Promise<NewsArticleDetail | null> {
  try {
    const [row] = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      slug: newsArticles.slug,
      excerpt: newsArticles.excerpt,
      content: newsArticles.content,
      featuredImage: newsArticles.featuredImage,
      featuredImageAlt: newsArticles.featuredImageAlt,
      categoryId: newsArticles.categoryId,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      authorName: newsArticles.authorName,
      status: newsArticles.status,
      featured: newsArticles.featured,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
      metaTitle: newsArticles.metaTitle,
      metaDescription: newsArticles.metaDescription,
      tags: newsArticles.tags,
      readTime: newsArticles.readTime,
    })
    .from(newsArticles)
    .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
    .where(and(eq(newsArticles.slug, slug), eq(newsArticles.status, "published")))
    .limit(1)

    if (!row) return null
    return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    featuredImage: row.featuredImage,
    featuredImageAlt: row.featuredImageAlt,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    authorName: row.authorName,
    status: row.status,
    featured: row.featured,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [],
    readTime: row.readTime,
    }
  } catch (error) {
    console.error("[news] getPublishedNewsArticleBySlug failed:", error)
    return null
  }
}

export async function getFeaturedOrLatestPublishedArticle(): Promise<NewsArticleSummary | null> {
  try {
    const [featured] = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      slug: newsArticles.slug,
      excerpt: newsArticles.excerpt,
      featuredImage: newsArticles.featuredImage,
      featuredImageAlt: newsArticles.featuredImageAlt,
      categoryId: newsArticles.categoryId,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      authorName: newsArticles.authorName,
      status: newsArticles.status,
      featured: newsArticles.featured,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
    })
    .from(newsArticles)
    .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
    .where(and(eq(newsArticles.status, "published"), eq(newsArticles.featured, true)))
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
    .limit(1)

  const row = featured
    ? featured
    : (
        await db
          .select({
            id: newsArticles.id,
            title: newsArticles.title,
            slug: newsArticles.slug,
            excerpt: newsArticles.excerpt,
            featuredImage: newsArticles.featuredImage,
            featuredImageAlt: newsArticles.featuredImageAlt,
            categoryId: newsArticles.categoryId,
            categoryName: newsCategories.name,
            categorySlug: newsCategories.slug,
            authorName: newsArticles.authorName,
            status: newsArticles.status,
            featured: newsArticles.featured,
            publishedAt: newsArticles.publishedAt,
            createdAt: newsArticles.createdAt,
          })
          .from(newsArticles)
          .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
          .where(eq(newsArticles.status, "published"))
          .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
          .limit(1)
      )[0]

    if (!row) return null
    return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    featuredImage: row.featuredImage,
    featuredImageAlt: row.featuredImageAlt,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    authorName: row.authorName,
    status: row.status,
    featured: row.featured,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    }
  } catch (error) {
    console.error("[news] getFeaturedOrLatestPublishedArticle failed:", error)
    return null
  }
}

export async function getLatestPublishedArticles(limit = 6, excludeId?: number): Promise<NewsArticleSummary[]> {
  try {
    const rows = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      slug: newsArticles.slug,
      excerpt: newsArticles.excerpt,
      featuredImage: newsArticles.featuredImage,
      featuredImageAlt: newsArticles.featuredImageAlt,
      categoryId: newsArticles.categoryId,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      authorName: newsArticles.authorName,
      status: newsArticles.status,
      featured: newsArticles.featured,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
    })
    .from(newsArticles)
    .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
    .where(
      excludeId != null
        ? and(eq(newsArticles.status, "published"), ne(newsArticles.id, excludeId))
        : eq(newsArticles.status, "published"),
    )
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
    .limit(limit)

    return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    featuredImage: row.featuredImage,
    featuredImageAlt: row.featuredImageAlt,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    authorName: row.authorName,
    status: row.status,
    featured: row.featured,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    }))
  } catch (error) {
    console.error("[news] getLatestPublishedArticles failed:", error)
    return []
  }
}

export async function getRelatedPublishedArticles(article: NewsArticleDetail, limit = 3): Promise<NewsArticleSummary[]> {
  try {
    const sameCategory = article.categoryId != null
    ? await db
        .select({
          id: newsArticles.id,
          title: newsArticles.title,
          slug: newsArticles.slug,
          excerpt: newsArticles.excerpt,
          featuredImage: newsArticles.featuredImage,
          featuredImageAlt: newsArticles.featuredImageAlt,
          categoryId: newsArticles.categoryId,
          categoryName: newsCategories.name,
          categorySlug: newsCategories.slug,
          authorName: newsArticles.authorName,
          status: newsArticles.status,
          featured: newsArticles.featured,
          publishedAt: newsArticles.publishedAt,
          createdAt: newsArticles.createdAt,
        })
        .from(newsArticles)
        .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
        .where(
          and(
            eq(newsArticles.status, "published"),
            eq(newsArticles.categoryId, article.categoryId),
            ne(newsArticles.id, article.id),
          ),
        )
        .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
        .limit(limit)
    : []

    if (sameCategory.length >= limit) {
      return sameCategory.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      featuredImage: row.featuredImage,
      featuredImageAlt: row.featuredImageAlt,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      authorName: row.authorName,
      status: row.status,
      featured: row.featured,
      publishedAt: iso(row.publishedAt),
      createdAt: iso(row.createdAt) ?? new Date().toISOString(),
      }))
    }

    const remainder = limit - sameCategory.length
    const recent = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      slug: newsArticles.slug,
      excerpt: newsArticles.excerpt,
      featuredImage: newsArticles.featuredImage,
      featuredImageAlt: newsArticles.featuredImageAlt,
      categoryId: newsArticles.categoryId,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      authorName: newsArticles.authorName,
      status: newsArticles.status,
      featured: newsArticles.featured,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
    })
    .from(newsArticles)
    .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
    .where(and(eq(newsArticles.status, "published"), ne(newsArticles.id, article.id)))
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
    .limit(Math.max(6, remainder))

    const byId = new Map<number, NewsArticleSummary>()
    for (const row of [...sameCategory, ...recent]) {
      if (byId.has(row.id)) continue
      byId.set(row.id, {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      featuredImage: row.featuredImage,
      featuredImageAlt: row.featuredImageAlt,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      authorName: row.authorName,
      status: row.status,
      featured: row.featured,
      publishedAt: iso(row.publishedAt),
      createdAt: iso(row.createdAt) ?? new Date().toISOString(),
      })
    }
    return [...byId.values()].slice(0, limit)
  } catch (error) {
    console.error("[news] getRelatedPublishedArticles failed:", error)
    return []
  }
}

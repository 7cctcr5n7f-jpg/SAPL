"use server"

import { and, eq, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { newsArticles, newsCategories, settings } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function estimateReadTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (!words) return 1
  return Math.max(1, Math.ceil(words / 220))
}

async function requireLeagueAdmin() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  if (user.realRole !== "super_admin" && user.realRole !== "league_admin") {
    throw new Error("League admin access required")
  }
  return user
}

function revalidateNewsSurfaces() {
  revalidatePath("/")
  revalidatePath("/news")
  revalidatePath("/admin/news")
}

async function ensureUniqueCategorySlug(base: string, currentId?: number) {
  let candidate = base
  let suffix = 2
  while (true) {
    const existing = await db
      .select({ id: newsCategories.id })
      .from(newsCategories)
      .where(currentId ? and(eq(newsCategories.slug, candidate), ne(newsCategories.id, currentId)) : eq(newsCategories.slug, candidate))
      .limit(1)
    if (!existing[0]) return candidate
    candidate = `${base}-${suffix++}`
  }
}

async function ensureUniqueArticleSlug(base: string, currentId?: number) {
  let candidate = base
  let suffix = 2
  while (true) {
    const existing = await db
      .select({ id: newsArticles.id })
      .from(newsArticles)
      .where(currentId ? and(eq(newsArticles.slug, candidate), ne(newsArticles.id, currentId)) : eq(newsArticles.slug, candidate))
      .limit(1)
    if (!existing[0]) return candidate
    candidate = `${base}-${suffix++}`
  }
}

export async function upsertNewsCategory(formData: FormData) {
  await requireLeagueAdmin()
  const id = formData.get("id") ? Number(formData.get("id")) : null
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { ok: false, error: "Category name is required." }

  const baseSlug = slugify(String(formData.get("slug") ?? "").trim() || name)
  if (!baseSlug) return { ok: false, error: "Category slug is invalid." }
  const slug = await ensureUniqueCategorySlug(baseSlug, id ?? undefined)

  if (id) {
    await db.update(newsCategories).set({ name, slug, updatedAt: new Date() }).where(eq(newsCategories.id, id))
  } else {
    await db.insert(newsCategories).values({ name, slug })
  }
  revalidateNewsSurfaces()
  return { ok: true }
}

export async function deleteNewsCategory(id: number) {
  await requireLeagueAdmin()
  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsArticles)
    .where(eq(newsArticles.categoryId, id))
  if ((usage?.count ?? 0) > 0) {
    return { ok: false, error: "Category has linked articles. Move or delete those articles first." }
  }
  await db.delete(newsCategories).where(eq(newsCategories.id, id))
  revalidateNewsSurfaces()
  return { ok: true }
}

export async function upsertNewsArticle(formData: FormData) {
  const me = await requireLeagueAdmin()
  const id = formData.get("id") ? Number(formData.get("id")) : null
  const title = String(formData.get("title") ?? "").trim()
  const content = String(formData.get("content") ?? "").trim()
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null
  const featuredImage = String(formData.get("featuredImage") ?? "").trim() || null
  const featuredImageAlt = String(formData.get("featuredImageAlt") ?? "").trim() || null
  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null
  const authorName = String(formData.get("authorName") ?? "").trim() || "SAPL Editorial"
  const statusRaw = String(formData.get("status") ?? "draft").trim().toLowerCase()
  const status = statusRaw === "published" ? "published" : "draft"
  const featured = formData.get("featured") === "on" || formData.get("featured") === "true"
  const metaTitle = String(formData.get("metaTitle") ?? "").trim() || null
  const metaDescription = String(formData.get("metaDescription") ?? "").trim() || null
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  const publishedAtRaw = String(formData.get("publishedAt") ?? "").trim()
  const publishedAt = status === "published"
    ? (publishedAtRaw ? new Date(publishedAtRaw) : new Date())
    : null

  if (!title) return { ok: false, error: "Title is required." }
  if (!content) return { ok: false, error: "Article content is required." }

  const baseSlug = slugify(String(formData.get("slug") ?? "").trim() || title)
  if (!baseSlug) return { ok: false, error: "Article slug is invalid." }
  const slug = await ensureUniqueArticleSlug(baseSlug, id ?? undefined)

  if (featured && status === "published") {
    await db.update(newsArticles).set({ featured: false }).where(eq(newsArticles.featured, true))
  }

  const payload = {
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    featuredImageAlt,
    categoryId,
    authorName,
    status,
    featured: featured && status === "published",
    publishedAt,
    metaTitle,
    metaDescription,
    tags,
    readTime: estimateReadTime(content),
    updatedByUserId: me.id,
    updatedAt: new Date(),
  }

  if (id) {
    await db.update(newsArticles).set(payload).where(eq(newsArticles.id, id))
  } else {
    await db.insert(newsArticles).values({
      ...payload,
      createdByUserId: me.id,
    })
  }

  revalidateNewsSurfaces()
  return { ok: true }
}

export async function deleteNewsArticle(id: number) {
  await requireLeagueAdmin()
  const [article] = await db.select({ slug: newsArticles.slug }).from(newsArticles).where(eq(newsArticles.id, id)).limit(1)
  await db.delete(newsArticles).where(eq(newsArticles.id, id))
  revalidateNewsSurfaces()
  if (article?.slug) revalidatePath(`/news/${article.slug}`)
  return { ok: true }
}

export async function setNewsArticleFeatured(id: number, featured: boolean) {
  await requireLeagueAdmin()
  const [article] = await db.select({ id: newsArticles.id, status: newsArticles.status, slug: newsArticles.slug }).from(newsArticles).where(eq(newsArticles.id, id)).limit(1)
  if (!article) return { ok: false, error: "Article not found." }
  if (featured && article.status !== "published") return { ok: false, error: "Only published articles can be featured." }

  if (featured) {
    await db.update(newsArticles).set({ featured: false }).where(eq(newsArticles.featured, true))
  }
  await db.update(newsArticles).set({ featured, updatedAt: new Date() }).where(eq(newsArticles.id, id))
  revalidateNewsSurfaces()
  if (article.slug) revalidatePath(`/news/${article.slug}`)
  return { ok: true }
}

export async function setNewsMatchOfWeekFixture(fixtureId: number | null) {
  await requireLeagueAdmin()
  if (fixtureId != null && (!Number.isInteger(fixtureId) || fixtureId <= 0)) {
    return { ok: false, error: "Invalid fixture selection." }
  }
  const value = fixtureId == null ? "" : String(fixtureId)
  await db
    .insert(settings)
    .values({ key: "news_match_of_week_fixture_id", value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
  revalidateNewsSurfaces()
  return { ok: true }
}

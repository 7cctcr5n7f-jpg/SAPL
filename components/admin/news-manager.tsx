"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NewsImageUploader } from "@/components/admin/news-image-uploader"
import {
  deleteNewsArticle,
  deleteNewsCategory,
  setNewsArticleFeatured,
  setNewsMatchOfWeekFixture,
  upsertNewsArticle,
  upsertNewsCategory,
} from "@/lib/actions/news"
import type { NewsArticleDetail } from "@/lib/queries-news"
import type { UpcomingFixture } from "@/lib/queries-landing"
import { Trash2, Pencil, Plus } from "lucide-react"

type CategoryRow = { id: number; name: string; slug: string; publishedCount: number }

type EditableArticle = NewsArticleDetail

function toLocalDatetime(value: string | null) {
  if (!value) return ""
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function NewsManager({
  categories,
  articles,
  upcomingFixtures,
  selectedMatchOfWeekFixtureId,
}: {
  categories: CategoryRow[]
  articles: EditableArticle[]
  upcomingFixtures: UpcomingFixture[]
  selectedMatchOfWeekFixtureId: number | null
}) {
  const [pending, startTransition] = useTransition()
  const [categoryName, setCategoryName] = useState("")
  const [categorySlug, setCategorySlug] = useState("")
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)
  const [editingArticle, setEditingArticle] = useState<EditableArticle | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [search, setSearch] = useState("")
  const [matchOfWeekFixtureId, setMatchOfWeekFixtureId] = useState<string>(selectedMatchOfWeekFixtureId ? String(selectedMatchOfWeekFixtureId) : "")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((article) =>
      article.title.toLowerCase().includes(q) ||
      article.slug.toLowerCase().includes(q) ||
      (article.categoryName ?? "").toLowerCase().includes(q),
    )
  }, [articles, search])

  function submitCategory() {
    startTransition(async () => {
      const formData = new FormData()
      if (editingCategory) formData.set("id", String(editingCategory.id))
      formData.set("name", categoryName)
      formData.set("slug", categorySlug)
      const res = await upsertNewsCategory(formData)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editingCategory ? "Category updated" : "Category added")
      setCategoryName("")
      setCategorySlug("")
      setEditingCategory(null)
    })
  }

  function removeCategory(id: number) {
    startTransition(async () => {
      const res = await deleteNewsCategory(id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Category deleted")
    })
  }

  function openNewArticle() {
    setEditingArticle(null)
    setImageUrl("")
    setDialogOpen(true)
  }

  function openEditArticle(article: EditableArticle) {
    setEditingArticle(article)
    setImageUrl(article.featuredImage ?? "")
    setDialogOpen(true)
  }

  function submitArticle(formData: FormData) {
    formData.set("featuredImage", imageUrl)
    startTransition(async () => {
      const res = await upsertNewsArticle(formData)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editingArticle ? "Article updated" : "Article created")
      setDialogOpen(false)
      setEditingArticle(null)
      setImageUrl("")
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Homepage spotlight</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="matchOfWeekFixtureId">Match of the week</Label>
          <div className="flex flex-col gap-2 md:flex-row">
            <select
              id="matchOfWeekFixtureId"
              value={matchOfWeekFixtureId}
              onChange={(e) => setMatchOfWeekFixtureId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Auto-select next fixture</option>
              {upcomingFixtures.map((fixture) => (
                <option key={fixture.id} value={String(fixture.id)}>
                  Week {fixture.week} · {fixture.homeTeamName ?? "TBD"} vs {fixture.awayTeamName ?? "TBD"}
                </option>
              ))}
            </select>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const fixtureId = matchOfWeekFixtureId ? Number(matchOfWeekFixtureId) : null
                  const res = await setNewsMatchOfWeekFixture(fixtureId)
                  if (!res.ok) {
                    toast.error("error" in res ? res.error : "Failed to save match of the week")
                    return
                  }
                  toast.success("Match of the week updated")
                })
              }
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={categoryName}
              placeholder="Category name"
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <Input
              value={categorySlug}
              placeholder="Slug (optional)"
              onChange={(e) => setCategorySlug(e.target.value)}
            />
            <Button disabled={pending || !categoryName.trim()} onClick={submitCategory}>
              {editingCategory ? "Save category" : "Add category"}
            </Button>
          </div>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-muted-foreground">/{category.slug} · {category.publishedCount} published</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingCategory(category)
                      setCategoryName(category.name)
                      setCategorySlug(category.slug)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => removeCategory(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Articles</CardTitle>
          <Button className="gap-2" onClick={openNewArticle}>
            <Plus className="h-4 w-4" />
            New article
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." />
          <div className="space-y-2">
            {filtered.map((article) => (
              <div key={article.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{article.title}</p>
                    <Badge variant={article.status === "published" ? "default" : "secondary"}>
                      {article.status}
                    </Badge>
                    {article.featured ? <Badge className="bg-red-600 text-white">Featured</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /news/{article.slug}
                    {article.categoryName ? ` · ${article.categoryName}` : ""}
                    {article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleDateString("en-ZA")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || article.status !== "published"}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await setNewsArticleFeatured(article.id, !article.featured)
                        if (!res.ok) toast.error(res.error)
                        else toast.success(article.featured ? "Featured removed" : "Marked as featured")
                      })
                    }
                  >
                    {article.featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditArticle(article)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteNewsArticle(article.id)
                        toast.success("Article deleted")
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Edit article" : "New article"}</DialogTitle>
          </DialogHeader>
          <form action={submitArticle} className="space-y-4">
            {editingArticle ? <input type="hidden" name="id" value={String(editingArticle.id)} /> : null}
            <div className="space-y-2">
              <Label>Featured image</Label>
              <NewsImageUploader value={imageUrl} onChange={setImageUrl} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required defaultValue={editingArticle?.title ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" defaultValue={editingArticle?.slug ?? ""} placeholder="auto-from-title" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category</Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={editingArticle?.categoryId ? String(editingArticle.categoryId) : ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="authorName">Author</Label>
                <Input id="authorName" name="authorName" defaultValue={editingArticle?.authorName ?? "SAPL Editorial"} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt / summary</Label>
              <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={editingArticle?.excerpt ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Article content (Markdown-style)</Label>
              <Textarea id="content" name="content" required rows={14} defaultValue={editingArticle?.content ?? ""} />
              <p className="text-xs text-muted-foreground">
                Supports headings (##), bold (**text**), italic (*text*), bullet/numbered lists, links [text](url), quotes (&gt;), and images ![alt](url).
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={editingArticle?.status ?? "draft"}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishedAt">Publish date/time</Label>
                <Input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={toLocalDatetime(editingArticle?.publishedAt ?? null)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta title</Label>
                <Input id="metaTitle" name="metaTitle" defaultValue={editingArticle?.metaTitle ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta description</Label>
                <Input id="metaDescription" name="metaDescription" defaultValue={editingArticle?.metaDescription ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" defaultValue={editingArticle?.tags.join(", ") ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="featuredImageAlt">Featured image alt text</Label>
              <Input id="featuredImageAlt" name="featuredImageAlt" defaultValue={editingArticle?.featuredImageAlt ?? ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={editingArticle?.featured ?? false}
                className="h-4 w-4 rounded border-border"
              />
              Mark as featured (published articles only)
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {editingArticle ? "Save article" : "Create article"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

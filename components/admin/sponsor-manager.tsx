"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  upsertLeagueSponsor,
  removeLeagueSponsor,
  toggleLeagueSponsorActive,
  updatePrizePool,
} from "@/lib/actions/sponsors"
import { SponsorLogoUploader } from "@/components/admin/sponsor-logo-uploader"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, ExternalLink, Star, Trophy, ImageIcon } from "lucide-react"

export type LeagueSponsor = {
  id: number
  name: string
  level: string | null
  website: string | null
  description: string | null
  tagline: string | null
  logoUrl: string | null
  mainSponsor: boolean
  active: boolean
}

const LEVELS = ["Title", "Platinum", "Gold", "Silver", "Partner"]

export function SponsorManager({
  sponsors,
  prizePool,
}: {
  sponsors: LeagueSponsor[]
  prizePool: { amount: string; label: string }
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<LeagueSponsor | null>(null)
  const [open, setOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [mainSponsor, setMainSponsor] = useState(false)

  function openNew() {
    setEditing(null)
    setLogoUrl("")
    setMainSponsor(false)
    setOpen(true)
  }
  function openEdit(s: LeagueSponsor) {
    setEditing(s)
    setLogoUrl(s.logoUrl ?? "")
    setMainSponsor(s.mainSponsor)
    setOpen(true)
  }

  function save(formData: FormData) {
    formData.set("logoUrl", logoUrl)
    formData.set("mainSponsor", mainSponsor ? "true" : "false")
    start(async () => {
      const res = await upsertLeagueSponsor(formData)
      if (res?.error) toast.error(res.error)
      else {
        toast.success(editing ? "Sponsor updated" : "Sponsor added")
        setOpen(false)
      }
    })
  }

  function savePrize(formData: FormData) {
    start(async () => {
      const res = await updatePrizePool(formData)
      if (res?.error) toast.error(res.error)
      else toast.success("Prize pool saved")
    })
  }

  return (
    <div className="space-y-6">
      {/* Prize pool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" /> Prize Pool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={savePrize} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="prizePool">Amount</Label>
              <Input
                id="prizePool"
                name="prizePool"
                defaultValue={prizePool.amount}
                placeholder="R250 000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prizePoolLabel">Label</Label>
              <Input
                id="prizePoolLabel"
                name="prizePoolLabel"
                defaultValue={prizePool.label}
                placeholder="Total Prize Pool"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Leave the amount empty to hide the prize callout. It always shows when set, regardless of season status.
          </p>
        </CardContent>
      </Card>

      {/* Sponsors */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">League Sponsors</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button size="sm" onClick={openNew}>
                  <Plus className="mr-1 h-4 w-4" /> Add sponsor
                </Button>
              }
            />
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit sponsor" : "Add league sponsor"}</DialogTitle>
              </DialogHeader>
              <form action={save} className="space-y-4">
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <SponsorLogoUploader value={logoUrl} onChange={setLogoUrl} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Sponsor name</Label>
                  <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Tier</Label>
                  <Select name="level" defaultValue={editing?.level ?? "Partner"}>
                    <SelectTrigger id="level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline (shown under the SAPL logo)</Label>
                  <Input id="tagline" name="tagline" placeholder="by Acme Corp" defaultValue={editing?.tagline ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" type="url" placeholder="https://" defaultValue={editing?.website ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Main title sponsor</p>
                    <p className="text-xs text-muted-foreground">
                      Featured under the SAPL logo and as &quot;Presented by&quot; on the homepage. Only one at a time.
                    </p>
                  </div>
                  <Switch checked={mainSponsor} onCheckedChange={setMainSponsor} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving..." : editing ? "Save changes" : "Add sponsor"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {sponsors.length === 0 && <p className="text-sm text-muted-foreground">No league sponsors yet.</p>}
          {sponsors.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-secondary">
                  {s.logoUrl ? (
                    <Image src={s.logoUrl || "/placeholder.svg"} alt={`${s.name} logo`} width={80} height={48} className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <Badge variant="outline">{s.level ?? "Partner"}</Badge>
                    {s.mainSponsor && (
                      <Badge className="gap-1">
                        <Star className="h-3 w-3" /> Main
                      </Badge>
                    )}
                    {!s.active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  {s.website && (
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> {s.website}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.active}
                    disabled={pending}
                    onCheckedChange={(c) =>
                      start(async () => {
                        await toggleLeagueSponsorActive(s.id, c)
                        toast.success(c ? "Sponsor visible" : "Sponsor hidden")
                      })
                    }
                    aria-label="Toggle sponsor visibility"
                  />
                  <span className="text-xs text-muted-foreground">Visible</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit sponsor">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData()
                    fd.set("id", String(s.id))
                    start(async () => {
                      await removeLeagueSponsor(fd)
                      toast.success("Sponsor removed")
                    })
                  }}
                  aria-label="Remove sponsor"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

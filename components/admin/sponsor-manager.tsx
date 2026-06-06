"use client"

import { useState, useTransition } from "react"
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
import { upsertLeagueSponsor, removeLeagueSponsor, toggleLeagueSponsorActive } from "@/lib/actions/sponsors"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, ExternalLink } from "lucide-react"

export type LeagueSponsor = {
  id: number
  name: string
  level: string | null
  website: string | null
  description: string | null
  active: boolean
}

const LEVELS = ["Title", "Platinum", "Gold", "Silver", "Partner"]

export function SponsorManager({ sponsors }: { sponsors: LeagueSponsor[] }) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<LeagueSponsor | null>(null)
  const [open, setOpen] = useState(false)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(s: LeagueSponsor) {
    setEditing(s)
    setOpen(true)
  }

  function save(formData: FormData) {
    start(async () => {
      const res = await upsertLeagueSponsor(formData)
      if (res?.error) toast.error(res.error)
      else {
        toast.success(editing ? "Sponsor updated" : "Sponsor added")
        setOpen(false)
      }
    })
  }

  return (
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit sponsor" : "Add league sponsor"}</DialogTitle>
            </DialogHeader>
            <form action={save} className="space-y-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}
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
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" type="url" placeholder="https://" defaultValue={editing?.website ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
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
          <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{s.name}</span>
                <Badge variant="outline">{s.level ?? "Partner"}</Badge>
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
  )
}

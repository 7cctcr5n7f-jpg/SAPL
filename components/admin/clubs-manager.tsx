"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import {
  Building2,
  MapPin,
  Trophy,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Check,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VenueImageUploader } from "@/components/admin/venue-image-uploader"
import { SAPL_REGIONS, clampHostingCapacity } from "@/lib/constants"
import { saveClub, deleteClub } from "@/lib/actions/clubs"
import type { ClubRow } from "@/lib/queries-clubs"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const EMPTY = {
  id: undefined as number | undefined,
  name: "",
  description: "",
  address: "",
  saplRegion: "",
  courts: 0,
  hostingCapacity: 0,
  hostsThursday: true,
  teamsEntering: 0,
  logoUrl: "",
  playtomicUrl: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
}

type FormState = typeof EMPTY

export function ClubsManager({ clubs }: { clubs: ClubRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [capacityTouched, setCapacityTouched] = useState(false)
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>("all")

  const filtered = useMemo(
    () => (regionFilter === "all" ? clubs : clubs.filter((c) => c.saplRegion === regionFilter)),
    [clubs, regionFilter],
  )

  function openCreate() {
    setForm({ ...EMPTY })
    setCapacityTouched(false)
    setOpen(true)
  }

  function openEdit(c: ClubRow) {
    setForm({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      address: c.address ?? "",
      saplRegion: c.saplRegion ?? "",
      courts: c.courts,
      hostingCapacity: c.hostingCapacity,
      hostsThursday: c.hostsThursday,
      teamsEntering: c.teamsEntering,
      logoUrl: c.logoUrl ?? "",
      playtomicUrl: c.playtomicUrl ?? "",
      contactName: c.contactName ?? "",
      contactEmail: c.contactEmail ?? "",
      contactPhone: c.contactPhone ?? "",
    })
    setCapacityTouched(true)
    setOpen(true)
  }

  function setCourts(courts: number) {
    setForm((f) => ({
      ...f,
      courts,
      // Capacity auto-tracks courts unless the manager has lowered it; either
      // way it can never exceed the court count.
      hostingCapacity: capacityTouched ? clampHostingCapacity(courts, f.hostingCapacity) : courts,
    }))
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Venue name is required")
      return
    }
    startTransition(async () => {
      const res = await saveClub({
        id: form.id,
        name: form.name,
        description: form.description,
        address: form.address,
        saplRegion: form.saplRegion,
        courts: form.courts,
        hostingCapacity: form.hostingCapacity,
        hostsThursday: form.hostsThursday,
        teamsEntering: form.teamsEntering,
        logoUrl: form.logoUrl,
        playtomicUrl: form.playtomicUrl,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      })
      if (res.ok) {
        toast.success(form.id ? "Venue updated" : "Venue created")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not save venue")
      }
    })
  }

  function remove(c: ClubRow) {
    if (!confirm(`Delete ${c.name}? Teams using it will be detached from this venue.`)) return
    setDeletingId(c.id)
    startTransition(async () => {
      const res = await deleteClub(c.id)
      if (res.ok) {
        toast.success("Venue deleted")
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not delete venue")
      }
      setDeletingId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="heading text-xl">Venues</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Venue
        </Button>
      </div>

      {/* Region filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={regionFilter === "all"} onClick={() => setRegionFilter("all")}>
          All regions
        </FilterChip>
        {SAPL_REGIONS.map((r) => (
          <FilterChip key={r} active={regionFilter === r} onClick={() => setRegionFilter(r)}>
            {r.replace("Tshwane ", "")}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {clubs.length === 0
            ? "No venues yet. Add your first venue to start assigning home clubs."
            : "No venues in this region."}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {filtered.map((c) => (
            <ClubRowItem
              key={c.id}
              club={c}
              onEdit={() => openEdit(c)}
              onDelete={() => remove(c)}
              deleting={deletingId === c.id}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Venue" : "Add Venue"}</DialogTitle>
            <DialogDescription>
              Hosting capacity is set automatically from the court count (one fixture uses all 4 courts across
              two nightly slots). You can lower it, but never raise it above the number of courts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Venue name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>

            <Field label="SAPL region">
              <Select
                value={form.saplRegion || ""}
                onValueChange={(v) => setForm((f) => ({ ...f, saplRegion: v ?? "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {SAPL_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Courts">
                <Input
                  type="number"
                  min={0}
                  value={form.courts}
                  onChange={(e) => setCourts(Number(e.target.value))}
                />
              </Field>
              <Field label="Hosting capacity">
                <Input
                  type="number"
                  min={0}
                  max={form.courts}
                  value={form.hostingCapacity}
                  onChange={(e) => {
                    setCapacityTouched(true)
                    setForm((f) => ({ ...f, hostingCapacity: clampHostingCapacity(f.courts, Number(e.target.value)) }))
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Auto: {form.courts} (= courts). Lower only.
                </p>
              </Field>
            </div>

            <Field label="Teams this venue will enter">
              <Input
                type="number"
                min={0}
                value={form.teamsEntering}
                onChange={(e) => setForm((f) => ({ ...f, teamsEntering: Number(e.target.value) }))}
              />
              {!form.id && form.teamsEntering > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {form.teamsEntering} team{form.teamsEntering > 1 ? "s" : ""} will be created automatically.
                  {form.hostsThursday
                    ? " This venue will be set as their home club."
                    : " They will have no home club until one is picked under Team Admin."}
                </p>
              ) : null}
            </Field>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Hosts on Thursday nights</p>
                <p className="text-xs text-muted-foreground">Eligible to host league fixtures</p>
              </div>
              <Switch
                checked={form.hostsThursday}
                onCheckedChange={(v) => setForm((f) => ({ ...f, hostsThursday: v }))}
              />
            </div>

            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Field>

            <Field label="Playtomic URL">
              <Input
                placeholder="https://playtomic.io/..."
                value={form.playtomicUrl}
                onChange={(e) => setForm((f) => ({ ...f, playtomicUrl: e.target.value }))}
              />
            </Field>

            <Field label="Venue image">
              <VenueImageUploader
                value={form.logoUrl}
                onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Contact name">
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                />
              </Field>
              <Field label="Contact email">
                <Input
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : form.id ? "Save changes" : "Create venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function CapacityStat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="text-right">
      <p className={cn("text-sm font-semibold tabular-nums", className)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ClubRowItem({
  club,
  onEdit,
  onDelete,
  deleting,
}: {
  club: ClubRow
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const full = club.hosts && club.hostingCapacity > 0 && club.remaining === 0
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-secondary/30">
      {/* Logo */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
        {club.logoUrl ? (
          <Image src={club.logoUrl || "/placeholder.svg"} alt="" width={36} height={36} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Name + region */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{club.name}</p>
          {club.hostsThursday ? (
            <span
              title="Hosts on Thursday nights"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
            >
              <Check className="h-3 w-3" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {club.saplRegion ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {club.saplRegion.replace("Tshwane ", "")}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" /> {club.courts} courts
          </span>
          {club.teamsEntering > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {club.teamsEntering} entering
            </span>
          ) : null}
          {club.playtomicUrl ? (
            <a
              href={club.playtomicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Playtomic
            </a>
          ) : null}
        </div>
      </div>

      {/* Capacity breakdown: Capacity · Assigned · Remaining */}
      {club.hosts ? (
        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          <CapacityStat label="Capacity" value={club.hostingCapacity} />
          <CapacityStat label="Assigned" value={club.used} />
          <CapacityStat
            label="Remaining"
            value={club.remaining}
            className={full ? "text-destructive" : "text-emerald-600"}
          />
        </div>
      ) : (
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-sm font-semibold text-muted-foreground" title="Does not host on Thursdays">
            —
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">hosting</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={`Edit ${club.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete ${club.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

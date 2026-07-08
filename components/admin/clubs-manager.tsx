"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import {
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Check,
  Clock,
  Lock,
  Mail,
  Phone,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Stat } from "@/components/brand/bits"
import {
  SAPL_REGIONS,
  normaliseCourtSlots,
  normaliseSlotTimeslots,
  deriveSlotCounts,
  canChooseTimeslot,
  SLOT_TIMESLOT_OPTIONS,
  type CourtSlotMode,
  type SlotTimeslot,
} from "@/lib/constants"
import { saveClub, deleteClub, updateTeamOwnerEmail, updateTeamContactDetails } from "@/lib/actions/clubs"
import type { ClubRow, PlayerOption } from "@/lib/queries-clubs"
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
  courtSlots: [] as CourtSlotMode[],
  slotTimeslots: [] as string[],
  logoUrl: "",
  playtomicUrl: "",
  contactName: "",
  contactEmail: "",
  contactEmail2: "",
  contactPhone: "",
}

type FormState = typeof EMPTY

const SLOT_META: Record<CourtSlotMode, { label: string; short: string; className: string }> = {
  team: { label: "Enter a team", short: "Team", className: "border-primary bg-primary text-primary-foreground" },
  public: { label: "Public host", short: "Public", className: "border-emerald-600 bg-emerald-600 text-white" },
  none: { label: "No host", short: "No host", className: "border-border bg-secondary text-muted-foreground" },
}

export function ClubsManager({
  clubs,
  players,
  organisationId,
  locked = false,
}: {
  clubs: ClubRow[]
  players: PlayerOption[]
  // When provided (club-owner dashboard), new venues are created under this org.
  organisationId?: number
  // When the season is active, court slot / own-team / public-slot settings are
  // frozen. The editor renders read-only and the server rejects slot changes.
  locked?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [editingClub, setEditingClub] = useState<ClubRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>("all")

  const filtered = useMemo(
    () => (regionFilter === "all" ? clubs : clubs.filter((c) => c.saplRegion === regionFilter)),
    [clubs, regionFilter],
  )

  // Headline stats recompute from the region-filtered set so the widgets always
  // reflect the venues currently shown.
  const stats = useMemo(() => {
    const totalCapacity = filtered.reduce((s, c) => s + c.hostingCapacity, 0)
    const totalUsed = filtered.reduce((s, c) => s + c.used, 0)
    const thursdayHosts = filtered.filter((c) => c.hostsThursday).length
    const clubsWithTeams = filtered.filter((c) => c.teamsEntering > 0).length
    return { venues: filtered.length, totalCapacity, totalUsed, thursdayHosts, clubsWithTeams }
  }, [filtered])

  const counts = useMemo(() => deriveSlotCounts(form.courtSlots), [form.courtSlots])
  const canChoose = canChooseTimeslot(form.courts)

  function openCreate() {
    setForm({ ...EMPTY })
    setEditingClub(null)
    setOpen(true)
  }

  function openEdit(c: ClubRow) {
    const slots = normaliseCourtSlots(c.courts, c.courtSlots as CourtSlotMode[])
    setForm({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      address: c.address ?? "",
      saplRegion: c.saplRegion ?? "",
      courts: c.courts,
      courtSlots: slots,
      slotTimeslots: normaliseSlotTimeslots(c.courts, slots, c.slotTimeslots),
      logoUrl: c.logoUrl ?? "",
      playtomicUrl: c.playtomicUrl ?? "",
      contactName: c.contactName ?? "",
      contactEmail: c.contactEmail ?? "",
      contactEmail2: c.contactEmail2 ?? "",
      contactPhone: c.contactPhone ?? "",
    })
    setEditingClub(c)
    setOpen(true)
  }

  function setCourts(courts: number) {
    const n = Math.max(0, Math.min(20, Math.floor(courts || 0)))
    setForm((f) => {
      const courtSlots = normaliseCourtSlots(n, f.courtSlots)
      return { ...f, courts: n, courtSlots, slotTimeslots: normaliseSlotTimeslots(n, courtSlots, f.slotTimeslots) }
    })
  }

  function setSlot(index: number, mode: CourtSlotMode) {
    setForm((f) => {
      const next = [...f.courtSlots]
      next[index] = mode
      return { ...f, courtSlots: next, slotTimeslots: normaliseSlotTimeslots(f.courts, next, f.slotTimeslots) }
    })
  }

  function setSlotTime(index: number, time: SlotTimeslot) {
    setForm((f) => {
      const next = [...f.slotTimeslots]
      next[index] = time
      return { ...f, slotTimeslots: next }
    })
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Venue name is required")
      return
    }
    startTransition(async () => {
      const res = await saveClub({
        id: form.id,
        organisationId,
        name: form.name,
        description: form.description,
        address: form.address,
        saplRegion: form.saplRegion,
        courts: form.courts,
        courtSlots: form.courtSlots,
        slotTimeslots: form.slotTimeslots,
        logoUrl: form.logoUrl,
        playtomicUrl: form.playtomicUrl,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactEmail2: form.contactEmail2,
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

      {/* Headline stats — react to the active region filter */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Venues" value={stats.venues} />
        <Stat label="Hosting Capacity" value={stats.totalCapacity} sub={`${stats.totalUsed} in use`} />
        <Stat label="Clubs With Teams" value={stats.clubsWithTeams} />
        <Stat label="Thursday Hosts" value={stats.thursdayHosts} />
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
              Set how many courts the venue has, then choose what each court is used for. Hosting capacity is the
              number of team and public courts combined.
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

            <Field label="Number of courts">
              <Input
                type="number"
                min={0}
                max={20}
                value={form.courts}
                disabled={locked}
                onChange={(e) => setCourts(Number(e.target.value))}
              />
            </Field>

            {locked && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                The season has started — court slots, own teams and public slots are locked. Unlock the season under
                League Management to edit.
              </div>
            )}

            {/* Per-slot configuration */}
            {form.courts > 0 ? (
              <div className={cn("space-y-2 rounded-md border border-border p-3", locked && "opacity-60")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Slot usage</p>
                  <span className="text-xs text-muted-foreground">
                    {counts.teamsEntering} team · {counts.publicSlots} public · capacity {counts.hostingCapacity}
                  </span>
                </div>
                <div className="space-y-2">
                  {form.courtSlots.map((mode, i) => {
                    const hosting = mode === "team" || mode === "public"
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-2">
                        <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">Slot {i + 1}</span>
                        <div className="flex flex-1 gap-1">
                          {(["team", "public", "none"] as CourtSlotMode[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              disabled={locked}
                              onClick={() => setSlot(i, m)}
                              className={cn(
                                "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed",
                                mode === m
                                  ? SLOT_META[m].className
                                  : "border-border bg-card text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {SLOT_META[m].short}
                            </button>
                          ))}
                        </div>
                        {/* Hosting time: dropdown on the right of the slot row */}
                        <div className="flex w-28 shrink-0 justify-end">
                          {hosting ? (
                            canChoose ? (
                              <Select
                                value={form.slotTimeslots[i] || "both"}
                                onValueChange={(v) => setSlotTime(i, v as SlotTimeslot)}
                                disabled={locked}
                              >
                                <SelectTrigger className="h-8 w-full" aria-label={`Hosting time for slot ${i + 1}`}>
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SLOT_TIMESLOT_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1.5 text-[11px] font-medium text-muted-foreground"
                                title="With fewer than 4 courts a fixture must split across both times"
                              >
                                <Clock className="h-3 w-3" /> Both
                              </span>
                            )
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Team slots field one of your own teams. Public slots open this venue as a home venue for a public
                  team. No-host slots are not used for league fixtures.{" "}
                  {canChoose
                    ? "Choose which league-night time each hosting slot will run."
                    : "With fewer than 4 courts a fixture must split across 17:00 and 18:30, so both times are required."}
                </p>
              </div>
            ) : null}

            {/* Team owners — only when editing an existing venue that has team blocks */}
            {editingClub && editingClub.clubTeams.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Your teams</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set an owner email for each team. The person with that email address will have access to manage the team.
                </p>
                <div className="space-y-2">
                  {editingClub.clubTeams.map((t) => (
                    <OwnerEmailRow
                      key={t.teamId}
                      team={t}
                      onChanged={() => router.refresh()}
                      disabled={pending}
                    />
                  ))}
                </div>
              </div>
            ) : editingClub === null && counts.teamsEntering > 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {counts.teamsEntering} team{counts.teamsEntering > 1 ? "s" : ""} will be created when you save. Re-open
                this venue to assign captains.
              </p>
            ) : null}

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

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Contact name">
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  />
                </Field>
                <Field label="Contact phone">
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Contact email 1" hint="Gets club management access">
                  <Input
                    type="email"
                    placeholder="manager@example.com"
                    value={form.contactEmail}
                    onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  />
                </Field>
                <Field label="Contact email 2" hint="Also gets club management access">
                  <Input
                    type="email"
                    placeholder="co-manager@example.com"
                    value={form.contactEmail2}
                    onChange={(e) => setForm((f) => ({ ...f, contactEmail2: e.target.value }))}
                  />
                </Field>
              </div>
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
              Close
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

/** Contact details for a single venue team block (name, phone, email). */
function OwnerEmailRow({
  team,
  onChanged,
  disabled,
}: {
  team: ClubRow["clubTeams"][number]
  onChanged: () => void
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(team.ownerName ?? "")
  const [phone, setPhone] = useState(team.ownerPhone ?? "")
  const [email, setEmail] = useState(team.ownerEmail ?? "")
  const busy = pending || disabled

  const isDirty =
    name.trim() !== (team.ownerName ?? "") ||
    phone.trim() !== (team.ownerPhone ?? "") ||
    email.trim() !== (team.ownerEmail ?? "")

  function save() {
    const trimmedEmail = email.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.")
      return
    }
    startTransition(async () => {
      const res = await updateTeamContactDetails({
        teamId: team.teamId,
        ownerName: name.trim() || null,
        ownerPhone: phone.trim() || null,
        ownerEmail: trimmedEmail || null,
      })
      if (res.ok) {
        toast.success("Team contact details saved")
        onChanged()
      } else {
        toast.error(res.error ?? "Failed to save contact details")
      }
    })
  }

  const hasContact = team.ownerEmail || team.ownerName || team.ownerPhone

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{team.name}</span>
        {hasContact ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
            <User className="h-3 w-3" /> Contact set
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No contact</span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Owner name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 flex-1 text-sm"
            disabled={busy}
          />
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="tel"
            placeholder="Contact phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 flex-1 text-sm"
            disabled={busy}
          />
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="email"
            placeholder="owner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 flex-1 text-sm"
            disabled={busy}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={busy || !isDirty}>
          {pending ? "Saving…" : "Save contact"}
        </Button>
      </div>
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

function CapacityStat({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="text-right">
      <p className={cn("text-sm font-semibold tabular-nums", className)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
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
  // Owners assigned across the venue's own entered teams.
  const ownersAssigned = club.clubTeams.filter((t) => t.ownerEmail).length
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

      {/* Hosting summary: Courts · Teams · Captains · Remaining (public slots open) */}
      {club.hosts ? (
        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          <CapacityStat label="Courts" value={club.courts} />
          <CapacityStat label="Teams" value={club.teamsEntering} />
          <CapacityStat
            label="Owners"
            value={club.teamsEntering > 0 ? `${ownersAssigned}/${club.teamsEntering}` : "—"}
            className={
              club.teamsEntering === 0
                ? "text-muted-foreground"
                : ownersAssigned < club.teamsEntering
                  ? "text-amber-600"
                  : "text-emerald-600"
            }
          />
          <CapacityStat
            label="Remaining"
            value={club.publicRemaining}
            className={club.publicRemaining === 0 ? "text-destructive" : "text-emerald-600"}
          />
        </div>
      ) : (
        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          <CapacityStat label="Courts" value={club.courts} />
          <div className="text-right">
            <p className="text-sm font-semibold text-muted-foreground" title="Does not host on Thursdays">
              —
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">hosting</p>
          </div>
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

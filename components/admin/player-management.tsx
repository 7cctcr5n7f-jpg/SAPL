"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ManagedPlayer } from "@/lib/queries-dashboard"
import { adminUpdatePlayer, adminDeleteUsers } from "@/lib/actions/player"
import { eligibleCategoriesForPlayer } from "@/lib/engine/eligibility"
import { CATEGORY_RULES } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExternalLink, Loader2, Pencil, Mars, Venus, Trash2 } from "lucide-react"

const ALL_CATEGORIES = CATEGORY_RULES.map((c) => c.name)

function categoriesFor(p: ManagedPlayer): string[] {
  return eligibleCategoriesForPlayer(p.gender, p.currentLi)
}

function GenderIcon({ gender, className = "" }: { gender: "male" | "female"; className?: string }) {
  if (gender === "female")
    return <Venus className={`h-4 w-4 text-pink-500 ${className}`} aria-label="Female" role="img" />
  return <Mars className={`h-4 w-4 text-blue-500 ${className}`} aria-label="Male" role="img" />
}

export function PlayerManagement({ players, canDelete = false }: { players: ManagedPlayer[]; canDelete?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [team, setTeam] = useState("all")
  const [division, setDivision] = useState("all")
  const [gender, setGender] = useState("all")
  const [category, setCategory] = useState("all")
  const [editing, setEditing] = useState<ManagedPlayer | null>(null)
  const [deleting, setDeleting] = useState<ManagedPlayer | null>(null)

  const teamOptions = useMemo(() => {
    const s = new Set<string>()
    players.forEach((p) => p.teams.forEach((t) => s.add(t.teamName)))
    return [...s].sort()
  }, [players])

  const divisionOptions = useMemo(() => {
    const s = new Set<string>()
    players.forEach((p) => p.teams.forEach((t) => t.divisionName && s.add(t.divisionName)))
    return [...s].sort()
  }, [players])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return players.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.email ?? "").toLowerCase().includes(q)) return false
      if (gender !== "all" && p.gender !== gender) return false
      if (team !== "all" && !p.teams.some((t) => t.teamName === team)) return false
      if (division !== "all" && !p.teams.some((t) => t.divisionName === division)) return false
      if (category !== "all" && !categoriesFor(p).includes(category)) return false
      return true
    })
  }, [players, query, gender, team, division, category])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Team" value={team} onChange={setTeam} options={teamOptions} />
          <FilterSelect label="Division" value={division} onChange={setDivision} options={divisionOptions} />
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={["male", "female"]} />
          <FilterSelect label="Category" value={category} onChange={setCategory} options={ALL_CATEGORIES} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "player" : "players"}
      </p>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {filtered.map((p) => (
          <PlayerCard
            key={p.userId}
            player={p}
            onEdit={() => setEditing(p)}
            canDelete={canDelete}
            onDelete={() => setDeleting(p)}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-muted-foreground">
            No players match your filters.
          </p>
        ) : null}
      </div>

      {/* Desktop condensed table — one row per player. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Player</th>
              <th className="px-3 py-2 font-semibold">Contact</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold">Team</th>
              <th className="px-3 py-2 font-semibold">Rating</th>
              <th className="px-3 py-2 font-semibold">LI</th>
              <th className="px-3 py-2 font-semibold">Playtomic</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PlayerRow
                key={p.userId}
                player={p}
                onEdit={() => setEditing(p)}
                canDelete={canDelete}
                onDelete={() => setDeleting(p)}
              />
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No players match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <EditPlayerDialog
        player={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          router.refresh()
        }}
      />

      <DeletePlayerDialog
        player={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          router.refresh()
        }}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
    >
      <option value="all">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o} className="capitalize">
          {o}
        </option>
      ))}
    </select>
  )
}

function PrimaryCategory({ player }: { player: ManagedPlayer }) {
  const cats = categoriesFor(player)
  if (cats.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="secondary" className="text-[10px]">
        {cats[0]}
      </Badge>
      {cats.length > 1 ? <span className="text-[10px] text-muted-foreground">+{cats.length - 1}</span> : null}
    </div>
  )
}

function PlayerRow({
  player,
  onEdit,
  canDelete,
  onDelete,
}: {
  player: ManagedPlayer
  onEdit: () => void
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/20">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <GenderIcon gender={player.gender} />
          <span className="font-medium text-foreground">{player.name}</span>
          {player.playerId == null ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              No profile
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        <div className="truncate">{player.email ?? "—"}</div>
        <div>{player.phone ?? "—"}</div>
      </td>
      <td className="px-3 py-2">
        <PrimaryCategory player={player} />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {player.teams.length === 0 ? (
          <span>No team</span>
        ) : (
          <span>
            {player.teams[0].teamName}
            {player.teams[0].divisionName ? (
              <span className="text-muted-foreground/70"> · {player.teams[0].divisionName}</span>
            ) : null}
            {player.teams.length > 1 ? (
              <span className="text-muted-foreground/70"> +{player.teams.length - 1}</span>
            ) : null}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="font-medium tabular-nums">
          {player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "—"}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="font-medium tabular-nums">{player.currentLi.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2">
        {player.playtomicUrl ? (
          <a
            href={player.playtomicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Profile
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="ml-1.5">{player.playerId == null ? "No profile" : "Edit"}</span>
          </Button>
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete ${player.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function PlayerCard({
  player,
  onEdit,
  canDelete,
  onDelete,
}: {
  player: ManagedPlayer
  onEdit: () => void
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GenderIcon gender={player.gender} />
            <span className="font-medium text-foreground">{player.name}</span>
            {player.playerId == null ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                No profile
              </Badge>
            ) : null}
          </div>
        </div>
        <PrimaryCategory player={player} />
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        <div className="truncate">{player.email ?? "No email"}</div>
        <div>{player.phone ?? "No contact number"}</div>
        <div>
          {player.teams.length === 0
            ? "No team"
            : player.teams.map((t) => `${t.teamName}${t.divisionName ? ` · ${t.divisionName}` : ""}`).join(", ")}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Playtomic rating</span>
          <span className="font-medium">
            {player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "—"}
          </span>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">LI</span>
          <span className="font-medium">{player.currentLi.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="ml-1.5">{player.playerId == null ? "No profile" : "Edit"}</span>
        </Button>
        {canDelete ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${player.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function DeletePlayerDialog({
  player,
  onClose,
  onDeleted,
}: {
  player: ManagedPlayer | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [pending, startTransition] = useTransition()

  function confirm() {
    if (!player) return
    startTransition(async () => {
      const res = await adminDeleteUsers({ userId: player.userId })
      if (res.ok) {
        toast.success(`Deleted ${player.name}`)
        onDeleted()
      } else {
        toast.error(res.error ?? "Could not delete user")
      }
    })
  }

  return (
    <Dialog open={!!player} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {player?.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the user account and every trace of them — profile, team
            memberships, pairings, payments and notifications. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="ml-2">Delete user</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditPlayerDialog({
  player,
  onClose,
  onSaved,
}: {
  player: ManagedPlayer | null
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={!!player} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {player ? <EditPlayerForm player={player} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function EditPlayerForm({ player, onSaved }: { player: ManagedPlayer; onSaved: () => void }) {
  const isCreate = player.playerId == null
  const [rating, setRating] = useState(player.playtomicRating != null ? String(player.playtomicRating) : "")
  const [li, setLi] = useState(String(player.currentLi))
  const [url, setUrl] = useState(player.playtomicUrl ?? "")
  const [pending, startTransition] = useTransition()

  function submit() {
    if (isCreate) {
      // Nothing to do — create requires name/gender which live in Members & Roles.
      return
    }
    const parsedRating = rating.trim() === "" ? null : Number(rating)
    const parsedLi = Number(li)
    if (parsedRating != null && Number.isNaN(parsedRating)) return toast.error("Rating must be a number.")
    if (Number.isNaN(parsedLi)) return toast.error("LI must be a number.")
    startTransition(async () => {
      const res = await adminUpdatePlayer({
        playerId: player.playerId as number,
        firstName: player.firstName,
        lastName: player.lastName,
        phone: player.phone ?? null,
        gender: player.gender,
        playtomicRating: parsedRating,
        currentLi: parsedLi,
        playtomicUrl: url.trim() || null,
      })
      if (res.ok) {
        toast.success(`Updated ${player.name}`)
        onSaved()
      } else {
        toast.error(res.error ?? "Could not update player")
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isCreate ? "No player profile" : `Edit ${player.name}`}</DialogTitle>
        <DialogDescription>
          {isCreate
            ? `This account has no player profile yet. Go to Members & Roles to set up their core details first.`
            : "Adjust LI, Playtomic rating and profile link. To edit name, contact or gender go to Members & Roles."}
        </DialogDescription>
      </DialogHeader>

      {!isCreate ? (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rating">Playtomic rating</Label>
              <Input
                id="rating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                inputMode="decimal"
                placeholder="—"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li">League Index (LI)</Label>
              <Input id="li" value={li} onChange={(e) => setLi(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">Playtomic URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://playtomic.io/..."
            />
          </div>
        </div>
      ) : null}

      <DialogFooter>
        {isCreate ? (
          <Button type="button" variant="outline" onClick={onSaved}>Close</Button>
        ) : (
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className={pending ? "ml-2" : ""}>Save changes</span>
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

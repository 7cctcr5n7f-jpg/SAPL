"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ManagedPlayer } from "@/lib/queries-dashboard"
import { adminUpdatePlayer, adminCreatePlayerProfile } from "@/lib/actions/player"
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
import { ExternalLink, Loader2, Pencil, Mars, Venus, UserMinus, UserPlus } from "lucide-react"

const ALL_CATEGORIES = CATEGORY_RULES.map((c) => c.name)

function categoriesFor(p: ManagedPlayer): string[] {
  return eligibleCategoriesForPlayer(p.gender, p.currentLi)
}

function GenderIcon({ gender, className = "" }: { gender: "male" | "female"; className?: string }) {
  if (gender === "female")
    return <Venus className={`h-4 w-4 text-pink-500 ${className}`} aria-label="Female" role="img" />
  return <Mars className={`h-4 w-4 text-blue-500 ${className}`} aria-label="Male" role="img" />
}

export function PlayerManagement({ players }: { players: ManagedPlayer[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [team, setTeam] = useState("all")
  const [division, setDivision] = useState("all")
  const [gender, setGender] = useState("all")
  const [category, setCategory] = useState("all")
  const [editing, setEditing] = useState<ManagedPlayer | null>(null)

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
          <PlayerCard key={p.userId} player={p} onEdit={() => setEditing(p)} />
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
              <th className="px-3 py-2 text-right font-semibold">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PlayerRow key={p.userId} player={p} onEdit={() => setEditing(p)} />
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

function PlayerRow({ player, onEdit }: { player: ManagedPlayer; onEdit: () => void }) {
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
        <div className="flex items-center justify-end">
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            {player.playerId == null ? (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                <span className="ml-1.5">Create profile</span>
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                <span className="ml-1.5">Edit</span>
              </>
            )}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function PlayerCard({ player, onEdit }: { player: ManagedPlayer; onEdit: () => void }) {
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

      <div className="mt-3">
        <Button type="button" size="sm" variant="outline" className="w-full" onClick={onEdit}>
          {player.playerId == null ? (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              <span className="ml-1.5">Create profile</span>
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              <span className="ml-1.5">Edit player</span>
            </>
          )}
        </Button>
      </div>
    </div>
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
  const [firstName, setFirstName] = useState(player.firstName)
  const [lastName, setLastName] = useState(player.lastName)
  const [phone, setPhone] = useState(player.phone ?? "")
  const [genderVal, setGenderVal] = useState<"male" | "female">(player.gender)
  const [rating, setRating] = useState(player.playtomicRating != null ? String(player.playtomicRating) : "")
  const [li, setLi] = useState(String(player.currentLi))
  const [url, setUrl] = useState(player.playtomicUrl ?? "")
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!firstName.trim() || !lastName.trim()) return toast.error("First and last name are required.")

    // No profile yet: create one first, then the admin can edit it fully.
    if (isCreate) {
      startTransition(async () => {
        const res = await adminCreatePlayerProfile({
          userId: player.userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: genderVal,
        })
        if (res.ok) {
          toast.success(`Created profile for ${firstName} ${lastName}`)
          onSaved()
        } else {
          toast.error(res.error ?? "Could not create profile")
        }
      })
      return
    }

    const parsedRating = rating.trim() === "" ? null : Number(rating)
    const parsedLi = Number(li)
    if (parsedRating != null && Number.isNaN(parsedRating)) return toast.error("Rating must be a number.")
    if (Number.isNaN(parsedLi)) return toast.error("LI must be a number.")
    startTransition(async () => {
      const res = await adminUpdatePlayer({
        playerId: player.playerId as number,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        gender: genderVal,
        playtomicRating: parsedRating,
        currentLi: parsedLi,
        playtomicUrl: url.trim() || null,
      })
      if (res.ok) {
        toast.success(`Updated ${firstName} ${lastName}`)
        onSaved()
      } else {
        toast.error(res.error ?? "Could not update player")
      }
    })
  }

  function leaveTeam(teamId: number, teamName: string) {
    startTransition(async () => {
      const res = await adminUpdatePlayer({ playerId: player.playerId as number, removeFromTeamId: teamId })
      if (res.ok) {
        toast.success(`Removed from ${teamName}`)
        onSaved()
      } else {
        toast.error(res.error ?? "Could not remove from team")
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isCreate ? "Create player profile" : "Edit player"}</DialogTitle>
        <DialogDescription>
          {isCreate
            ? `Create a player profile for ${player.email ?? "this account"} so they can be managed and assigned to teams.`
            : "Update profile details, rating, and team membership."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isCreate ? (
            <div className="space-y-1.5">
              <Label htmlFor="phone">Contact number</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="—" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              value={genderVal}
              onChange={(e) => setGenderVal(e.target.value as "male" | "female")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        {!isCreate ? (
          <>
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
                <Label htmlFor="li">League Index</Label>
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

            <div className="space-y-2">
              <Label>Teams</Label>
              {player.teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not on any team.</p>
              ) : (
                <ul className="space-y-2">
                  {player.teams.map((t) => (
                    <li
                      key={t.teamId}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{t.teamName}</span>
                        {t.divisionName ? (
                          <span className="text-muted-foreground"> · {t.divisionName}</span>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => leaveTeam(t.teamId, t.teamName)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span className="ml-1.5">Remove</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span className={pending ? "ml-2" : ""}>{isCreate ? "Create profile" : "Save changes"}</span>
        </Button>
      </DialogFooter>
    </>
  )
}

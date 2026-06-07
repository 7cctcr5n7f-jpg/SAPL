"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ManagedPlayer } from "@/lib/queries-dashboard"
import { adminUpdatePlayerRatings } from "@/lib/actions/player"
import { eligibleCategoriesForPlayer } from "@/lib/engine/eligibility"
import { CATEGORY_RULES } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Loader2, Pencil, Check, X, Mars, Venus } from "lucide-react"

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
          <PlayerCard key={p.playerId} player={p} onSaved={() => router.refresh()} />
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
              <PlayerRow key={p.playerId} player={p} onSaved={() => router.refresh()} />
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

function useRatingEditor(player: ManagedPlayer, onSaved: () => void) {
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(player.playtomicRating != null ? String(player.playtomicRating) : "")
  const [li, setLi] = useState(String(player.currentLi))
  const [url, setUrl] = useState(player.playtomicUrl ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    const parsedRating = rating.trim() === "" ? null : Number(rating)
    const parsedLi = Number(li)
    if (parsedRating != null && Number.isNaN(parsedRating)) return toast.error("Rating must be a number.")
    if (Number.isNaN(parsedLi)) return toast.error("LI must be a number.")
    startTransition(async () => {
      const res = await adminUpdatePlayerRatings({
        playerId: player.playerId,
        playtomicRating: parsedRating,
        currentLi: parsedLi,
        playtomicUrl: url.trim() || null,
      })
      if (res.ok) {
        toast.success(`Updated ${player.name}`)
        setEditing(false)
        onSaved()
      } else {
        toast.error(res.error ?? "Could not update player")
      }
    })
  }

  function cancel() {
    setRating(player.playtomicRating != null ? String(player.playtomicRating) : "")
    setLi(String(player.currentLi))
    setUrl(player.playtomicUrl ?? "")
    setEditing(false)
  }

  return { editing, setEditing, rating, setRating, li, setLi, url, setUrl, pending, save, cancel }
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

function PlayerRow({ player, onSaved }: { player: ManagedPlayer; onSaved: () => void }) {
  const ed = useRatingEditor(player, onSaved)
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/20">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <GenderIcon gender={player.gender} />
          <span className="font-medium text-foreground">{player.name}</span>
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
            {player.teams[0].divisionName ? <span className="text-muted-foreground/70"> · {player.teams[0].divisionName}</span> : null}
            {player.teams.length > 1 ? <span className="text-muted-foreground/70"> +{player.teams.length - 1}</span> : null}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {ed.editing ? (
          <Input
            value={ed.rating}
            onChange={(e) => ed.setRating(e.target.value)}
            placeholder="—"
            inputMode="decimal"
            className="h-8 w-16"
          />
        ) : (
          <span className="font-medium tabular-nums">
            {player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {ed.editing ? (
          <Input value={ed.li} onChange={(e) => ed.setLi(e.target.value)} inputMode="decimal" className="h-8 w-16" />
        ) : (
          <span className="font-medium tabular-nums">{player.currentLi.toFixed(2)}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {ed.editing ? (
          <Input
            value={ed.url}
            onChange={(e) => ed.setUrl(e.target.value)}
            placeholder="https://playtomic.io/..."
            className="h-8 w-44"
          />
        ) : player.playtomicUrl ? (
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
          {ed.editing ? (
            <>
              <Button type="button" size="sm" aria-label="Save" disabled={ed.pending} onClick={ed.save}>
                {ed.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                size="sm"
                aria-label="Cancel editing"
                variant="outline"
                disabled={ed.pending}
                onClick={ed.cancel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => ed.setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="ml-1.5">Edit</span>
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function PlayerCard({ player, onSaved }: { player: ManagedPlayer; onSaved: () => void }) {
  const ed = useRatingEditor(player, onSaved)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GenderIcon gender={player.gender} />
            <span className="font-medium text-foreground">{player.name}</span>
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

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Playtomic rating</label>
          {ed.editing ? (
            <Input value={ed.rating} onChange={(e) => ed.setRating(e.target.value)} inputMode="decimal" className="h-9" />
          ) : (
            <span className="text-sm font-medium">
              {player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "—"}
            </span>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">LI</label>
          {ed.editing ? (
            <Input value={ed.li} onChange={(e) => ed.setLi(e.target.value)} inputMode="decimal" className="h-9" />
          ) : (
            <span className="text-sm font-medium">{player.currentLi.toFixed(2)}</span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Playtomic URL</label>
        {ed.editing ? (
          <Input
            value={ed.url}
            onChange={(e) => ed.setUrl(e.target.value)}
            placeholder="https://playtomic.io/..."
            className="h-9"
          />
        ) : player.playtomicUrl ? (
          <a
            href={player.playtomicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View profile
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {ed.editing ? (
          <>
            <Button type="button" size="sm" className="flex-1" disabled={ed.pending} onClick={ed.save}>
              {ed.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Save</span>
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label="Cancel editing"
              variant="outline"
              disabled={ed.pending}
              onClick={ed.cancel}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => ed.setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="ml-1.5">Edit player</span>
          </Button>
        )}
      </div>
    </div>
  )
}

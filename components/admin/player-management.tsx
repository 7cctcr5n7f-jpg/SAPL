"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ManagedPlayer } from "@/lib/queries-dashboard"
import { adminUpdatePlayerRatings } from "@/lib/actions/player"
import { eligibleCategoriesForPlayer } from "@/lib/engine/eligibility"
import { CATEGORY_RULES } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Loader2, Pencil, Check, X } from "lucide-react"

const ALL_CATEGORIES = CATEGORY_RULES.map((c) => c.name)

function categoriesFor(p: ManagedPlayer): string[] {
  return eligibleCategoriesForPlayer(p.gender, p.currentLi)
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
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (gender !== "all" && p.gender !== gender) return false
      if (team !== "all" && !p.teams.some((t) => t.teamName === team)) return false
      if (division !== "all" && !p.teams.some((t) => t.divisionName === division)) return false
      if (category !== "all" && !categoriesFor(p).includes(category)) return false
      return true
    })
  }, [players, query, gender, team, division, category])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players by name..."
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Team" value={team} onChange={setTeam} options={teamOptions} />
          <FilterSelect label="Division" value={division} onChange={setDivision} options={divisionOptions} />
          <FilterSelect label="Gender" value={gender} onChange={setGender} options={["male", "female"]} />
          <FilterSelect label="Level category" value={category} onChange={setCategory} options={ALL_CATEGORIES} />
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

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="px-4 py-3 font-semibold">Player</th>
              <th className="px-4 py-3 font-semibold">Gender</th>
              <th className="px-4 py-3 font-semibold">Team</th>
              <th className="px-4 py-3 font-semibold">Playtomic rating</th>
              <th className="px-4 py-3 font-semibold">LI</th>
              <th className="px-4 py-3 font-semibold">Playtomic</th>
              <th className="px-4 py-3 text-right font-semibold">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PlayerRow key={p.playerId} player={p} onSaved={() => router.refresh()} />
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
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
      })
      if (res.ok) {
        toast.success(`Updated ${player.name}`)
        setEditing(false)
        onSaved()
      } else {
        toast.error(res.error ?? "Could not update ratings")
      }
    })
  }

  function cancel() {
    setRating(player.playtomicRating != null ? String(player.playtomicRating) : "")
    setLi(String(player.currentLi))
    setEditing(false)
  }

  return { editing, setEditing, rating, setRating, li, setLi, pending, save, cancel }
}

function PlayerRow({ player, onSaved }: { player: ManagedPlayer; onSaved: () => void }) {
  const ed = useRatingEditor(player, onSaved)
  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{player.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {categoriesFor(player).map((c) => (
            <Badge key={c} variant="secondary" className="text-[10px]">
              {c}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 capitalize text-muted-foreground">{player.gender}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {player.teams.length === 0 ? (
          <span className="text-xs">No team</span>
        ) : (
          player.teams.map((t) => (
            <div key={t.teamId} className="text-xs">
              {t.teamName}
              {t.divisionName ? <span className="text-muted-foreground/70"> · {t.divisionName}</span> : null}
            </div>
          ))
        )}
      </td>
      <td className="px-4 py-3">
        {ed.editing ? (
          <Input
            value={ed.rating}
            onChange={(e) => ed.setRating(e.target.value)}
            placeholder="—"
            inputMode="decimal"
            className="h-8 w-20"
          />
        ) : (
          <span className="font-medium">{player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "—"}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {ed.editing ? (
          <Input value={ed.li} onChange={(e) => ed.setLi(e.target.value)} inputMode="decimal" className="h-8 w-20" />
        ) : (
          <span className="font-medium">{player.currentLi.toFixed(2)}</span>
        )}
      </td>
      <td className="px-4 py-3">
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
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {ed.editing ? (
            <>
              <Button type="button" size="sm" disabled={ed.pending} onClick={ed.save}>
                {ed.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={ed.pending} onClick={ed.cancel}>
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
          <div className="font-medium text-foreground">{player.name}</div>
          <div className="text-xs capitalize text-muted-foreground">{player.gender}</div>
        </div>
        {player.playtomicUrl ? (
          <a
            href={player.playtomicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Playtomic
          </a>
        ) : null}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        {player.teams.length === 0
          ? "No team"
          : player.teams.map((t) => `${t.teamName}${t.divisionName ? ` · ${t.divisionName}` : ""}`).join(", ")}
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

      <div className="mt-3 flex gap-2">
        {ed.editing ? (
          <>
            <Button type="button" size="sm" className="flex-1" disabled={ed.pending} onClick={ed.save}>
              {ed.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Save</span>
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={ed.pending} onClick={ed.cancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => ed.setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="ml-1.5">Edit ratings</span>
          </Button>
        )}
      </div>
    </div>
  )
}

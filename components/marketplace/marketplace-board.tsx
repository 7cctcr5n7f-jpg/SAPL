"use client"

import { useMemo, useState } from "react"
import { MapPin, Mars, Search, Users, Venus, ExternalLink, Star } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Agent = {
  id: string
  firstName: string | null
  lastName: string | null
  gender: string | null
  city: string | null
  province: string | null
  currentLi: number
  playtomicRating: number | null
  playtomicUrl: string | null
  avatarUrl: string | null
  bio: string | null
  preferredFormats: string[]
  preferredClubIds: number[]
  anyClub: boolean
}

type Club = { id: number; name: string }

const GENDER_OPTIONS = [
  { value: "all", label: "All players" },
  { value: "male", label: "Men" },
  { value: "female", label: "Ladies" },
] as const

function fullName(a: Agent) {
  return [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || "Unnamed player"
}

function initials(a: Agent) {
  const f = a.firstName?.[0] ?? ""
  const l = a.lastName?.[0] ?? ""
  return (f + l).toUpperCase() || "?"
}

function AgentCard({ agent, clubName }: { agent: Agent; clubName: (id: number) => string }) {
  const clubs = agent.anyClub
    ? "Open to any club"
    : agent.preferredClubIds.map(clubName).filter(Boolean).join(", ") || "Open to any club"

  const isFemale = agent.gender === "female"
  const location = [agent.city, agent.province].filter(Boolean).join(", ")
  const rating = agent.playtomicRating

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 border border-border">
          {agent.avatarUrl ? <AvatarImage src={agent.avatarUrl} alt={fullName(agent)} /> : null}
          <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
            {initials(agent)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isFemale ? (
              <Venus className="h-4 w-4 shrink-0 text-pink-500" aria-label="Ladies" />
            ) : (
              <Mars className="h-4 w-4 shrink-0 text-blue-500" aria-label="Mens" />
            )}
            <h3 className="truncate font-semibold text-foreground">{fullName(agent)}</h3>
          </div>
          {location ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          {rating != null ? (
            <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-sm font-bold tabular-nums">{rating.toFixed(2)}</span>
            </div>
          ) : (
            <div className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
              No rating
            </div>
          )}
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Playtomic</p>
        </div>
      </div>

      {agent.bio ? <p className="line-clamp-2 text-sm text-muted-foreground">{agent.bio}</p> : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          <span className="truncate">{clubs}</span>
        </span>
        {agent.playtomicUrl ? (
          <a
            href={agent.playtomicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Playtomic <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  )
}

export function MarketplaceBoard({ agents, clubs }: { agents: Agent[]; clubs: Club[] }) {
  const [club, setClub] = useState<string>("all")
  const [gender, setGender] = useState<string>("all")
  const [query, setQuery] = useState<string>("")

  const clubName = useMemo(() => {
    const map = new Map(clubs.map((c) => [c.id, c.name]))
    return (id: number) => map.get(id) ?? ""
  }, [clubs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return agents.filter((a) => {
      if (gender !== "all" && a.gender !== gender) return false
      if (club !== "all") {
        const clubId = Number(club)
        if (!a.anyClub && !a.preferredClubIds.includes(clubId)) return false
      }
      if (q && !fullName(a).toLowerCase().includes(q)) return false
      return true
    })
  }, [agents, club, gender, query])

  return (
    <div className="mt-8">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="mp-search" className="text-xs uppercase tracking-widest text-muted-foreground">
            Search by name
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="mp-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Player name"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Category</Label>
          <Select value={gender} onValueChange={(v) => setGender(v ?? "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Preferred club</Label>
          <Select value={club} onValueChange={(v) => setClub(v ?? "all")}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clubs</SelectItem>
              {clubs.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="ml-auto self-center text-sm tabular-nums text-muted-foreground">
          {filtered.length} player{filtered.length === 1 ? "" : "s"} available
        </p>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <Search className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No players match your filters</p>
          <p className="text-sm text-muted-foreground">Try clearing the search or choosing a different club.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard key={a.id} agent={a} clubName={clubName} />
          ))}
        </div>
      )}
    </div>
  )
}

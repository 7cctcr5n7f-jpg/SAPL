"use client"

import { useMemo, useState } from "react"
import { MapPin, Mars, Search, Users, Venus } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type Agent = {
  id: number
  firstName: string
  lastName: string
  gender: string
  city: string | null
  province: string
  currentLi: number
  bio: string | null
  preferredFormats: string[]
  preferredClubIds: number[]
  anyClub: boolean
}

type Club = { id: number; name: string }

const GENDER_COLUMNS = [
  { value: "male", label: "Men", description: "Mens pairings" },
  { value: "female", label: "Ladies", description: "Ladies pairings" },
] as const

function AgentCard({ agent, clubName }: { agent: Agent; clubName: (id: number) => string }) {
  const clubs = agent.anyClub
    ? "Any club"
    : agent.preferredClubIds.map(clubName).filter(Boolean).join(", ") || "Any club"

  const isFemale = agent.gender === "female"

  return (
    <div className="flex items-center gap-3 border border-border bg-card px-4 py-2.5 text-sm">
      {isFemale ? (
        <Venus className="h-4 w-4 shrink-0 text-pink-500" aria-label="Ladies" />
      ) : (
        <Mars className="h-4 w-4 shrink-0 text-blue-500" aria-label="Mens" />
      )}
      <span className="truncate font-medium">
        {agent.firstName} {agent.lastName}
        <span className="ml-1 tabular-nums text-muted-foreground">({agent.currentLi?.toFixed(1) ?? "—"})</span>
      </span>
      <span className="ml-auto flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{clubs}</span>
      </span>
    </div>
  )
}

function GenderColumn({
  column,
  agents,
  clubName,
}: {
  column: (typeof GENDER_COLUMNS)[number]
  agents: Agent[]
  clubName: (id: number) => string
}) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2">
        <div>
          <h2 className="heading text-xl">{column.label}</h2>
          <p className="text-xs text-muted-foreground">{column.description}</p>
        </div>
        <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
          <Users className="h-4 w-4" /> {agents.length}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border border-dashed border-border py-12 text-center">
            <Search className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No players match this filter.</p>
          </div>
        ) : (
          agents.map((a) => <AgentCard key={a.id} agent={a} clubName={clubName} />)
        )}
      </div>
    </section>
  )
}

export function MarketplaceBoard({ agents, clubs }: { agents: Agent[]; clubs: Club[] }) {
  const [club, setClub] = useState<string>("all")

  const clubName = useMemo(() => {
    const map = new Map(clubs.map((c) => [c.id, c.name]))
    return (id: number) => map.get(id) ?? ""
  }, [clubs])

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (club !== "all") {
        const clubId = Number(club)
        if (!a.anyClub && !a.preferredClubIds.includes(clubId)) return false
      }
      return true
    })
  }, [agents, club])

  const byGender = useMemo(() => {
    const map: Record<"male" | "female", Agent[]> = { male: [], female: [] }
    for (const a of filtered) {
      if (a.gender === "female") map.female.push(a)
      else map.male.push(a)
    }
    return map
  }, [filtered])

  return (
    <div className="mt-8">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 border border-border bg-card p-4">
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
        <p className="ml-auto self-center text-sm text-muted-foreground tabular-nums">
          {filtered.length} player{filtered.length === 1 ? "" : "s"} available
        </p>
      </div>

      {/* Men + Ladies columns */}
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {GENDER_COLUMNS.map((c) => (
          <GenderColumn key={c.value} column={c} agents={byGender[c.value]} clubName={clubName} />
        ))}
      </div>
    </div>
  )
}

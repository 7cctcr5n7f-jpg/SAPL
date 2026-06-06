"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Division = { id: number; name: string; level: number; regionName?: string | null }
type Row = {
  teamId: number
  teamName: string | null
  orgName: string | null
  played: number
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  points: number
  pointsDiff: number
  rank: number
}

export function StandingsView({
  divisions,
  standingsByDivision,
}: {
  divisions: Division[]
  standingsByDivision: Record<number, Row[]>
}) {
  const regions = useMemo(() => {
    const seen: string[] = []
    for (const d of divisions) {
      const r = d.regionName ?? "Other"
      if (!seen.includes(r)) seen.push(r)
    }
    return seen
  }, [divisions])

  const [region, setRegion] = useState(regions[0])
  const regionDivisions = useMemo(
    () => divisions.filter((d) => (d.regionName ?? "Other") === region),
    [divisions, region],
  )
  const [active, setActive] = useState<number | undefined>(regionDivisions[0]?.id)

  // Keep the active division valid when the region changes.
  const activeInRegion = regionDivisions.some((d) => d.id === active)
  const currentDivision = activeInRegion ? active : regionDivisions[0]?.id

  const rows = currentDivision ? standingsByDivision[currentDivision] ?? [] : []
  const total = rows.length

  function selectRegion(r: string) {
    setRegion(r)
    const first = divisions.find((d) => (d.regionName ?? "Other") === r)
    setActive(first?.id)
  }

  return (
    <div>
      {regions.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-2 border-b border-border pb-5">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => selectRegion(r)}
              className={cn(
                "px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors",
                region === r
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {regionDivisions.map((d) => (
          <button
            key={d.id}
            onClick={() => setActive(d.id)}
            className={cn(
              "px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors",
              currentDivision === d.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-card">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">P</TableHead>
              <TableHead className="text-right">W</TableHead>
              <TableHead className="text-right">L</TableHead>
              <TableHead className="text-right">Sets</TableHead>
              <TableHead className="text-right">Diff</TableHead>
              <TableHead className="text-right">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const promo = r.rank <= 2
              const releg = total >= 6 && r.rank >= 5
              return (
                <TableRow key={r.teamId}>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center text-xs font-bold",
                        promo && "bg-primary text-primary-foreground",
                        releg && "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.rank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/teams/${r.teamId}`} className="font-semibold hover:text-primary">
                      {r.teamName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.orgName}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.played}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.losses}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.setsWon}-{r.setsLost}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.pointsDiff > 0 ? `+${r.pointsDiff}` : r.pointsDiff}
                  </TableCell>
                  <TableCell className="text-right heading text-lg tabular-nums">{r.points}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-primary" /> Promotion / playoff places
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-muted" /> Relegation playoff
        </span>
      </div>
    </div>
  )
}

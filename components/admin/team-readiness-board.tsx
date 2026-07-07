"use client"

import { useMemo, useState } from "react"
import type { SeasonReadiness, SeasonReadinessTeam } from "@/lib/team-readiness"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Stat } from "@/components/brand/bits"
import { CheckCircle2, AlertCircle, Users, Wallet } from "lucide-react"

type StatusFilter = "all" | "ready" | "not_ready"

function ReadyPill({ ready }: { ready: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        ready
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      )}
    >
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {ready ? "League Ready" : "Not ready"}
    </span>
  )
}

function TeamRow({ t }: { t: SeasonReadinessTeam }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 last:border-0 lg:flex-row lg:items-center lg:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground">{t.teamName}</span>
          <ReadyPill ready={t.isLeagueReady} />
        </div>
        {t.reasons.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {t.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Full squad, all fees settled.</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 lg:w-80 lg:shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Roster</p>
          <p className={cn("text-sm font-semibold tabular-nums", t.rosterComplete ? "text-foreground" : "text-amber-600 dark:text-amber-400")}>
            {t.playerCount}/{t.maxPlayers}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fees</p>
          <p className={cn("text-sm font-semibold tabular-nums", t.feesSettled ? "text-foreground" : "text-amber-600 dark:text-amber-400")}>
            {t.clubPaysFees
              ? <span className="text-muted-foreground font-normal text-xs">Team pays</span>
              : `${t.paidCount}/${t.playerCount}`}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg PR</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">{t.avgRating != null ? t.avgRating.toFixed(2) : "—"}</p>
        </div>
      </div>
    </div>
  )
}

export function TeamReadinessBoard({ data, seasonName }: { data: SeasonReadiness; seasonName: string | null }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.teams.filter((t) => {
      if (status === "ready" && !t.isLeagueReady) return false
      if (status === "not_ready" && t.isLeagueReady) return false
      if (q && !t.teamName.toLowerCase().includes(q)) return false
      return true
    })
  }, [data.teams, query, status])

  const readyPct = data.totalTeams > 0 ? Math.round((data.readyTeams / data.totalTeams) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <Stat label="League Ready" value={`${data.readyTeams}/${data.totalTeams}`} />
            <p className="mt-1 text-xs text-muted-foreground">{readyPct}% of teams ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <Users className="mt-1 h-4 w-4 text-muted-foreground" />
            <Stat label="Rosters complete" value={`${data.rosterCompleteTeams}/${data.totalTeams}`} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <Wallet className="mt-1 h-4 w-4 text-muted-foreground" />
            <Stat label="Fees settled" value={`${data.feesSettledTeams}/${data.totalTeams}`} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Players owing" value={data.playersOutstanding} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team..."
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Readiness status"
          >
            <option value="all">All teams</option>
            <option value="not_ready">Not ready</option>
            <option value="ready">League Ready</option>
          </select>
        </div>
      </div>

      {data.totalTeams === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {seasonName ? `No active teams in ${seasonName} yet.` : "No active season with teams yet."}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No teams match your filters.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            {filtered.map((t) => (
              <TeamRow key={t.teamId} t={t} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

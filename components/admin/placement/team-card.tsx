"use client"

import { cn } from "@/lib/utils"
import type { BoardTeam } from "@/lib/placement-types"
import { normalizeTeamType } from "@/lib/constants"

// Team type is conveyed with a small color dot instead of a text badge to keep
// cards compact. Keep these in sync with TEAM_TYPES in lib/constants.
const TYPE_COLOR: Record<string, string> = {
  "Club Team": "bg-sky-500",
  "Business Team": "bg-amber-500",
  "Private Team": "bg-emerald-500",
}

export function TeamCardContent({
  team,
  dragging,
  overlay,
}: {
  team: BoardTeam
  dragging?: boolean
  overlay?: boolean
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-card-foreground transition",
        dragging && "opacity-40",
        overlay && "scale-[1.02] border-primary shadow-lg ring-1 ring-primary/30",
        !overlay && "hover:border-primary/60",
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 self-start mt-1 rounded-full",
          TYPE_COLOR[normalizeTeamType(team.teamType)] ?? "bg-muted-foreground",
        )}
        title={normalizeTeamType(team.teamType)}
        aria-label={normalizeTeamType(team.teamType)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{team.name}</p>
        <p className="truncate text-[10px] leading-tight text-muted-foreground">
          {team.homeClubName ?? "No home club"}
        </p>
      </div>
      <span className="shrink-0 self-start mt-0.5 text-[11px] tabular-nums text-muted-foreground" title={`${team.playerCount} of ${team.maxPlayers} players`}>
        {team.playerCount}/{team.maxPlayers}
      </span>
      <span className="shrink-0 self-start rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-secondary-foreground" title="Average Playtomic rating">
        {team.avgLi > 0 ? team.avgLi.toFixed(1) : "—"}
      </span>
    </div>
  )
}

"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Activity, Crown, MapPin, Users, UserCog, Loader2, Trash2, Tag } from "lucide-react"
import { fetchTeamRoster, adminSetTeamType, adminDeleteTeam } from "@/lib/actions/placement"
import { TEAM_TYPES } from "@/lib/constants"
import { toast } from "sonner"
import type { BoardTeam, RosterEntry } from "@/lib/placement-types"

export function RosterPanel({ team, onClose }: { team: BoardTeam | null; onClose: () => void }) {
  const router = useRouter()
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function changeType(value: string | null) {
    if (!team || !value) return
    startTransition(async () => {
      const res = await adminSetTeamType(team.id, value)
      if (res?.ok) {
        toast.success("Team type updated")
        router.refresh()
      } else {
        toast.error(res?.error ?? "Could not update team type")
      }
    })
  }

  function deleteTeam() {
    if (!team) return
    startTransition(async () => {
      const res = await adminDeleteTeam(team.id)
      if (res?.ok) {
        toast.success("Team deleted")
        setConfirmOpen(false)
        onClose()
        router.refresh()
      } else {
        toast.error("Could not delete team")
      }
    })
  }

  useEffect(() => {
    let active = true
    if (team) {
      setLoading(true)
      fetchTeamRoster(team.id)
        .then((r) => {
          if (active) setRoster(r)
        })
        .finally(() => active && setLoading(false))
    } else {
      setRoster([])
    }
    return () => {
      active = false
    }
  }, [team])

  return (
    <Sheet open={!!team} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        {team && (
          <>
            <SheetHeader>
              <SheetTitle>{team.name}</SheetTitle>
              <SheetDescription>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{team.teamType}</Badge>
                  {team.saplRegion && (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" /> {team.saplRegion}
                    </span>
                  )}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3">
              <InfoTile icon={<Activity className="h-4 w-4" />} label="Average PR" value={team.avgLi.toFixed(2)} />
              <InfoTile
                icon={<Users className="h-4 w-4" />}
                label="Players"
                value={`${team.playerCount}/${team.maxPlayers}`}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <Row icon={<Crown className="h-4 w-4 text-primary" />} label="Captain" value={team.captainName ?? "—"} />
              <Row icon={<UserCog className="h-4 w-4" />} label="Manager" value={team.managerName ?? "—"} />
              <Row icon={<MapPin className="h-4 w-4" />} label="Home club" value={team.homeClubName ?? "—"} />
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Admin</p>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  Team type
                </span>
                <Select value={team.teamType} onValueChange={changeType} disabled={pending}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={pending}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete team
              </Button>
            </div>

            <Dialog open={confirmOpen} onOpenChange={(o) => !pending && setConfirmOpen(o)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {team.name}?</DialogTitle>
                  <DialogDescription>
                    This permanently removes the team, its roster, season entries and history. Any
                    fixtures it was placed in will free up that slot. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" disabled={pending} onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" disabled={pending} onClick={deleteTeam}>
                    {pending ? "Deleting…" : "Delete team"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-semibold">Roster ({roster.length})</p>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : roster.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No players on this roster yet.</p>
              ) : (
                <ul className="space-y-1">
                  {roster.map((p) => (
                    <li
                      key={p.playerId}
                      className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {p.isCaptain && <Crown className="h-3.5 w-3.5 text-primary" />}
                        {p.name}
                      </span>
                      <Badge variant="outline">PR {p.playtomicRating != null ? p.playtomicRating.toFixed(2) : "—"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-heading text-xl font-semibold">{value}</p>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

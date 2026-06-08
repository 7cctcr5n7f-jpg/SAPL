"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createOwnTeam, setMarketplaceListing } from "@/lib/actions/org"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Plus, Users } from "lucide-react"

const TEAM_TYPES = ["Social Group", "Club Team", "Corporate"]

/**
 * Self-service player tools shown on the dashboard Overview:
 * - Create your own team (becomes Team Owner, team awaits league placement).
 * - List yourself on the Player Marketplace (toggles lookingForTeam).
 */
export function PlayerSelfService({
  hasPlayerProfile,
  listed,
}: {
  hasPlayerProfile: boolean
  listed: boolean
}) {
  const router = useRouter()
  const [isListed, setIsListed] = useState(listed)
  const [togglePending, startToggle] = useTransition()

  function toggleListing(next: boolean) {
    setIsListed(next)
    startToggle(async () => {
      const res = await setMarketplaceListing(next)
      if (res.ok) {
        toast.success(next ? "You're now listed on the Marketplace" : "Removed from the Marketplace")
        router.refresh()
      } else {
        setIsListed(!next)
        toast.error(res.error ?? "Could not update your listing")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" /> Get in the game
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Create your own team</p>
            <p className="text-xs text-muted-foreground text-pretty">
              Start a team as its owner. The league will place it into a division for the next season.
            </p>
          </div>
          <CreateOwnTeamDialog onCreated={() => router.refresh()} />
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">List on the Marketplace</p>
            <p className="text-xs text-muted-foreground text-pretty">
              {hasPlayerProfile
                ? "Let captains find you as a free agent looking for a team this season."
                : "Complete your player profile to list yourself as a free agent."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {togglePending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <Switch
              checked={isListed}
              onCheckedChange={toggleListing}
              disabled={!hasPlayerProfile || togglePending}
              aria-label="List on the Marketplace"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateOwnTeamDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [teamType, setTeamType] = useState(TEAM_TYPES[0])

  function submit() {
    if (!name.trim()) {
      toast.error("Team name is required.")
      return
    }
    startTransition(async () => {
      const res = await createOwnTeam({ name, teamType })
      if (res.ok) {
        toast.success("Team created — you're now its owner")
        setOpen(false)
        setName("")
        setTeamType(TEAM_TYPES[0])
        onCreated()
      } else {
        toast.error(res.error ?? "Could not create team")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Create team
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownTeamName">Team name</Label>
            <Input
              id="ownTeamName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sandton Smashers"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownTeamType">Team type</Label>
            <select
              id="ownTeamType"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TEAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            You&apos;ll be set as the team owner and can manage its squad from Team Admin. The league office places teams
            into divisions before each season.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

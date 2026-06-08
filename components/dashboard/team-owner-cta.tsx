"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createOwnTeam, setMarketplaceListing } from "@/lib/actions/org"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Users, Store } from "lucide-react"

const TEAM_TYPES = ["Social Group", "Club Team", "Corporate Team", "Educational Team", "Community Team"]

/**
 * Overview call-to-action shown to members who don't yet manage a team. Lets a
 * player either create their own team (becoming its owner) or list themselves on
 * the marketplace so captains can recruit them.
 */
export function TeamOwnerCta({
  hasPlayerProfile,
  listedOnMarketplace,
}: {
  hasPlayerProfile: boolean
  listedOnMarketplace: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CreateTeamCard />
      <MarketplaceCard hasPlayerProfile={hasPlayerProfile} listed={listedOnMarketplace} />
    </div>
  )
}

function CreateTeamCard() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [teamType, setTeamType] = useState(TEAM_TYPES[0])
  const [pending, start] = useTransition()
  const router = useRouter()

  function submit() {
    if (!name.trim()) {
      toast.error("Team name is required")
      return
    }
    start(async () => {
      const res = await createOwnTeam({ name, teamType })
      if (res.ok) {
        toast.success("Team created — you're now the team owner")
        setOpen(false)
        setName("")
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to create team")
      }
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary" /> Create a Team
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Start your own team and become its owner. You&apos;ll be able to manage your roster, fixtures and fees. The
          league office will place your team into a division.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="w-fit">Create Team</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create your team</DialogTitle>
              <DialogDescription>
                You become the team owner immediately and gain access to team management tools.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ownTeamName">Team name</Label>
                <Input
                  id="ownTeamName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunday Smashers"
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
              <Button onClick={submit} disabled={pending} className="w-full">
                {pending ? "Creating…" : "Create Team"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function MarketplaceCard({ hasPlayerProfile, listed }: { hasPlayerProfile: boolean; listed: boolean }) {
  const [isListed, setIsListed] = useState(listed)
  const [pending, start] = useTransition()
  const router = useRouter()

  function toggle() {
    if (!hasPlayerProfile) {
      toast.error("Complete your player profile first")
      return
    }
    const next = !isListed
    start(async () => {
      const res = await setMarketplaceListing(next)
      if (res.ok) {
        setIsListed(next)
        toast.success(next ? "You're now listed on the marketplace" : "Removed from the marketplace")
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to update listing")
      }
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-5 w-5 text-primary" /> List on the Marketplace
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {isListed
            ? "You're visible to captains looking for players. Turn this off any time."
            : "Make yourself discoverable so team captains can recruit you for their squads."}
        </p>
        <Button onClick={toggle} disabled={pending} variant={isListed ? "outline" : "default"} className="w-fit">
          {pending ? "Saving…" : isListed ? "Remove my listing" : "List me on the Marketplace"}
        </Button>
      </CardContent>
    </Card>
  )
}

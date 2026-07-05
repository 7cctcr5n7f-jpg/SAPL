"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { invitePlayerByEmail } from "@/lib/actions/pairings"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"

/**
 * "Add Player" flow for the My Team page. Captures name, email and an optional
 * Playtomic rating. If the email belongs to a registered player they join
 * immediately; otherwise an invite email is sent and the player is linked
 * automatically when they register with that address.
 */
export function MyTeamAddPlayer({
  teamId,
  slotsRemaining,
  trigger,
}: {
  teamId: number
  slotsRemaining: number
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [rating, setRating] = useState("")

  function reset() {
    setName("")
    setEmail("")
    setRating("")
  }

  function submit() {
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid email address.")
      return
    }
    const ratingNum = rating.trim() ? Number(rating) : null
    if (ratingNum != null && (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 7)) {
      toast.error("Playtomic rating must be between 0 and 7.")
      return
    }
    start(async () => {
      const res = await invitePlayerByEmail({
        teamId,
        email: email.trim(),
        name: name.trim() || undefined,
        playtomicRating: ratingNum,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.success ?? "Player added.")
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          (trigger as React.ReactElement) ?? (
            <Button size="sm">
              <UserPlus className="mr-1.5 h-4 w-4" /> Add Player
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a player</DialogTitle>
          <DialogDescription className="text-pretty">
            {slotsRemaining > 0
              ? `${slotsRemaining} open slot${slotsRemaining === 1 ? "" : "s"} left in your squad of 8.`
              : "Your squad is full."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apName">Player name</Label>
            <Input
              id="apName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Player"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apEmail">Email</Label>
            <Input
              id="apEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground text-pretty">
              We&apos;ll email an invite. Registered players are added instantly; new players join once they sign up.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apRating">Playtomic rating (optional)</Label>
            <Input
              id="apRating"
              type="number"
              step="0.1"
              min="0"
              max="7"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="e.g. 3.5"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Used to calculate your team&apos;s average rating.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || slotsRemaining <= 0}>
            {pending ? "Adding…" : "Add player"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

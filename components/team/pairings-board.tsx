"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { invitePlayerByEmail, setPairingSlot, cancelInvite } from "@/lib/actions/pairings"
import { PAIRING_LAYOUT } from "@/lib/constants"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { DollarSign, Mail, Mars, UserPlus, Venus, X } from "lucide-react"
import type { PairingCategory, PairingPlayer, PairingSlot } from "@/lib/queries-dashboard"

type Invite = { id: number; email: string; category: string | null }

export function PairingsBoard({
  teamId,
  categories,
  roster,
  invites,
  clubPaysFees,
}: {
  teamId: number
  categories: PairingCategory[]
  roster: PairingPlayer[]
  invites: Invite[]
  clubPaysFees: boolean
}) {
  const [pending, start] = useTransition()
  const [inviteTarget, setInviteTarget] = useState<{
    category: string
    pairIndex: number
    slotIndex: number
  } | null>(null)
  const [email, setEmail] = useState("")

  const catByName = new Map(categories.map((c) => [c.category, c]))

  function assign(category: string, pairIndex: number, slotIndex: number, playerId: number | null) {
    start(async () => {
      const res = await setPairingSlot({ teamId, category, pairIndex, slotIndex, playerId })
      if (res?.error) toast.error(res.error)
      else toast.success(res?.success ?? "Updated")
    })
  }

  function sendInvite() {
    if (!inviteTarget) return
    const target = inviteTarget
    start(async () => {
      const res = await invitePlayerByEmail({
        teamId,
        email,
        category: target.category,
        pairIndex: target.pairIndex,
        slotIndex: target.slotIndex,
      })
      if (res?.error) toast.error(res.error)
      else {
        toast.success(res?.success ?? "Player added")
        setInviteTarget(null)
        setEmail("")
      }
    })
  }

  function PaidIcon({ paid }: { paid: boolean }) {
    return (
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full",
          paid ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground/40",
        )}
        title={paid ? (clubPaysFees ? "Covered by team" : "Paid") : "Unpaid"}
        aria-label={paid ? "Paid" : "Unpaid"}
      >
        <DollarSign className="h-3.5 w-3.5" />
      </span>
    )
  }

  function GenderIcon({ gender }: { gender: string | null }) {
    if (gender === "female") return <Venus className="h-3.5 w-3.5 shrink-0 text-pink-500" aria-label="Female" />
    return <Mars className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Male" />
  }

  // Players not yet placed in any slot of this category can be assigned.
  function availableFor(cat: PairingCategory | undefined): PairingPlayer[] {
    if (!cat) return roster
    const used = new Set<number>()
    cat.pairs.forEach((pair) =>
      pair.forEach((s) => {
        if (s.player) used.add(s.player.playerId)
      }),
    )
    return roster.filter((p) => !used.has(p.playerId))
  }

  // Render one category's single pair (2 slots).
  function PairBlock({ categoryName }: { categoryName: string }) {
    const cat = catByName.get(categoryName)
    const existing = cat?.pairs[0] ?? []
    // Always present exactly 2 slots so the Invite/Assign controls render for
    // every category — even ones the backend hasn't created rows for yet
    // (e.g. Ladies Open / Mens Open). Fall back to empty slots when missing.
    const pair: PairingSlot[] = [1, 2].map(
      (slotIndex) =>
        existing.find((s) => s.slotIndex === slotIndex) ?? {
          pairIndex: 1,
          slotIndex,
          player: null,
        },
    )
    const avail = availableFor(cat)
    const catInvites = invites.filter((i) => i.category === categoryName)
    const filled = pair.filter((s) => s.player).length
    const complete = filled === 2
    const isLadies = /^Ladies/.test(categoryName)
    const shortName = categoryName.replace(/^(Ladies|Mens)\s/, "")

    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-sm transition-colors",
          complete ? "border-primary/40" : "border-border",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-secondary/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full",
                isLadies ? "bg-pink-500/15 text-pink-500" : "bg-blue-500/15 text-blue-500",
              )}
            >
              {isLadies ? <Venus className="h-3.5 w-3.5" /> : <Mars className="h-3.5 w-3.5" />}
            </span>
            <p className="text-sm font-semibold">{shortName}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
              complete ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {filled}/2
          </span>
        </div>

        <div className="space-y-2 p-2.5">
          {pair.map((slot) => (
            <div
              key={slot.slotIndex}
              className={cn(
                "flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                slot.player ? "border-border bg-background" : "border-dashed border-border/70 bg-secondary/20",
              )}
            >
              {slot.player ? (
                <>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-semibold">
                        {slot.player.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-sm font-semibold">
                        <GenderIcon gender={slot.player.gender} />
                        <span className="truncate">{slot.player.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">LI {slot.player.li.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PaidIcon paid={slot.player.paid} />
                    <button
                      onClick={() => assign(categoryName, slot.pairIndex, slot.slotIndex, null)}
                      disabled={pending}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Clear slot"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/50">
                      <UserPlus className="h-4 w-4" />
                    </span>
                    Open slot
                  </span>
                  <div className="flex items-center gap-1.5">
                    {avail.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button size="sm" variant="secondary" className="h-8 px-3 text-xs" />}
                        >
                          Assign
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                          {avail.map((p) => (
                            <DropdownMenuItem
                              key={p.playerId}
                              onClick={() => assign(categoryName, slot.pairIndex, slot.slotIndex, p.playerId)}
                            >
                              {p.name} <span className="ml-1 text-muted-foreground">({p.li.toFixed(1)})</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() =>
                        setInviteTarget({
                          category: categoryName,
                          pairIndex: slot.pairIndex,
                          slotIndex: slot.slotIndex,
                        })
                      }
                    >
                      <Mail className="mr-1 h-3.5 w-3.5" />
                      Invite
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {catInvites.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              {catInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-1.5 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{inv.email}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Pending
                    </Badge>
                  </span>
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await cancelInvite(inv.id)
                        if (res?.error) toast.error(res.error)
                        else toast.success(res?.success ?? "Cancelled")
                      })
                    }
                    disabled={pending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Cancel invite"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["female", "male"] as const).map((gender) => {
          const group = PAIRING_LAYOUT[gender]
          const Icon = gender === "female" ? Venus : Mars
          return (
            <div key={gender} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", gender === "female" ? "text-pink-500" : "text-blue-500")} />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
              </div>
              {group.categories.map((name) => (
                <PairBlock key={name} categoryName={name} />
              ))}
            </div>
          )
        })}
      </div>

      <Dialog open={!!inviteTarget} onOpenChange={(open) => !open && setInviteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Player</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the player&apos;s email. If they already have a profile they&apos;ll be added to the team
            immediately; otherwise they&apos;ll be marked pending and join automatically once they create an account.
          </p>
          <Input
            type="email"
            placeholder="player@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
          />
          <Button onClick={sendInvite} disabled={pending || !email}>
            {pending ? "Adding..." : "Add player"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

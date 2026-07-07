"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { PAIRING_LAYOUT, CATEGORY_RULES } from "@/lib/constants"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Mail,
  Mars,
  Send,

  Venus,
  X,
} from "lucide-react"
import type { PairingCategory, PairingPlayer, PairingSlot } from "@/lib/queries-dashboard"

type Invite = { id: number; email: string; category: string | null }

export function PairingsBoard({
  teamId,
  categories,
  invites: initialInvites,
  clubPaysFees,
}: {
  teamId: number
  categories: PairingCategory[]
  invites: Invite[]
  clubPaysFees: boolean
}) {
  // The roster is derived directly from who is placed in pairing slots.
  const roster: PairingPlayer[] = []
  for (const cat of categories) {
    for (const pair of cat.pairs) {
      for (const slot of pair) {
        if (slot.player && !roster.find((p) => p.playerId === slot.player!.playerId)) {
          roster.push(slot.player)
        }
      }
    }
  }
  const [pending, start] = useTransition()
  const router = useRouter()
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [inviteTarget, setInviteTarget] = useState<{
    category: string
    pairIndex: number
    slotIndex: number
  } | null>(null)
  const [email, setEmail] = useState("")

  const catByName = new Map(categories.map((c) => [c.category, c]))
  const ruleByName = new Map(CATEGORY_RULES.map((r) => [r.name, r]))

  const placedIds = new Set<string>()
  categories.forEach((c) =>
    c.pairs.forEach((pair) =>
      pair.forEach((s) => {
        if (s.player) placedIds.add(s.player.playerId)
      }),
    ),
  )

  function assign(category: string, pairIndex: number, slotIndex: number, playerId: string | null) {
    start(async () => {
      const res = await setPairingSlot({ teamId, category, pairIndex, slotIndex, playerId })
      if (res?.error) toast.error(res.error)
      else {
        toast.success(res?.success ?? "Updated")
        router.refresh()
      }
    })
  }

  function sendInvite() {
    if (!inviteTarget) return
    const target = inviteTarget
    const trimmed = email.trim()
    start(async () => {
      const res = await invitePlayerByEmail({
        teamId,
        email: trimmed,
        category: target.category,
        pairIndex: target.pairIndex,
        slotIndex: target.slotIndex,
      })
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success(res?.success ?? "Invite sent")
        // Optimistically add to the invite list so it shows immediately
        setInvites((prev) => [...prev, { id: Date.now(), email: trimmed, category: target.category }])
        setInviteTarget(null)
        setEmail("")
        router.refresh()
      }
    })
  }

  function removeCancelledInvite(id: number) {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  function availableFor(_cat: PairingCategory | undefined): PairingPlayer[] {
    return roster.filter((p) => !placedIds.has(p.playerId))
  }

  function PairBlock({ categoryName }: { categoryName: string }) {
    const cat = catByName.get(categoryName)
    const existing = cat?.pairs[0] ?? []
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

    const rule = ruleByName.get(categoryName)
    const cap = rule?.avgTeamMaxLi ?? null
    const pairAvg = complete ? pair.reduce((sum, s) => sum + (s.player?.li ?? 0), 0) / 2 : null
    const overCap = pairAvg != null && cap != null && cap < 7 && pairAvg > cap

    const accentColor = isLadies
      ? "from-pink-500/20 to-pink-500/5 border-pink-500/30"
      : "from-blue-500/20 to-blue-500/5 border-blue-500/30"
    const iconBg = isLadies ? "bg-pink-500/15 text-pink-500" : "bg-blue-500/15 text-blue-500"
    const countBg = complete
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground"

    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Category header */}
        <div className={cn("bg-gradient-to-r px-4 py-3 border-b", accentColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg)}>
                {isLadies
                  ? <Venus className="h-4 w-4" />
                  : <Mars className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight">{shortName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isLadies ? "Ladies" : "Mens"} pair
                </p>
              </div>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", countBg)}>
              {filled} / 2
            </span>
          </div>
        </div>

        {/* Slots */}
        <div className="divide-y divide-border/50">
          {pair.map((slot, idx) => (
            <div key={slot.slotIndex} className="px-4 py-3">
              {slot.player ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border/60">
                      <AvatarFallback className="bg-secondary text-xs font-semibold">
                        {slot.player.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {slot.player.gender === "female"
                          ? <Venus className="h-3 w-3 text-pink-500 shrink-0" />
                          : <Mars className="h-3 w-3 text-blue-500 shrink-0" />}
                        {slot.player.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        LI {slot.player.li.toFixed(1)}
                        {!slot.player.paid && !clubPaysFees && (
                          <span className="ml-2 text-amber-500">Unpaid</span>
                        )}
                        {slot.player.paid && (
                          <span className="ml-2 text-emerald-500">
                            {clubPaysFees ? "Club pays" : "Paid"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => assign(categoryName, slot.pairIndex, slot.slotIndex, null)}
                    disabled={pending}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove from slot"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border/60 bg-muted/30">
                      <span className="text-xs font-bold text-muted-foreground/50">{idx + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Open slot</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {avail.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button size="sm" variant="secondary" className="h-7 gap-1 px-2.5 text-xs">
                              Assign <ChevronDown className="h-3 w-3" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="max-h-56 overflow-y-auto">
                          {avail.map((p) => (
                            <DropdownMenuItem
                              key={p.playerId}
                              onClick={() => assign(categoryName, slot.pairIndex, slot.slotIndex, p.playerId)}
                            >
                              <span className="flex items-center gap-2">
                                {p.gender === "female"
                                  ? <Venus className="h-3 w-3 text-pink-500" />
                                  : <Mars className="h-3 w-3 text-blue-500" />}
                                {p.name}
                              </span>
                              <span className="ml-auto pl-4 text-xs text-muted-foreground">
                                {p.li.toFixed(1)}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2.5 text-xs"
                      onClick={() =>
                        setInviteTarget({
                          category: categoryName,
                          pairIndex: slot.pairIndex,
                          slotIndex: slot.slotIndex,
                        })
                      }
                    >
                      <Mail className="h-3 w-3" />
                      Invite
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* LI cap warning */}
        {overCap && cap != null && pairAvg != null && (
          <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Avg LI <strong>{pairAvg.toFixed(2)}</strong> exceeds the {shortName} cap of{" "}
              <strong>{cap.toFixed(1)}</strong>. This pairing may be ineligible.
            </span>
          </div>
        )}

        {/* Pending invites */}
        {catInvites.length > 0 && (
          <div className="border-t border-border/50 bg-amber-500/5 px-4 py-2.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Awaiting response
            </p>
            {catInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate text-foreground/80">{inv.email}</span>
                </div>
                <button
                  onClick={() =>
                    start(async () => {
                      const res = await cancelInvite(inv.id)
                      if (res?.error) toast.error(res.error)
                      else {
                        toast.success(res?.success ?? "Cancelled")
                        removeCancelledInvite(inv.id)
                        router.refresh()
                      }
                    })
                  }
                  disabled={pending}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Cancel invite"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Invites with no category (invited without a specific slot)
  const uncategorisedInvites = invites.filter((i) => !i.category)

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {(["female", "male"] as const).map((gender) => {
          const group = PAIRING_LAYOUT[gender]
          const Icon = gender === "female" ? Venus : Mars
          const headerColor = gender === "female" ? "text-pink-500" : "text-blue-500"
          return (
            <div key={gender} className="space-y-3">
              <div className="flex items-center gap-2 pb-0.5 border-b border-border/60">
                <Icon className={cn("h-4 w-4 shrink-0", headerColor)} />
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
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

      {/* Invites not linked to a specific category slot */}
      {uncategorisedInvites.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            Pending invites — no slot assigned
          </p>
          <div className="space-y-2">
            {uncategorisedInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground/80">{inv.email}</span>
                </div>
                <button
                  onClick={() =>
                    start(async () => {
                      const res = await cancelInvite(inv.id)
                      if (res?.error) toast.error(res.error)
                      else {
                        toast.success(res?.success ?? "Cancelled")
                        removeCancelledInvite(inv.id)
                        router.refresh()
                      }
                    })
                  }
                  disabled={pending}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Cancel invite"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={!!inviteTarget} onOpenChange={(open) => !open && setInviteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Invite a player
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {inviteTarget && (
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Slot: <span className="font-semibold text-foreground">
                  {inviteTarget.category.replace(/^(Ladies|Mens)\s/, "")}
                  {" "}{inviteTarget.category.startsWith("Ladies") ? "(Ladies)" : "(Mens)"}
                  {" "}· Pair {inviteTarget.pairIndex}, slot {inviteTarget.slotIndex}
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Enter the player&apos;s email. If they already have an account they&apos;ll be added
              immediately — otherwise they&apos;ll receive an invite link.
            </p>
            <Input
              type="email"
              placeholder="player@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) sendInvite()
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setInviteTarget(null); setEmail("") }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={sendInvite}
                disabled={pending || !email.trim()}
              >
                {pending ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

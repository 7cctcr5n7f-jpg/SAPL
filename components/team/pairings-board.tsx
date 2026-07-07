"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
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
  GripVertical,
  Mail,
  Mars,
  Send,
  Venus,
  X,
} from "lucide-react"
import type { PairingCategory, PairingPlayer, PairingSlot } from "@/lib/queries-dashboard"

type Invite = { id: number; email: string; category: string | null }

// Slot drop-zone id format: "slot|{category}|{pairIndex}|{slotIndex}"
// Draggable id format:       "player|{playerId}|{fromCategory}|{fromPairIndex}|{fromSlotIndex}"

function slotId(category: string, pairIndex: number, slotIndex: number) {
  return `slot|${category}|${pairIndex}|${slotIndex}`
}

function parseDraggable(id: string) {
  const [, playerId, fromCategory, fromPairIdx, fromSlotIdx] = id.split("|")
  return { playerId, fromCategory, fromPairIndex: Number(fromPairIdx), fromSlotIndex: Number(fromSlotIdx) }
}

function parseDroppable(id: string) {
  const [, category, pairIdx, slotIdx] = id.split("|")
  return { category, pairIndex: Number(pairIdx), slotIndex: Number(slotIdx) }
}

// ─── Draggable player chip ──────────────────────────────────────────────────

function DraggablePlayer({
  slot,
  categoryName,
  isOver,
  overCap,
  clubPaysFees,
  onRemove,
  isDragging,
}: {
  slot: PairingSlot
  categoryName: string
  isOver?: boolean
  overCap: boolean
  clubPaysFees: boolean
  onRemove: () => void
  isDragging?: boolean
}) {
  const player = slot.player!
  const id = `player|${player.playerId}|${categoryName}|${slot.pairIndex}|${slot.slotIndex}`
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50, opacity: isDragging ? 0.4 : 1 }
    : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors",
        overCap ? "bg-red-50 border border-red-200" : "bg-white",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Avatar className="h-9 w-9 border border-slate-200">
          <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
            {player.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold text-slate-800">
            {player.gender === "female"
              ? <Venus className="h-3 w-3 text-pink-500 shrink-0" />
              : <Mars className="h-3 w-3 text-blue-500 shrink-0" />}
            {player.name}
            {overCap && (
              <span title="Player PT rating exceeds category cap">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            LI {player.li.toFixed(1)}
            {player.playtomicRating != null && (
              <span className={cn("font-medium", overCap ? "text-red-600" : "text-slate-500")}>
                · PT {player.playtomicRating.toFixed(2)}
              </span>
            )}
            {!player.paid && !clubPaysFees && (
              <span className="text-amber-600">· Unpaid</span>
            )}
            {player.paid && (
              <span className="text-emerald-600">
                · {clubPaysFees ? "Club pays" : "Paid"}
              </span>
            )}
          </p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label="Remove from slot"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Drop zone slot ─────────────────────────────────────────────────────────

function DroppableSlot({
  slot,
  categoryName,
  avail,
  clubPaysFees,
  overCap,
  onAssign,
  onRemove,
  onInvite,
  pending,
  activePlayerId,
}: {
  slot: PairingSlot
  categoryName: string
  avail: PairingPlayer[]
  clubPaysFees: boolean
  overCap: boolean
  onAssign: (playerId: string) => void
  onRemove: () => void
  onInvite: () => void
  pending: boolean
  activePlayerId: string | null
}) {
  const droppableId = slotId(categoryName, slot.pairIndex, slot.slotIndex)
  const { isOver, setNodeRef } = useDroppable({ id: droppableId })

  const isDraggingThisPlayer = slot.player?.playerId === activePlayerId

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "px-4 py-3 transition-colors rounded-lg",
        isOver && !slot.player ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : "",
        isOver && slot.player ? "bg-amber-50 ring-2 ring-amber-300 ring-inset" : "",
      )}
    >
      {slot.player ? (
        <DraggablePlayer
          slot={slot}
          categoryName={categoryName}
          overCap={overCap}
          clubPaysFees={clubPaysFees}
          onRemove={onRemove}
          isDragging={isDraggingThisPlayer}
        />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed transition-colors",
              isOver ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50",
            )}>
              <span className="text-xs font-bold text-slate-400">{slot.slotIndex}</span>
            </div>
            <p className={cn("text-sm", isOver ? "text-blue-600 font-medium" : "text-slate-400")}>
              {isOver ? "Drop here" : "Open slot"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {avail.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="outline" className="h-8 gap-1 px-3 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                      Assign <ChevronDown className="h-3 w-3" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="max-h-56 overflow-y-auto bg-white">
                  {avail.map((p) => (
                    <DropdownMenuItem
                      key={p.playerId}
                      onClick={() => onAssign(p.playerId)}
                    >
                      <span className="flex items-center gap-2">
                        {p.gender === "female"
                          ? <Venus className="h-3 w-3 text-pink-500" />
                          : <Mars className="h-3 w-3 text-blue-500" />}
                        {p.name}
                      </span>
                      <span className="ml-auto pl-4 text-xs text-slate-400">
                        LI {p.li.toFixed(1)}
                        {p.playtomicRating != null && ` · PT ${p.playtomicRating.toFixed(2)}`}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-3 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={onInvite}
            >
              <Mail className="h-3 w-3" />
              Invite
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Drag overlay card ──────────────────────────────────────────────────────

function PlayerDragOverlay({ player }: { player: PairingPlayer }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg opacity-95">
      <GripVertical className="h-4 w-4 text-slate-400" />
      <Avatar className="h-8 w-8 border border-slate-200">
        <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
          {player.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-semibold text-slate-800">{player.name}</p>
        <p className="text-xs text-slate-500">
          LI {player.li.toFixed(1)}
          {player.playtomicRating != null && ` · PT ${player.playtomicRating.toFixed(2)}`}
        </p>
      </div>
    </div>
  )
}

// ─── Main board ─────────────────────────────────────────────────────────────

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
  const [activePlayer, setActivePlayer] = useState<PairingPlayer | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

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

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (!id.startsWith("player|")) return
    const { playerId } = parseDraggable(id)
    const player = roster.find((p) => p.playerId === playerId) ?? null
    setActivePlayer(player)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePlayer(null)
    const overId = event.over?.id
    const activeId = String(event.active.id)
    if (!overId || !activeId.startsWith("player|")) return

    const { playerId, fromCategory, fromPairIndex, fromSlotIndex } = parseDraggable(activeId)
    const { category: toCategory, pairIndex: toPairIndex, slotIndex: toSlotIndex } = parseDroppable(String(overId))

    // Same slot — no-op
    if (fromCategory === toCategory && fromPairIndex === toPairIndex && fromSlotIndex === toSlotIndex) return

    const targetCat = catByName.get(toCategory)
    const targetSlot = targetCat?.pairs[toPairIndex - 1]?.find(
      (s) => s.pairIndex === toPairIndex && s.slotIndex === toSlotIndex,
    )

    start(async () => {
      // If target slot has a player, swap them
      if (targetSlot?.player) {
        const displacedId = targetSlot.player.playerId
        // Move displaced player to the source slot
        await setPairingSlot({ teamId, category: fromCategory, pairIndex: fromPairIndex, slotIndex: fromSlotIndex, playerId: displacedId })
        // Move dragged player to the target slot
        const res = await setPairingSlot({ teamId, category: toCategory, pairIndex: toPairIndex, slotIndex: toSlotIndex, playerId })
        if (res?.error) toast.error(res.error)
        else toast.success("Players swapped")
      } else {
        // Clear source, fill target
        await setPairingSlot({ teamId, category: fromCategory, pairIndex: fromPairIndex, slotIndex: fromSlotIndex, playerId: null })
        const res = await setPairingSlot({ teamId, category: toCategory, pairIndex: toPairIndex, slotIndex: toSlotIndex, playerId })
        if (res?.error) toast.error(res.error)
        else toast.success("Player moved")
      }
      router.refresh()
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
    const ptCap = rule?.avgTeamMaxLi ?? null // Using LI cap as proxy; no separate PT cap in rules
    const cap = rule?.avgTeamMaxLi ?? null
    const pairAvg = complete ? pair.reduce((sum, s) => sum + (s.player?.li ?? 0), 0) / 2 : null
    const overCap = pairAvg != null && cap != null && cap < 7 && pairAvg > cap

    // Per-player: flag red if their PT rating exceeds the category LI cap
    function playerOverCap(player: PairingPlayer | null) {
      if (!player || !ptCap || ptCap >= 7) return false
      return (player.playtomicRating ?? 0) > ptCap
    }

    const accentBorder = isLadies ? "border-pink-300" : "border-blue-300"
    const accentHeader = isLadies
      ? "bg-pink-50 border-b border-pink-200"
      : "bg-blue-50 border-b border-blue-200"
    const iconBg = isLadies ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"
    const countBg = complete
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-500"

    return (
      <div className={cn("overflow-hidden rounded-xl border bg-white shadow-sm", accentBorder)}>
        <div className={cn("px-4 py-3", accentHeader)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg)}>
                {isLadies ? <Venus className="h-4 w-4" /> : <Mars className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight text-slate-800">{shortName}</p>
                <p className="text-[11px] text-slate-500">
                  {isLadies ? "Ladies" : "Mens"} pair
                  {cap != null && cap < 7 && (
                    <span className="ml-1 text-slate-400">· max LI {cap.toFixed(1)}</span>
                  )}
                </p>
              </div>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", countBg)}>
              {filled} / 2
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {pair.map((slot) => (
            <DroppableSlot
              key={slot.slotIndex}
              slot={slot}
              categoryName={categoryName}
              avail={avail}
              clubPaysFees={clubPaysFees}
              overCap={playerOverCap(slot.player)}
              onAssign={(pid) => assign(categoryName, slot.pairIndex, slot.slotIndex, pid)}
              onRemove={() => assign(categoryName, slot.pairIndex, slot.slotIndex, null)}
              onInvite={() => setInviteTarget({ category: categoryName, pairIndex: slot.pairIndex, slotIndex: slot.slotIndex })}
              pending={pending}
              activePlayerId={activePlayer?.playerId ?? null}
            />
          ))}
        </div>

        {overCap && cap != null && pairAvg != null && (
          <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Avg LI <strong>{pairAvg.toFixed(2)}</strong> exceeds the {shortName} cap of{" "}
              <strong>{cap.toFixed(1)}</strong>. This pairing may be ineligible.
            </span>
          </div>
        )}

        {catInvites.length > 0 && (
          <div className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">
              Awaiting response
            </p>
            {catInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate text-slate-600">{inv.email}</span>
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
                  className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-red-500"
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

  const uncategorisedInvites = invites.filter((i) => !i.category)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {(["female", "male"] as const).map((gender) => {
            const group = PAIRING_LAYOUT[gender]
            const Icon = gender === "female" ? Venus : Mars
            const headerColor = gender === "female" ? "text-pink-500" : "text-blue-500"
            const dividerColor = gender === "female" ? "border-pink-200" : "border-blue-200"
            return (
              <div key={gender} className="space-y-3">
                <div className={cn("flex items-center gap-2 pb-1 border-b", dividerColor)}>
                  <Icon className={cn("h-4 w-4 shrink-0", headerColor)} />
                  <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
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

        {uncategorisedInvites.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Clock className="h-4 w-4" />
              Pending invites — no slot assigned
            </p>
            <div className="space-y-2">
              {uncategorisedInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-600">{inv.email}</span>
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
                    className="shrink-0 text-slate-400 transition-colors hover:text-red-500"
                    aria-label="Cancel invite"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Dialog open={!!inviteTarget} onOpenChange={(open) => !open && setInviteTarget(null)}>
          <DialogContent className="w-[92vw] max-w-sm bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800">
                <Send className="h-4 w-4 text-primary" />
                Invite a player
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              {inviteTarget && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Slot:{" "}
                  <span className="font-semibold text-slate-700">
                    {inviteTarget.category.replace(/^(Ladies|Mens)\s/, "")}
                    {" "}{inviteTarget.category.startsWith("Ladies") ? "(Ladies)" : "(Mens)"}
                    {" "}· Pair {inviteTarget.pairIndex}, slot {inviteTarget.slotIndex}
                  </span>
                </div>
              )}
              <p className="text-sm text-slate-500">
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
                className="border-slate-200 bg-white text-slate-800 placeholder:text-slate-400"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
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

      <DragOverlay>
        {activePlayer ? <PlayerDragOverlay player={activePlayer} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

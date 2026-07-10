"use client"

import { useState, useTransition, useEffect, useRef } from "react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { invitePlayerByEmail, lookupPlayerByEmail, inviteMarketplacePlayer, getFreeAgentsAction, getRegisteredFreeAgentsAction, addRegisteredPlayerDirectly } from "@/lib/actions/pairings"
import { toast } from "sonner"
import { UserPlus, Mail, Users, Loader2, CheckCircle2, Search, Star, UserCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type Tab = "email" | "marketplace" | "registered"

type FreeAgent = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  playtomicRating: number | null
  city: string | null
  province: string | null
  avatarUrl: string | null
}

type RegisteredPlayer = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  playtomicRating: number | null
  city: string | null
  province: string | null
  avatarUrl: string | null
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

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
  const [tab, setTab] = useState<Tab>("email")
  const [pending, start] = useTransition()

  // Email tab state
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [rating, setRating] = useState("")
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not-found">("idle")
  const [nameReadonly, setNameReadonly] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Marketplace tab state
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [inviting, setInviting] = useState<string | null>(null)

  // Registered players tab state
  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([])
  const [registeredLoading, setRegisteredLoading] = useState(false)
  const [registeredSearch, setRegisteredSearch] = useState("")
  const [adding, setAdding] = useState<string | null>(null)

  function reset() {
    setEmail("")
    setName("")
    setRating("")
    setLookupState("idle")
    setNameReadonly(false)
    setSearch("")
    setRegisteredSearch("")
    setTab("email")
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
  }

  // Live email lookup with 600ms debounce
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    const trimmed = email.trim()
    if (!trimmed.includes("@") || trimmed.length < 5) {
      setLookupState("idle")
      setNameReadonly(false)
      return
    }
    setLookupState("loading")
    lookupTimer.current = setTimeout(() => {
      start(async () => {
        const res = await lookupPlayerByEmail(trimmed)
        if (res.found && res.name) {
          setName(res.name)
          setNameReadonly(true)
          if (res.playtomicRating != null) setRating(String(res.playtomicRating))
          setLookupState("found")
        } else {
          setNameReadonly(false)
          setLookupState("not-found")
        }
      })
    }, 600)
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // Load free agents when marketplace tab is opened
  useEffect(() => {
    if (tab !== "marketplace" || freeAgents.length > 0) return
    setAgentsLoading(true)
    getFreeAgentsAction().then((agents) => {
      setFreeAgents(agents as FreeAgent[])
      setAgentsLoading(false)
    })
  }, [tab, freeAgents.length])

  // Load registered players (no active team) when that tab is opened
  useEffect(() => {
    if (tab !== "registered" || registeredPlayers.length > 0) return
    setRegisteredLoading(true)
    getRegisteredFreeAgentsAction(teamId).then((players) => {
      setRegisteredPlayers(players as RegisteredPlayer[])
      setRegisteredLoading(false)
    })
  }, [tab, registeredPlayers.length, teamId])

  function submitEmail() {
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

  function addFromRegistered(playerId: string) {
    setAdding(playerId)
    start(async () => {
      const res = await addRegisteredPlayerDirectly({ teamId, playerId })
      setAdding(null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.success ?? "Player added to your team.")
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  function inviteFromMarketplace(playerId: string) {
    setInviting(playerId)
    start(async () => {
      const res = await inviteMarketplacePlayer({ teamId, playerId })
      setInviting(null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.success ?? "Player invited.")
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  const filteredAgents = freeAgents.filter((a) => {
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      (a.city ?? "").toLowerCase().includes(q) ||
      (a.province ?? "").toLowerCase().includes(q)
    )
  })

  const filteredRegistered = registeredPlayers.filter((p) => {
    const q = registeredSearch.toLowerCase()
    const fullName = p.firstName ? `${p.firstName} ${p.lastName ?? ""}`.trim() : p.name
    return (
      fullName.toLowerCase().includes(q) ||
      (p.city ?? "").toLowerCase().includes(q) ||
      (p.province ?? "").toLowerCase().includes(q)
    )
  })

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a player</DialogTitle>
          <DialogDescription>
            {slotsRemaining > 0
              ? `${slotsRemaining} open slot${slotsRemaining === 1 ? "" : "s"} remaining in your squad.`
              : "Your squad is full."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
              tab === "email"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Invite by</span> Email
          </button>
          <button
            type="button"
            onClick={() => setTab("registered")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-border",
              tab === "registered"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span> Registered
          </button>
          <button
            type="button"
            onClick={() => setTab("marketplace")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-border",
              tab === "marketplace"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Marketplace</span>
            <span className="sm:hidden">Market</span>
          </button>
        </div>

        {/* Email tab */}
        {tab === "email" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apEmail">Email</Label>
              <div className="relative">
                <Input
                  id="apEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  autoComplete="off"
                  className="h-11 pr-9"
                />
                {lookupState === "loading" && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {lookupState === "found" && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                )}
              </div>
              {lookupState === "found" && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Registered player found — name auto-filled.
                </p>
              )}
              {lookupState === "not-found" && (
                <p className="text-xs text-muted-foreground">
                  No account found — an invite email will be sent when you submit.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apName">
                Player name{nameReadonly ? "" : " (optional)"}
              </Label>
              <Input
                id="apName"
                value={name}
                onChange={(e) => !nameReadonly && setName(e.target.value)}
                placeholder="Alex Player"
                autoComplete="off"
                readOnly={nameReadonly}
                className={cn("h-11", nameReadonly && "bg-muted/40 text-muted-foreground cursor-not-allowed")}
              />
              {nameReadonly && (
                <p className="text-xs text-muted-foreground">Name locked from registered profile.</p>
              )}
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
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Used to calculate your team&apos;s average rating (0–7).</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={submitEmail} disabled={pending || slotsRemaining <= 0}>
                {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {lookupState === "found" ? "Add player" : "Send invite"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Registered players tab */}
        {tab === "registered" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              All registered players who are not currently on a team. Click <strong>Add</strong> to place them directly on your roster — no invite email required.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={registeredSearch}
                onChange={(e) => setRegisteredSearch(e.target.value)}
                placeholder="Search by name, city or province..."
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {registeredLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRegistered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <UserCheck className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {registeredSearch
                    ? "No registered players match your search."
                    : "No registered players without a team found."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {filteredRegistered.map((p) => {
                  const displayName = p.firstName
                    ? `${p.firstName} ${p.lastName ?? ""}`.trim()
                    : p.name
                  const location = [p.city, p.province].filter(Boolean).join(", ")
                  const isAdding = adding === p.id

                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card"
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-border">
                        <AvatarFallback className="bg-secondary text-xs font-semibold">
                          {initials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.playtomicRating != null && p.playtomicRating > 0 ? (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              {p.playtomicRating.toFixed(1)}
                            </span>
                          ) : null}
                          {location ? (
                            <span className="text-xs text-muted-foreground truncate">{location}</span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={pending || slotsRemaining <= 0 || isAdding}
                        onClick={() => addFromRegistered(p.id)}
                        className="shrink-0"
                      >
                        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {slotsRemaining <= 0 && (
              <p className="text-center text-xs text-destructive">Squad is full — remove a player first.</p>
            )}
          </div>
        )}

        {/* Marketplace tab */}
        {tab === "marketplace" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, city or province..."
                className="pl-9 h-11"
              />
            </div>

            {agentsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {search ? "No players match your search." : "No players are currently on the marketplace."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {filteredAgents.map((a) => {
                  const displayName = a.firstName
                    ? `${a.firstName} ${a.lastName ?? ""}`.trim()
                    : a.name
                  const location = [a.city, a.province].filter(Boolean).join(", ")
                  const isInviting = inviting === a.id

                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card"
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-border">
                        <AvatarFallback className="bg-secondary text-xs font-semibold">
                          {initials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.playtomicRating != null && a.playtomicRating > 0 ? (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              {a.playtomicRating.toFixed(1)}
                            </span>
                          ) : null}
                          {location ? (
                            <span className="text-xs text-muted-foreground truncate">{location}</span>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs hidden sm:flex">
                        Free agent
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || slotsRemaining <= 0 || isInviting}
                        onClick={() => inviteFromMarketplace(a.id)}
                        className="shrink-0"
                      >
                        {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Invite"}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {slotsRemaining <= 0 && (
              <p className="text-center text-xs text-destructive">Squad is full — remove a player first.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

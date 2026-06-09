"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createOwnTeam, setMarketplaceListing } from "@/lib/actions/org"
import { TEAM_TYPES, SAPL_REGIONS } from "@/lib/constants"
import { fmtZAR } from "@/lib/format"
import { CheckCircle2, AlertCircle, Plus, Store, Shield, ArrowRight } from "lucide-react"

const SELF_SERVICE_TEAM_TYPES = TEAM_TYPES.filter((t) => t !== "Club Team")

type HeroTeam = {
  teamId: number
  teamName: string
  divisionName: string
  seasonIsCurrent: boolean
  role: string | null
}

/**
 * Sports-style overview header. Surfaces the two things a player checks first:
 * whether their account is paid up (a simple green tick when settled), and the
 * team they belong to. Create-team and marketplace are compact buttons rather
 * than full blocks.
 */
export function PlayerHero({
  firstName,
  leagueIndex,
  outstanding,
  activeTeams,
  hasPlayerProfile,
  listedOnMarketplace,
}: {
  firstName: string
  leagueIndex: number | null
  outstanding: number
  activeTeams: HeroTeam[]
  hasPlayerProfile: boolean
  listedOnMarketplace: boolean
}) {
  const paidUp = outstanding <= 0
  const primaryTeam = activeTeams[0] ?? null

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
      {/* Status strip — instant read on whether the account is settled. */}
      <div
        className={`flex items-center gap-3 px-5 py-3.5 ${
          paidUp ? "bg-emerald-500/10 text-emerald-400" : "bg-primary/10 text-primary"
        }`}
      >
        {paidUp ? (
          <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden />
        ) : (
          <AlertCircle className="h-6 w-6 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            {paidUp ? "Account up to date" : `${fmtZAR(outstanding)} outstanding`}
          </p>
          <p className="text-xs opacity-80">
            {paidUp ? "All your league fees are settled." : "You have league fees due."}
          </p>
        </div>
        {!paidUp && (
          <Button
            size="sm"
            variant="default"
            className="shrink-0"
            render={
              <a href="#fees">
                Pay now <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Identity + team */}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-balance">{firstName}</h1>

          {primaryTeam ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
                <Shield className="h-4 w-4 text-primary" aria-hidden />
                {primaryTeam.teamName}
              </span>
              <Badge variant="outline" className="font-medium">
                {primaryTeam.divisionName}
              </Badge>
              {primaryTeam.role === "captain" && <Badge className="font-medium">Captain</Badge>}
              {activeTeams.length > 1 && (
                <span className="text-xs text-muted-foreground">+{activeTeams.length - 1} more</span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              You&apos;re not on a team yet — create one or join the marketplace.
            </p>
          )}
        </div>

        {/* League Index + quick actions */}
        <div className="flex shrink-0 items-center gap-4">
          {leagueIndex != null && (
            <div className="rounded-lg border border-border bg-background px-4 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">League Index</p>
              <p className="font-mono text-xl font-bold tabular-nums">{leagueIndex.toFixed(2)}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <CreateTeamButton />
            <MarketplaceButton hasPlayerProfile={hasPlayerProfile} listed={listedOnMarketplace} />
          </div>
        </div>
      </div>
    </section>
  )
}

function CreateTeamButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [teamType, setTeamType] = useState<string>(SELF_SERVICE_TEAM_TYPES[0])
  const [saplRegion, setSaplRegion] = useState<string>("")
  const [pending, start] = useTransition()
  const router = useRouter()

  function submit() {
    if (!name.trim()) {
      toast.error("Team name is required")
      return
    }
    if (!saplRegion) {
      toast.error("Select the region you'll play in")
      return
    }
    start(async () => {
      const res = await createOwnTeam({ name, teamType, saplRegion })
      if (res.ok) {
        toast.success("Team created — you're now the team owner")
        setOpen(false)
        setName("")
        setSaplRegion("")
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to create team")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="w-full justify-start sm:w-44">
            <Plus className="mr-1.5 h-4 w-4" /> Create a team
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your team</DialogTitle>
          <DialogDescription>
            You become the team owner immediately and gain access to team management tools.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heroTeamName">Team name</Label>
            <Input
              id="heroTeamName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Smashers"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroTeamType">Team type</Label>
            <select
              id="heroTeamType"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SELF_SERVICE_TEAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroTeamRegion">Region</Label>
            <select
              id="heroTeamRegion"
              value={saplRegion}
              onChange={(e) => setSaplRegion(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Select your region…
              </option>
              {SAPL_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              The league office places your team into a division within this region.
            </p>
          </div>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create Team"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MarketplaceButton({ hasPlayerProfile, listed }: { hasPlayerProfile: boolean; listed: boolean }) {
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
    <Button
      onClick={toggle}
      disabled={pending}
      size="sm"
      variant="outline"
      className="w-full justify-start sm:w-44"
    >
      <Store className="mr-1.5 h-4 w-4" />
      {isListed ? "Listed — remove" : "Join marketplace"}
    </Button>
  )
}

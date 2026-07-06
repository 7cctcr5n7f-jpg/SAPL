"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  Users,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"
import {
  checkEmailInvite,
  registerPlayer,
  registerTeam,
} from "@/lib/actions/join"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Path = "choose" | "team" | "player"

type TeamStep = "details" | "payment" | "venue" | "account" | "review"
type PlayerStep = "email" | "invite-check" | "account" | "review"

export type HostingClub = { id: number; name: string; saplRegion: string | null; courts: number }

interface Props {
  hostingClubs: HostingClub[]
  playerFee: number
  teamFee: number
}

// ---------------------------------------------------------------------------
// Playtomic help tooltip
// ---------------------------------------------------------------------------

function PlaytomicHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5 rounded-md border border-border bg-muted/40 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground"
      >
        <span>How do I find my Playtomic link?</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <ol className="border-t border-border px-3 py-3 space-y-1.5 text-muted-foreground list-decimal list-inside">
          <li>Open the <strong className="text-foreground">Playtomic app</strong> on your phone</li>
          <li>Tap the <strong className="text-foreground">menu icon</strong> (three lines) in the top right</li>
          <li>Tap <strong className="text-foreground">Share profile</strong></li>
          <li>Copy the link and paste it here</li>
        </ol>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i < current ? "bg-primary w-4" : i === current ? "bg-primary w-4" : "bg-border w-1.5",
          )}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Path Chooser
// ---------------------------------------------------------------------------

function PathChooser({ onChoose }: { onChoose: (p: "team" | "player") => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading text-3xl text-balance">Join the League</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How would you like to participate in SAPL?
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("team")}
          className="group flex flex-col gap-3 rounded-lg border-2 border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground group-hover:text-primary">Create a Team</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Register a new team and become the team captain. You&apos;ll manage your roster, choose your home venue, and lead your squad through the season.
            </p>
          </div>
          <span className="mt-auto text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Get started &rarr;
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoose("player")}
          className="group flex flex-col gap-3 rounded-lg border-2 border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground group-hover:text-primary">Register as Player</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Join as an individual player. Accept a team invitation if you have one, or join the player marketplace so captains can find and invite you.
            </p>
          </div>
          <span className="mt-auto text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Get started &rarr;
          </span>
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already competing?{" "}
        <a href="/sign-in" className="text-primary hover:underline">
          Sign in
        </a>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team Registration Flow
// ---------------------------------------------------------------------------

const TEAM_STEPS: TeamStep[] = ["details", "payment", "venue", "account", "review"]
const TEAM_STEP_LABELS: Record<TeamStep, string> = {
  details: "Team Details",
  payment: "Payment Model",
  venue: "Home Venue",
  account: "Your Account",
  review: "Review & Submit",
}

function TeamFlow({
  hostingClubs,
  playerFee,
  teamFee,
  onBack,
}: {
  hostingClubs: HostingClub[]
  playerFee: number
  teamFee: number
  onBack: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<TeamStep>("details")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [teamName, setTeamName] = useState("")
  const [paymentModel, setPaymentModel] = useState<"club" | "individual">("club")
  const [homeClubId, setHomeClubId] = useState<string>("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [captainPlays, setCaptainPlays] = useState<"yes" | "no">("yes")
  const [playtomicUrl, setPlaytomicUrl] = useState("")

  const stepIndex = TEAM_STEPS.indexOf(step)
  const selectedClub = hostingClubs.find((c) => String(c.id) === homeClubId)

  function nextStep() {
    setError(null)
    if (step === "details") {
      if (!teamName.trim()) { setError("Please enter a team name."); return }
      setStep("payment")
    } else if (step === "payment") {
      setStep("venue")
    } else if (step === "venue") {
      if (!homeClubId) { setError("Please select a home venue."); return }
      setStep("account")
    } else if (step === "account") {
      if (!fullName.trim()) { setError("Please enter your full name."); return }
      if (!email.trim()) { setError("Please enter your email."); return }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return }
      if (captainPlays === "yes" && !playtomicUrl.trim()) { setError("Please add your Playtomic profile link."); return }
      setStep("review")
    }
  }

  function prevStep() {
    setError(null)
    const prev = TEAM_STEPS[stepIndex - 1]
    if (prev) setStep(prev)
    else onBack()
  }

  function submit() {
    startTransition(async () => {
      setError(null)
      const res = await registerTeam({
        fullName,
        email,
        password,
        teamName,
        paymentModel,
        homeClubId: Number(homeClubId),
        captainPlays: captainPlays === "yes",
        playtomicUrl,
      })
      if (!res.ok) { setError(res.error); return }
      router.push(res.redirectTo)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevStep} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <StepDots total={TEAM_STEPS.length} current={stepIndex} />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Create a Team &mdash; {TEAM_STEP_LABELS[step]}</p>
        {step === "details" && <h2 className="heading text-2xl mt-1">What&apos;s your team called?</h2>}
        {step === "payment" && <h2 className="heading text-2xl mt-1">How will fees be paid?</h2>}
        {step === "venue" && <h2 className="heading text-2xl mt-1">Where will you play?</h2>}
        {step === "account" && <h2 className="heading text-2xl mt-1">Set up your captain account</h2>}
        {step === "review" && <h2 className="heading text-2xl mt-1">Review your registration</h2>}
      </div>

      {/* Step content */}
      {step === "details" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="teamName">Team name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Northcliff A"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) nextStep() }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            As team captain you will manage your roster, confirm fixtures, and submit match results.
            You&apos;re responsible for ensuring all players on your team register and pay their fees.
          </p>
        </div>
      )}

      {step === "payment" && (
        <div className="flex flex-col gap-4">
          <RadioGroup value={paymentModel} onValueChange={(v: string) => setPaymentModel(v as "club" | "individual")}>
            <label className={cn("flex cursor-pointer gap-4 rounded-lg border-2 p-4 transition-colors", paymentModel === "club" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
              <RadioGroupItem value="club" id="pay-club" className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Club pays — R{teamFee.toLocaleString()}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">A single team registration fee covering all players. Ideal for club-sponsored teams.</p>
              </div>
            </label>
            <label className={cn("flex cursor-pointer gap-4 rounded-lg border-2 p-4 transition-colors", paymentModel === "individual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
              <RadioGroupItem value="individual" id="pay-individual" className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Each player pays — R{playerFee.toLocaleString()} / player</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Every player on the roster pays their own registration fee individually.</p>
              </div>
            </label>
          </RadioGroup>
        </div>
      )}

      {step === "venue" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Home club / venue</Label>
            <Select value={homeClubId} onValueChange={(v) => setHomeClubId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select your home venue..." />
              </SelectTrigger>
              <SelectContent>
                {hostingClubs.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}{c.saplRegion ? ` · ${c.saplRegion}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedClub && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{selectedClub.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedClub.courts} court{selectedClub.courts !== 1 ? "s" : ""}{selectedClub.saplRegion ? ` · ${selectedClub.saplRegion}` : ""}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Your home club is where your team hosts league nights. Only clubs that have confirmed they will host are shown.
          </p>
        </div>
      )}

      {step === "account" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="captainName">Full name</Label>
            <Input id="captainName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="captainEmail">Email</Label>
            <Input id="captainEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="captainPw">Password</Label>
            <Input id="captainPw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Will you play in the team yourself?</Label>
            <RadioGroup value={captainPlays} onValueChange={(v: string) => setCaptainPlays(v as "yes" | "no")} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="yes" id="plays-yes" /> <span className="text-sm">Yes, I&apos;ll play</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="no" id="plays-no" /> <span className="text-sm">No, I&apos;m only captain</span>
              </label>
            </RadioGroup>
          </div>

          {captainPlays === "yes" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="captainPlaytomic">
                Playtomic profile link <span className="text-destructive">*</span>
              </Label>
              <Input
                id="captainPlaytomic"
                value={playtomicUrl}
                onChange={(e) => setPlaytomicUrl(e.target.value)}
                placeholder="https://app.playtomic.io/user/..."
              />
              <PlaytomicHelp />
            </div>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-3">
          {[
            { label: "Team name", value: teamName },
            { label: "Payment", value: paymentModel === "club" ? `Club pays R${teamFee.toLocaleString()}` : `Individual R${playerFee.toLocaleString()} / player` },
            { label: "Home venue", value: selectedClub?.name ?? "—" },
            { label: "Captain", value: fullName },
            { label: "Email", value: email },
            { label: "Captain plays", value: captainPlays === "yes" ? "Yes" : "No" },
            ...(captainPlays === "yes" ? [{ label: "Playtomic", value: playtomicUrl }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
              <span className="text-xs text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm text-right break-all">{value}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">
            Your team will be submitted for review. You&apos;ll receive a confirmation once it&apos;s approved and placed in a division.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        {step === "review" ? (
          <Button className="flex-1" onClick={submit} disabled={pending} size="lg">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register Team"}
          </Button>
        ) : (
          <Button className="flex-1" onClick={nextStep} size="lg">
            Continue
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Player Registration Flow
// ---------------------------------------------------------------------------

const PLAYER_STEPS: PlayerStep[] = ["email", "invite-check", "account", "review"]

function PlayerFlow({ playerFee, onBack }: { playerFee: number; onBack: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<PlayerStep>("email")
  const [pending, startTransition] = useTransition()
  const [checkingEmail, startEmailCheck] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [playtomicUrl, setPlaytomicUrl] = useState("")
  const [joinMarketplace, setJoinMarketplace] = useState(true)

  const [invite, setInvite] = useState<{ teamName: string; category: string; invitedName: string | null; token: string } | null | "loading">(null)
  const [acceptInvite, setAcceptInvite] = useState(true)

  const stepIndex = PLAYER_STEPS.indexOf(step)

  function checkEmail() {
    if (!email.trim()) { setError("Please enter your email."); return }
    setError(null)
    setInvite("loading")
    startEmailCheck(async () => {
      const result = await checkEmailInvite(email.trim().toLowerCase())
      setInvite(result)
      setStep("invite-check")
    })
  }

  function prevStep() {
    setError(null)
    if (step === "invite-check") { setStep("email"); return }
    if (step === "account") { setStep("invite-check"); return }
    if (step === "review") { setStep("account"); return }
    onBack()
  }

  function toAccount() {
    setError(null)
    setStep("account")
  }

  function toReview() {
    setError(null)
    if (!fullName.trim()) { setError("Please enter your full name."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (!playtomicUrl.trim()) { setError("Please add your Playtomic profile link."); return }
    setStep("review")
  }

  function submit() {
    startTransition(async () => {
      setError(null)
      const res = await registerPlayer({
        fullName,
        email,
        password,
        playtomicUrl,
        joinMarketplace: invite && typeof invite !== "string" ? false : joinMarketplace,
        inviteToken: invite && typeof invite !== "string" && acceptInvite ? invite.token : undefined,
      })
      if (!res.ok) { setError(res.error); return }
      router.push(res.redirectTo)
      router.refresh()
    })
  }

  const hasInvite = invite && typeof invite !== "string" && invite !== null

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevStep} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <StepDots total={PLAYER_STEPS.length} current={stepIndex} />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Register as Player</p>
        {step === "email" && <h2 className="heading text-2xl mt-1">What&apos;s your email?</h2>}
        {step === "invite-check" && <h2 className="heading text-2xl mt-1">{hasInvite ? "You have an invitation!" : "Join the marketplace"}</h2>}
        {step === "account" && <h2 className="heading text-2xl mt-1">Create your account</h2>}
        {step === "review" && <h2 className="heading text-2xl mt-1">Review & submit</h2>}
      </div>

      {/* Email step */}
      {step === "email" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="playerEmail">Email address</Label>
            <Input
              id="playerEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) checkEmail()
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll check if a team has already invited you to join.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={checkEmail} disabled={checkingEmail} size="lg">
            {checkingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
          </Button>
        </div>
      )}

      {/* Invite-check step */}
      {step === "invite-check" && (
        <div className="flex flex-col gap-4">
          {invite === "loading" || checkingEmail ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking for invitations...
            </div>
          ) : hasInvite && invite ? (
            <>
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">
                      {invite.invitedName ? `${invite.invitedName}, you've` : "You've"} been invited to join{" "}
                      <span className="text-primary">{invite.teamName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Category: <strong>{invite.category}</strong>
                    </p>
                  </div>
                </div>
              </div>
              <RadioGroup
                value={acceptInvite ? "yes" : "no"}
                onValueChange={(v: string) => setAcceptInvite(v === "yes")}
              >
                <label className={cn("flex cursor-pointer gap-3 rounded-lg border-2 p-3.5 transition-colors", acceptInvite ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                  <RadioGroupItem value="yes" id="accept-yes" className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Accept invitation and join {invite.teamName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You&apos;ll be added to the team roster on registration.</p>
                  </div>
                </label>
                <label className={cn("flex cursor-pointer gap-3 rounded-lg border-2 p-3.5 transition-colors", !acceptInvite ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                  <RadioGroupItem value="no" id="accept-no" className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Decline and join the player marketplace instead</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Captains will be able to find and invite you.</p>
                  </div>
                </label>
              </RadioGroup>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No pending team invitation was found for <strong className="text-foreground">{email}</strong>.
              </p>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="font-medium text-sm">Join the player marketplace</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Your profile will be visible to team captains searching for players. Once a captain invites you, you can accept and join their team.
                </p>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinMarketplace}
                    onChange={(e) => setJoinMarketplace(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="text-sm">Yes, add me to the player marketplace</span>
                </label>
              </div>
            </>
          )}
          <Button onClick={toAccount} size="lg">Continue</Button>
        </div>
      )}

      {/* Account step */}
      {step === "account" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="playerName">Full name</Label>
            <Input id="playerName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Email</Label>
            <p className="text-sm border border-border rounded-md px-3 py-2 bg-muted/40 text-muted-foreground">{email}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="playerPw">Password</Label>
            <Input id="playerPw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="playerPlaytomic">
              Playtomic profile link <span className="text-destructive">*</span>
            </Label>
            <Input
              id="playerPlaytomic"
              value={playtomicUrl}
              onChange={(e) => setPlaytomicUrl(e.target.value)}
              placeholder="https://app.playtomic.io/user/..."
            />
            <PlaytomicHelp />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={toReview} size="lg">Continue</Button>
        </div>
      )}

      {/* Review step */}
      {step === "review" && (
        <div className="flex flex-col gap-3">
          {[
            { label: "Name", value: fullName },
            { label: "Email", value: email },
            {
              label: "Joining as",
              value: hasInvite && acceptInvite
                ? `Player on ${(invite as { teamName: string }).teamName}`
                : joinMarketplace
                ? "Player marketplace"
                : "Registered player",
            },
            { label: "Playtomic", value: playtomicUrl },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
              <span className="text-xs text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm text-right break-all">{value}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">
            Registration fee: <strong className="text-foreground">R{playerFee.toLocaleString()}</strong> — you&apos;ll receive payment details after signing up.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={pending} size="lg">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
          </Button>
        </div>
      )}

      {step !== "email" && (
        <p className="text-center text-sm text-muted-foreground">
          Already competing?{" "}
          <a href="/sign-in" className="text-primary hover:underline">Sign in</a>
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root wizard
// ---------------------------------------------------------------------------

export function JoinWizard({ hostingClubs, playerFee, teamFee }: Props) {
  const [path, setPath] = useState<Path>("choose")

  return (
    <div className="w-full">
      {path === "choose" && <PathChooser onChoose={setPath} />}
      {path === "team" && (
        <TeamFlow
          hostingClubs={hostingClubs}
          playerFee={playerFee}
          teamFee={teamFee}
          onBack={() => setPath("choose")}
        />
      )}
      {path === "player" && (
        <PlayerFlow
          playerFee={playerFee}
          onBack={() => setPath("choose")}
        />
      )}
    </div>
  )
}

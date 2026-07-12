"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react"
import {
  checkEmailInvite,
  checkInviteByToken,
  registerPlayer,
  registerTeam,
} from "@/lib/actions/join"
import { TEAM_TYPES } from "@/lib/constants"

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
  inviteToken?: string
  defaultEmail?: string
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
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i === current
              ? "bg-primary w-6"
              : i < current
              ? "bg-primary/50 w-2"
              : "bg-border w-2",
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="heading text-4xl text-balance leading-tight">Join the League</h1>
        <p className="text-sm text-muted-foreground">
          How would you like to participate in SAPL?
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Create a Team — primary red card */}
        <button
          type="button"
          onClick={() => onChoose("team")}
          className="group relative w-full overflow-hidden rounded-xl bg-primary text-primary-foreground text-left transition-all active:scale-[0.98] hover:brightness-110"
        >
          <div className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Users className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold leading-tight">Create a Team</p>
              <p className="mt-1 text-sm leading-relaxed opacity-85">
                Register a new team, pick your home venue, and captain your squad through the season.
              </p>
            </div>
            <ChevronRight className="h-6 w-6 shrink-0 opacity-70 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Register as Player — dark outlined card */}
        <button
          type="button"
          onClick={() => onChoose("player")}
          className="group relative w-full overflow-hidden rounded-xl border-2 border-border bg-card text-left transition-all active:scale-[0.98] hover:border-primary/60 hover:bg-primary/5"
        >
          <div className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold leading-tight text-foreground group-hover:text-primary transition-colors">Register as Player</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Accept a team invitation or join the player marketplace so captains can find you.
              </p>
            </div>
            <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already competing?{" "}
        <a href="/sign-in" className="font-medium text-primary hover:underline">
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
  const [step, setStep] = useState<TeamStep>("details")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [teamName, setTeamName] = useState("")
  const TEAM_REGISTRATION_TYPES = TEAM_TYPES.filter((t) => t !== "Club Team")
  const [teamType, setTeamType] = useState<string>(TEAM_REGISTRATION_TYPES[0] ?? "Private Team")
  const [paymentModel, setPaymentModel] = useState<"club" | "individual">("club")
  const [homeClubId, setHomeClubId] = useState<string>("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [captainPlays, setCaptainPlays] = useState<"yes" | "no">("yes")
  const [captainGender, setCaptainGender] = useState<"male" | "female">("male")
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
        teamType,
        paymentModel,
        homeClubId: Number(homeClubId),
        captainPlays: captainPlays === "yes",
        captainGender,
        playtomicUrl,
      })
      if (!res.ok) { setError(res.error); return }
      window.location.href = res.redirectTo
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevStep}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 -ml-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <StepDots total={TEAM_STEPS.length} current={stepIndex} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Create a Team &mdash; Step {stepIndex + 1} of {TEAM_STEPS.length}
        </p>
        {step === "details" && <h2 className="heading text-3xl text-balance">What&apos;s your team called?</h2>}
        {step === "payment" && <h2 className="heading text-3xl text-balance">How will fees be paid?</h2>}
        {step === "venue" && <h2 className="heading text-3xl text-balance">Where will you play?</h2>}
        {step === "account" && <h2 className="heading text-3xl text-balance">Your captain account</h2>}
        {step === "review" && <h2 className="heading text-3xl text-balance">Review & submit</h2>}
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
              className="h-12 text-base"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) nextStep() }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="teamType">Team type</Label>
            <select
              id="teamType"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
              className="h-12 rounded-md border border-input bg-background px-3 text-base"
            >
              {TEAM_REGISTRATION_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {tt}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Club Teams are entered by venues. Public team registration supports Business Team and Private Team.
            </p>
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
          <div className="flex flex-col gap-1.5">
            <Label>Home club / venue</Label>
            <p className="text-xs text-muted-foreground">
              Only clubs that have confirmed they will host league nights are listed below.
            </p>
          </div>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto rounded-lg border border-border pr-1">
            {hostingClubs.map((c) => {
              const selected = homeClubId === String(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setHomeClubId(String(c.id))}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors first:mt-1 last:mb-1 mx-1",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/60 text-foreground",
                  )}
                >
                  <div className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    selected ? "border-primary-foreground bg-primary-foreground" : "border-muted-foreground",
                  )}>
                    {selected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{c.name}</p>
                    {c.saplRegion && (
                      <p className={cn("text-xs mt-0.5", selected ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        {c.saplRegion}{c.courts ? ` · ${c.courts} court${c.courts !== 1 ? "s" : ""}` : ""}
                      </p>
                    )}
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-foreground" />}
                </button>
              )
            })}
            {hostingClubs.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hosting clubs available yet.
              </p>
            )}
          </div>
        </div>
      )}

      {step === "account" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="captainName">Full name</Label>
            <Input id="captainName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="captainEmail">Email</Label>
            <Input id="captainEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="captainPw">Password</Label>
            <Input id="captainPw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} className="h-12 text-base" />
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
            <>
              <div className="flex flex-col gap-2">
                <Label>Your gender <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">Determines which categories you are eligible to play in.</p>
                <RadioGroup value={captainGender} onValueChange={(v: string) => setCaptainGender(v as "male" | "female")} className="flex gap-4">
                  <label className={cn("flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors", captainGender === "male" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                    <RadioGroupItem value="male" id="captain-gender-male" className="shrink-0" />
                    <span className="text-sm font-medium">Male</span>
                  </label>
                  <label className={cn("flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors", captainGender === "female" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                    <RadioGroupItem value="female" id="captain-gender-female" className="shrink-0" />
                    <span className="text-sm font-medium">Female</span>
                  </label>
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="captainPlaytomic">
                  Playtomic profile link <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="captainPlaytomic"
                  value={playtomicUrl}
                  onChange={(e) => setPlaytomicUrl(e.target.value)}
                  placeholder="https://app.playtomic.io/user/..."
                  className="h-12 text-base"
                />
                <PlaytomicHelp />
              </div>
            </>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-3">
          {[
            { label: "Team name", value: teamName },
            { label: "Team type", value: teamType },
            { label: "Payment", value: paymentModel === "club" ? `Club pays R${teamFee.toLocaleString()} — coming next week` : `R${playerFee.toLocaleString()} / player — coming next week` },
            { label: "Home venue", value: selectedClub?.name ?? "—" },
            { label: "Captain", value: fullName },
            { label: "Email", value: email },
            { label: "Captain plays", value: captainPlays === "yes" ? "Yes" : "No" },
            ...(captainPlays === "yes" ? [
              { label: "Gender", value: captainGender === "male" ? "Male" : "Female" },
              { label: "Playtomic", value: playtomicUrl },
            ] : []),
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

function PlayerFlow({
  playerFee,
  onBack,
  initialInviteToken,
  initialEmail,
}: {
  playerFee: number
  onBack: () => void
  initialInviteToken?: string
  initialEmail?: string
}) {
  // If we have a token, skip straight to invite-check (bypass the email step)
  const [step, setStep] = useState<PlayerStep>(initialInviteToken ? "invite-check" : "email")
  const [pending, startTransition] = useTransition()
  const [checkingEmail, startEmailCheck] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState(initialEmail ?? "")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [playtomicUrl, setPlaytomicUrl] = useState("")
  const [playtomicRating, setPlaytomicRating] = useState("")
  const [gender, setGender] = useState<"male" | "female">("male")
  const [joinMarketplace, setJoinMarketplace] = useState(true)

  const [invite, setInvite] = useState<{ teamName: string; category: string; invitedName: string | null; token: string } | null | "loading">(
    initialInviteToken ? "loading" : null
  )
  const [acceptInvite, setAcceptInvite] = useState(true)

  // If we have a token, resolve the invite on mount without needing email input
  useEffect(() => {
    if (!initialInviteToken) return
    startEmailCheck(async () => {
      const result = await checkInviteByToken(initialInviteToken)
      setInvite(result)
      // Pre-fill email from the invite if not already provided
      if (result?.email && !initialEmail) {
        setEmail(result.email)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const ptRating = playtomicRating.trim() !== "" ? Number(playtomicRating) : undefined
      const res = await registerPlayer({
        fullName,
        email,
        password,
        gender,
        playtomicUrl,
        playtomicRating: ptRating,
        joinMarketplace: invite && typeof invite !== "string" ? false : joinMarketplace,
        inviteToken: invite && typeof invite !== "string" && acceptInvite ? invite.token : undefined,
      })
      if (!res.ok) { setError(res.error); return }
      // Full page navigation so the fresh Better Auth session cookie is sent
      // with the next request — router.push races with the newly-set cookie.
      window.location.href = res.redirectTo
    })
  }

  const hasInvite = invite && typeof invite !== "string" && invite !== null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevStep}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 -ml-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <StepDots total={PLAYER_STEPS.length} current={stepIndex} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Register as Player &mdash; Step {stepIndex + 1} of {PLAYER_STEPS.length}
        </p>
        {step === "email" && <h2 className="heading text-3xl text-balance">What&apos;s your email?</h2>}
        {step === "invite-check" && <h2 className="heading text-3xl text-balance">{hasInvite ? "You have an invitation!" : "Join the marketplace"}</h2>}
        {step === "account" && <h2 className="heading text-3xl text-balance">Create your account</h2>}
        {step === "review" && <h2 className="heading text-3xl text-balance">Review & submit</h2>}
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
              className="h-12 text-base"
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
            <Input id="playerName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Email</Label>
            <p className="h-12 flex items-center text-sm border border-border rounded-md px-3 bg-muted/40 text-muted-foreground">{email}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="playerPw">Password</Label>
            <Input id="playerPw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Gender <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground">Your gender determines which categories you are eligible to play in.</p>
            <RadioGroup value={gender} onValueChange={(v: string) => setGender(v as "male" | "female")} className="flex gap-4">
              <label className={cn("flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors", gender === "male" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <RadioGroupItem value="male" id="player-gender-male" className="shrink-0" />
                <span className="text-sm font-medium">Male</span>
              </label>
              <label className={cn("flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors", gender === "female" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <RadioGroupItem value="female" id="player-gender-female" className="shrink-0" />
                <span className="text-sm font-medium">Female</span>
              </label>
            </RadioGroup>
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
              className="h-12 text-base"
            />
            <PlaytomicHelp />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="playerPtRating">Playtomic rating</Label>
            <Input
              id="playerPtRating"
              type="number"
              min="0"
              max="7"
              step="0.01"
              value={playtomicRating}
              onChange={(e) => setPlaytomicRating(e.target.value)}
              placeholder="e.g. 3.50"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">Your current Playtomic level (0 – 7). You can update this later from your profile.</p>
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
            { label: "Gender", value: gender === "male" ? "Male" : "Female" },
            {
              label: "Joining as",
              value: hasInvite && acceptInvite
                ? `Player on ${(invite as { teamName: string }).teamName}`
                : joinMarketplace
                ? "Player marketplace"
                : "Registered player",
            },
            { label: "Playtomic link", value: playtomicUrl },
            ...(playtomicRating ? [{ label: "Playtomic rating", value: playtomicRating }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
              <span className="text-xs text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm text-right break-all">{value}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">
            Registration fee: <strong className="text-foreground">R{playerFee.toLocaleString()}</strong> — online payment coming next week.
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

export function JoinWizard({ hostingClubs, playerFee, teamFee, inviteToken, defaultEmail }: Props) {
  // If arriving via an invite link, skip the path-choose screen and go straight to PlayerFlow
  const [path, setPath] = useState<Path>(inviteToken ? "player" : "choose")

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
          initialInviteToken={inviteToken}
          initialEmail={defaultEmail}
        />
      )}
    </div>
  )
}

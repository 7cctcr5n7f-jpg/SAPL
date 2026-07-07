"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, AlertCircle, Users, Loader2 } from "lucide-react"
import { processTeamInviteByToken, declineTeamInviteByToken } from "@/lib/actions/pairings"
import { BRAND } from "@/lib/constants"

type Preview =
  | { ready: true; teamName: string; captainName: string; category: string | null }
  | { already: true; teamName: string }
  | { error: string }

interface Props {
  token: string
  preview: Preview
}

const btnPrimary =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
const btnOutline =
  "inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"

export function InviteAccept({ token, preview }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<
    | { joined: true; teamName: string }
    | { alreadyOnTeam: true; teamName: string }
    | { declined: true }
    | { error: string }
    | null
  >(null)

  function accept() {
    start(async () => {
      const res = await processTeamInviteByToken(token)
      if ("joined" in res) {
        setResult({ joined: true, teamName: res.teamName })
      } else if ("alreadyOnTeam" in res) {
        setResult({ alreadyOnTeam: true, teamName: res.teamName })
      } else if ("needsProfile" in res) {
        router.push(`/onboarding?inviteToken=${encodeURIComponent(token)}`)
      } else if ("needsAccount" in res) {
        router.push(`/sign-up?email=${encodeURIComponent(res.email)}&inviteToken=${encodeURIComponent(token)}`)
      } else if ("error" in res) {
        setResult({ error: res.error })
      }
    })
  }

  function decline() {
    start(async () => {
      await declineTeamInviteByToken(token)
      setResult({ declined: true })
    })
  }

  // Already accepted on a previous visit — show success inline.
  if ("already" in preview) {
    return (
      <InviteCard
        icon={<CheckCircle2 className="h-12 w-12 text-primary" />}
        heading={`You're already on ${preview.teamName}`}
        body="You have already accepted this invitation. Head to your dashboard to see your team."
        cta={<Link href="/dashboard" className={btnPrimary}>Go to dashboard</Link>}
      />
    )
  }

  // Error state from preview (bad token, cancelled, etc.)
  if ("error" in preview) {
    return (
      <InviteCard
        icon={<AlertCircle className="h-12 w-12 text-destructive" />}
        heading="Something went wrong"
        body={preview.error}
        cta={<Link href="/" className={btnOutline}>Back to {BRAND.short}</Link>}
      />
    )
  }

  // Post-action result states
  if (result) {
    if ("joined" in result) {
      return (
        <InviteCard
          icon={<CheckCircle2 className="h-12 w-12 text-primary" />}
          heading={`You've joined ${result.teamName}`}
          body="You are now on the squad. Head to your dashboard to see your team and upcoming fixtures."
          cta={<Link href="/dashboard" className={btnPrimary}>Go to dashboard</Link>}
        />
      )
    }
    if ("alreadyOnTeam" in result) {
      return (
        <InviteCard
          icon={<Users className="h-12 w-12 text-muted-foreground" />}
          heading="You're already on a team"
          body={`You already play for ${result.teamName} this season. A player can only be on one team per season.`}
          cta={<Link href="/dashboard" className={btnOutline}>Go to dashboard</Link>}
        />
      )
    }
    if ("declined" in result) {
      return (
        <InviteCard
          icon={<XCircle className="h-12 w-12 text-muted-foreground" />}
          heading="Invitation declined"
          body="The invitation has been declined. If you change your mind, ask the team captain to send a new invite."
          cta={<Link href="/" className={btnOutline}>Back to {BRAND.short}</Link>}
        />
      )
    }
    if ("error" in result) {
      return (
        <InviteCard
          icon={<AlertCircle className="h-12 w-12 text-destructive" />}
          heading="Something went wrong"
          body={result.error}
          cta={<Link href="/" className={btnOutline}>Back to {BRAND.short}</Link>}
        />
      )
    }
  }

  // Default: show the invite details and Accept / Decline buttons.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-1.5">
          <span className="text-lg font-extrabold tracking-widest text-foreground">{BRAND.short}</span>
          <span className="text-lg font-extrabold text-primary">●</span>
        </div>

        <h1 className="mb-1 text-xl font-bold text-foreground text-balance">Team invitation</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground text-pretty">
          <strong className="text-foreground">{preview.captainName}</strong> has invited you to join{" "}
          <strong className="text-foreground">{preview.teamName}</strong> on South African Padel League.
          {preview.category && (
            <> Your slot is in the <strong className="text-foreground">{preview.category}</strong> category.</>
          )}{" "}
          Accept to claim your spot — or decline if you&apos;re not interested.
        </p>

        <div className="space-y-3">
          <button onClick={accept} disabled={pending} className={btnPrimary}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept invitation"}
          </button>
          <button onClick={decline} disabled={pending} className={btnOutline}>
            Decline
          </button>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          If you don&apos;t recognise this invitation, you can safely ignore it.
        </p>
      </div>
    </div>
  )
}

function InviteCard({
  icon,
  heading,
  body,
  cta,
}: {
  icon: React.ReactNode
  heading: string
  body: string
  cta: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-1.5">
          <span className="text-lg font-extrabold tracking-widest text-foreground">{BRAND.short}</span>
          <span className="text-lg font-extrabold text-primary">●</span>
        </div>
        <div className="mb-4 flex justify-center">{icon}</div>
        <h1 className="mb-2 text-xl font-bold text-foreground text-balance">{heading}</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground text-pretty">{body}</p>
        {cta}
      </div>
    </div>
  )
}

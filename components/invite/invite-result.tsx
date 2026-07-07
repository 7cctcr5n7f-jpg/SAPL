"use client"

import Link from "next/link"
import { CheckCircle2, XCircle, AlertCircle, Users } from "lucide-react"
import { BRAND } from "@/lib/constants"

type Result =
  | { joined: true; teamName: string }
  | { alreadyOnTeam: true; teamName: string }
  | { declined: true }
  | { error: string }

interface Props {
  result: Result
}

export function InviteResult({ result }: Props) {
  let icon: React.ReactNode
  let heading: string
  let body: string
  let cta: React.ReactNode

  const btnPrimary = "inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
  const btnOutline = "inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-semibold text-foreground hover:bg-muted transition-colors"

  if ("joined" in result) {
    icon = <CheckCircle2 className="h-12 w-12 text-primary" />
    heading = `You've joined ${result.teamName}`
    body = "You're now on the squad. Head to your dashboard to see your team and upcoming fixtures."
    cta = <Link href="/dashboard" className={btnPrimary}>Go to dashboard</Link>
  } else if ("alreadyOnTeam" in result) {
    icon = <Users className="h-12 w-12 text-muted-foreground" />
    heading = "You're already on a team"
    body = `You already play for ${result.teamName} this season. A player can only be on one team per season.`
    cta = <Link href="/dashboard" className={btnOutline}>Go to dashboard</Link>
  } else if ("declined" in result) {
    icon = <XCircle className="h-12 w-12 text-muted-foreground" />
    heading = "Invitation declined"
    body = "The invitation has been declined. If you change your mind, ask the team captain to send a new invite."
    cta = <Link href="/" className={btnOutline}>Back to {BRAND.short}</Link>
  } else {
    icon = <AlertCircle className="h-12 w-12 text-destructive" />
    heading = "Something went wrong"
    body = result.error
    cta = <Link href="/" className={btnOutline}>Back to {BRAND.short}</Link>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {/* Logo */}
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

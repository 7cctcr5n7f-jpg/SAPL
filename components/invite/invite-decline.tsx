"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertCircle, Loader2, XCircle } from "lucide-react"
import { declineTeamInviteByToken } from "@/lib/actions/pairings"
import { InviteResult } from "@/components/invite/invite-result"
import { BRAND } from "@/lib/constants"

type Preview =
  | { ready: true; teamName: string }
  | { alreadySettled: true; teamName: string; status: "accepted" | "cancelled" }
  | { error: string }

export function InviteDecline({ token, preview }: { token: string; preview: Preview }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ declined: true } | { error: string } | null>(null)

  if (result) {
    return <InviteResult result={result} />
  }

  if ("error" in preview) {
    return <InviteResult result={{ error: preview.error }} />
  }

  if ("alreadySettled" in preview) {
    if (preview.status === "cancelled") {
      return <InviteResult result={{ declined: true }} />
    }
    return <InviteResult result={{ error: `This invitation for ${preview.teamName} has already been accepted.` }} />
  }

  const btnPrimary =
    "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
  const btnOutline =
    "inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-1.5">
          <span className="text-lg font-extrabold tracking-widest text-foreground">{BRAND.short}</span>
          <span className="text-lg font-extrabold text-primary">●</span>
        </div>

        <div className="mb-4 flex justify-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground text-balance">Decline invitation?</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground text-pretty">
          This will cancel your invitation to join <strong className="text-foreground">{preview.teamName}</strong>.
        </p>

        <div className="space-y-3">
          <button
            onClick={() =>
              start(async () => {
                const res = await declineTeamInviteByToken(token)
                if (!res.ok) {
                  setResult({ error: res.error ?? "Something went wrong." })
                  return
                }
                setResult({ declined: true })
              })
            }
            disabled={pending}
            className={btnPrimary}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm decline"}
          </button>
          <Link href={`/invite/${token}`} className={btnOutline}>
            Keep invitation
          </Link>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" />
          This action only happens after you confirm.
        </p>
      </div>
    </div>
  )
}


"use client"

import { useState } from "react"
import Link from "next/link"
import { sendVerificationEmail } from "@/lib/auth-client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Loader2, MailCheck } from "lucide-react"

export function VerifyEmailNotice({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  async function resend() {
    if (!email) return
    setStatus("sending")
    try {
      const { error } = await sendVerificationEmail({ email, callbackURL: "/onboarding" })
      setStatus(error ? "error" : "sent")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="size-6" />
      </div>

      <div>
        <h1 className="heading text-3xl">Check your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          We&apos;ve sent an activation link to {email ? <span className="text-foreground">{email}</span> : "your inbox"}
          . Click the link in that email to activate your account.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={resend} disabled={status === "sending" || !email} variant="secondary">
          {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : "Resend activation email"}
        </Button>
        {status === "sent" ? <p className="text-sm text-primary">Activation email sent again.</p> : null}
        {status === "error" ? (
          <p className="text-sm text-destructive">Could not resend right now. Please try again shortly.</p>
        ) : null}
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          Activation isn&apos;t required just yet — you can finish setting up your profile now.
        </p>
        <Link href="/onboarding" className={`${buttonVariants({ size: "lg" })} mt-3 w-full`}>
          Continue to setup
        </Link>
      </div>
    </div>
  )
}

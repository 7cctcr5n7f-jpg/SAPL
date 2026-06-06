"use client"

import { useState } from "react"
import Link from "next/link"
import { forgetPassword } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MailCheck } from "lucide-react"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // redirectTo is where the email link lands (carrying the reset token).
      const { error } = await forgetPassword({ email, redirectTo: "/reset-password" })
      if (error) throw new Error(error.message || "Could not send reset email")
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </span>
        <div>
          <h2 className="heading text-xl">Check your inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {"If an account exists for "}
            <span className="text-foreground">{email}</span>
            {", we've sent a link to reset your password. The link expires in 1 hour."}
          </p>
        </div>
        <Link href="/sign-in" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {"Remembered it? "}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

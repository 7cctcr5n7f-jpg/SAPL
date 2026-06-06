"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { resetPassword } from "@/lib/auth-client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function ResetPasswordForm({ token, tokenError }: { token: string | null; tokenError: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const invalid = tokenError || !token

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    try {
      const { error } = await resetPassword({ newPassword: password, token: token as string })
      if (error) throw new Error(error.message || "Could not reset password")
      router.push("/sign-in?reset=success")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  if (invalid) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-destructive text-pretty">
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          placeholder="Re-enter your password"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
      </Button>
    </form>
  )
}

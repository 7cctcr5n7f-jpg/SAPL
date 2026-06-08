"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn, signUp } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await signUp.email({ name, email, password, callbackURL: "/onboarding" })
        if (error) throw new Error(error.message || "Could not create account")
        // An activation email is sent on sign-up. Send the user to the
        // "check your email" screen (activation isn't enforced yet, so they
        // can still continue into setup from there).
        router.push(`/verify-email?email=${encodeURIComponent(email)}`)
      } else {
        const { error } = await signIn.email({ email, password })
        if (error) throw new Error(error.message || "Invalid email or password")
        // Keep the user on the public homepage after signing in rather than
        // dropping them straight into the dashboard.
        router.push("/")
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {isSignUp ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Thabo Molefe" />
        </div>
      ) : null}
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {!isSignUp ? (
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Forgot password?
            </Link>
          ) : null}
        </div>
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" disabled={loading} className="mt-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? "Create Account" : "Sign In"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already competing? " : "New to the league? "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="text-primary hover:underline">
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  )
}

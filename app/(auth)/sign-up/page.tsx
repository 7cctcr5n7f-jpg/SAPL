import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { getOptionalSession } from "@/lib/session"

export const metadata = { title: "Join the League | SAPL" }

export default async function SignUpPage() {
  const session = await getOptionalSession()
  if (session?.user) redirect("/dashboard")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading text-3xl">Join the League</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create your account to register as a player.</p>
      </div>
      <AuthForm mode="sign-up" />
    </div>
  )
}

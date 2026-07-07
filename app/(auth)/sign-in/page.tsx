import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { getOptionalSession } from "@/lib/session"

export const metadata = { title: "Sign In | SAPL" }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; email?: string; callbackUrl?: string; inviteToken?: string }>
}) {
  const session = await getOptionalSession()
  const { reset, email, callbackUrl, inviteToken } = await searchParams
  if (session?.user) redirect(callbackUrl ?? "/dashboard")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading text-3xl">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your league season.</p>
      </div>
      {reset === "success" ? (
        <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Your password has been reset. Sign in with your new password.
        </p>
      ) : null}
      <AuthForm mode="sign-in" defaultEmail={email ?? ""} callbackUrl={callbackUrl} signUpInviteToken={inviteToken} />
    </div>
  )
}

import { redirect } from "next/navigation"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { getOptionalSession } from "@/lib/session"

export const metadata = { title: "Forgot Password | SAPL" }

export default async function ForgotPasswordPage() {
  const session = await getOptionalSession()
  if (session?.user) redirect("/dashboard")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading text-3xl">Forgot password</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  )
}

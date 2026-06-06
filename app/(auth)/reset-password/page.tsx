import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata = { title: "Reset Password | SAPL" }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading text-3xl">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">Choose a strong password you don&apos;t use elsewhere.</p>
      </div>
      <ResetPasswordForm token={token ?? null} tokenError={Boolean(error)} />
    </div>
  )
}

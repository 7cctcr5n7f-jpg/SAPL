import { VerifyEmailNotice } from "@/components/auth/verify-email-notice"

export const metadata = { title: "Activate your account | SAPL" }

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <VerifyEmailNotice email={email ?? ""} />
}

import { redirect } from "next/navigation"
import { getOptionalSession } from "@/lib/session"
import { getHostingClubs, getCurrentFees } from "@/lib/actions/join"
import { JoinWizard } from "@/components/auth/join-wizard"

export const metadata = { title: "Join the League | SAPL" }

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ inviteToken?: string; email?: string }>
}) {
  const session = await getOptionalSession()
  if (session?.user) redirect("/dashboard")

  const { inviteToken, email } = await searchParams
  const [hostingClubs, fees] = await Promise.all([getHostingClubs(), getCurrentFees()])

  return (
    <JoinWizard
      hostingClubs={hostingClubs}
      playerFee={fees.playerFee}
      teamFee={fees.teamFee}
      inviteToken={inviteToken}
      defaultEmail={email}
    />
  )
}

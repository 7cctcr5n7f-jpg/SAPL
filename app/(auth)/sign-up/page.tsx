import { redirect } from "next/navigation"
import { getOptionalSession } from "@/lib/session"
import { getHostingClubs, getCurrentFees } from "@/lib/actions/join"
import { JoinWizard } from "@/components/auth/join-wizard"

export const metadata = { title: "Join the League | SAPL" }

export default async function SignUpPage() {
  const session = await getOptionalSession()
  if (session?.user) redirect("/dashboard")

  const [hostingClubs, fees] = await Promise.all([getHostingClubs(), getCurrentFees()])

  return (
    <JoinWizard
      hostingClubs={hostingClubs}
      playerFee={fees.playerFee}
      teamFee={fees.teamFee}
    />
  )
}

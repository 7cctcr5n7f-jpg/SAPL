import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { processTeamInviteByToken } from "@/lib/actions/pairings"
import { InviteResult } from "@/components/invite/invite-result"

interface Props {
  params: Promise<{ token: string }>
}

/**
 * Token-based team invite accept page.
 *
 * Cases handled:
 *  1. Signed in + has player profile  → join immediately, show success
 *  2. Signed in + no player profile   → redirect to onboarding with token
 *  3. Not signed in (any)             → redirect to sign-in with token so after
 *     login they land back here; or to sign-up if no account exists
 */
export default async function InviteAcceptPage({ params }: Props) {
  const { token } = await params

  // If user is not signed in, send them to sign-in first, then come back here
  const me = await getCurrentUser()
  if (!me) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)
  }

  const result = await processTeamInviteByToken(token)

  if ("needsProfile" in result) {
    // Has account, needs player profile — go to onboarding then auto-join
    redirect(`/onboarding?inviteToken=${encodeURIComponent(token)}`)
  }

  if ("needsAccount" in result) {
    // No account yet — send to sign-up; after registering they'll be auto-joined
    // via resolvePendingInvites (email-based) in registerPlayer
    redirect(`/sign-up?email=${encodeURIComponent(result.email)}&inviteToken=${encodeURIComponent(token)}`)
  }

  // For all other cases (joined, error, alreadyOnTeam) show the result page
  return <InviteResult result={result} />
}

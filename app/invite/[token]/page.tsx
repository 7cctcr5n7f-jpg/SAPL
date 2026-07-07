import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getInvitePreview } from "@/lib/actions/pairings"
import { InviteAccept } from "@/components/invite/invite-accept"

interface Props {
  params: Promise<{ token: string }>
}

/**
 * Team invite landing page.
 *
 * This page only SHOWS the invitation details. The player must click
 * "Accept" to trigger the server action — we do NOT auto-process on
 * load, which would break with email pre-fetch bots and sign-in redirects.
 *
 * Cases:
 *  1. Not signed in → redirect to sign-in (callbackUrl back here)
 *  2. Signed in, no player profile → redirect to onboarding with token
 *  3. Invalid / cancelled / not found token → show error inline
 *  4. Already accepted (re-visit) → show success inline
 *  5. Ready to accept → show Accept / Decline UI
 */
export default async function InviteAcceptPage({ params }: Props) {
  const { token } = await params

  const me = await getCurrentUser()
  if (!me) {
    // Pass both callbackUrl (for sign-in) and inviteToken (for sign-up link) so
    // the token is preserved whichever path the player takes.
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(`/invite/${token}`)}&inviteToken=${encodeURIComponent(token)}`
    )
  }

  // Fetch invite metadata without mutating anything.
  let preview
  try {
    preview = await getInvitePreview(token, me.id)
  } catch (err) {
    console.log("[v0] getInvitePreview error:", err)
    return (
      <InviteAccept
        token={token}
        preview={{ error: "Something went wrong loading this invitation. Please try again." }}
      />
    )
  }

  if ("needsProfile" in preview) {
    redirect(`/onboarding?inviteToken=${encodeURIComponent(token)}`)
  }

  if ("needsAccount" in preview) {
    redirect(`/sign-up?email=${encodeURIComponent(preview.email)}&inviteToken=${encodeURIComponent(token)}`)
  }

  // Show accept / decline UI (or an inline result if already settled).
  return <InviteAccept token={token} preview={preview} />
}

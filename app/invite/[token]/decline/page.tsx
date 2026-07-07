import { declineTeamInviteByToken } from "@/lib/actions/pairings"
import { InviteResult } from "@/components/invite/invite-result"

interface Props {
  params: Promise<{ token: string }>
}

export default async function InviteDeclinePage({ params }: Props) {
  const { token } = await params
  const result = await declineTeamInviteByToken(token)

  return (
    <InviteResult
      result={
        result.ok
          ? { declined: true }
          : { error: result.error ?? "Something went wrong." }
      }
    />
  )
}

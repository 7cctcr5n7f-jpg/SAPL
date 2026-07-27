import { getDeclineInvitePreview } from "@/lib/actions/pairings"
import { InviteDecline } from "@/components/invite/invite-decline"

interface Props {
  params: Promise<{ token: string }>
}

export default async function InviteDeclinePage({ params }: Props) {
  const { token } = await params
  const preview = await getDeclineInvitePreview(token)

  return <InviteDecline token={token} preview={preview} />
}

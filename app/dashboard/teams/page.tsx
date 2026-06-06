import { getCurrentUser } from "@/lib/session"
import { getPlayerMemberships } from "@/lib/queries-dashboard"
import { PageHeader } from "@/components/dashboard/page-header"
import { TeamsPanel } from "@/components/dashboard/teams-panel"
import { NoProfile } from "@/components/dashboard/no-profile"

export default async function TeamsPage() {
  const me = await getCurrentUser()
  if (!me) return null
  if (!me.playerId) {
    return (
      <NoProfile
        title="My Teams"
        subtitle="Manage invitations and team memberships."
        message="Create your player profile to receive team invitations and join a league team."
      />
    )
  }
  const memberships = await getPlayerMemberships(me.playerId)

  const entries = memberships.map((m) => ({
    membershipId: m.membership.id,
    status: m.membership.status,
    teamId: m.team.id,
    teamName: m.team.name,
    orgName: m.org?.name ?? "—",
    divisionName: m.division?.name ?? "Unassigned",
    tpr: m.team.tpr,
    role: m.membership.role,
  }))

  return (
    <div>
      <PageHeader title="My Teams" subtitle="Manage invitations and team memberships." />
      <TeamsPanel entries={entries} />
    </div>
  )
}

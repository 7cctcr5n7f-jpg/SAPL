import { PageHeader } from "@/components/dashboard/page-header"
import { MembersTable } from "@/components/admin/members-table"
import { listMembers, listTeamsForAssignment } from "@/lib/actions/members"
import { requirePermissionPage } from "@/lib/access"

export const dynamic = "force-dynamic"
export const metadata = { title: "Members | SAPL" }

export default async function AdminMembersPage() {
  const access = await requirePermissionPage("league_management")
  const me = access.user

  const [members, allTeams] = await Promise.all([listMembers(), listTeamsForAssignment()])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        subtitle="Master database of all registered SAPL members. Click any cell to edit inline."
      />
      <MembersTable members={members} allTeams={allTeams} currentUserId={me.id} />
    </div>
  )
}

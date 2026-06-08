import { PageHeader } from "@/components/dashboard/page-header"
import { MembersTable } from "@/components/admin/members-table"
import { listMembers } from "@/lib/actions/members"
import { requirePermissionPage } from "@/lib/access"

export const dynamic = "force-dynamic"
export const metadata = { title: "Members & Roles | SAPL" }

export default async function AdminMembersPage() {
  const access = await requirePermissionPage("league_management")
  const me = access.user

  const members = await listMembers()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members & Roles"
        subtitle="Assign roles, send password reset links, or set a temporary password for any member."
      />
      <MembersTable members={members} currentUserId={me.id} />
    </div>
  )
}

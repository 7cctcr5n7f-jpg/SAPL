import { redirect } from "next/navigation"
import { PageHeader } from "@/components/dashboard/page-header"
import { MembersTable } from "@/components/admin/members-table"
import { getCurrentUser } from "@/lib/session"
import { listMembers } from "@/lib/actions/members"

export const dynamic = "force-dynamic"
export const metadata = { title: "Members & Roles | SAPL" }

export default async function AdminMembersPage() {
  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  // Members & Roles management is main-admin only.
  if (me.realRole !== "super_admin") redirect("/admin")

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

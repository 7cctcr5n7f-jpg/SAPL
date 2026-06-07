import { redirect } from "next/navigation"
import { PageHeader } from "@/components/dashboard/page-header"
import { getCurrentUser } from "@/lib/session"
import { getOutstandingFees } from "@/lib/queries-dashboard"
import { BillingManagement } from "@/components/admin/billing-management"

export const dynamic = "force-dynamic"
export const metadata = { title: "Billing Management | SAPL" }

export default async function AdminBillingPage() {
  const me = await getCurrentUser()
  if (!me) redirect("/sign-in")
  if (me.role !== "league_admin" && me.role !== "super_admin") redirect("/dashboard")

  const fees = await getOutstandingFees()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing Management"
        subtitle="Track outstanding league fees, send reminders and keep notes per payer."
      />
      <BillingManagement fees={fees} />
    </div>
  )
}

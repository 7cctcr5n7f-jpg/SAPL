import { PageHeader } from "@/components/dashboard/page-header"
import { requirePermissionPage } from "@/lib/access"
import { getOutstandingFees } from "@/lib/queries-dashboard"
import { BillingManagement } from "@/components/admin/billing-management"

export const dynamic = "force-dynamic"
export const metadata = { title: "Billing Management | SAPL" }

export default async function AdminBillingPage() {
  await requirePermissionPage("billing_management")

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

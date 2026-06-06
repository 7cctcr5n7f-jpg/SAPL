import { PageHeader } from "@/components/dashboard/page-header"
import { BroadcastForm } from "@/components/admin/broadcast-form"
import { DisputesPanel } from "@/components/admin/disputes-panel"
import { getOpenDisputes } from "@/lib/queries-admin"

export const dynamic = "force-dynamic"

export default async function AdminCommunicationsPage() {
  const disputes = await getOpenDisputes()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communications"
        subtitle="Send announcements and resolve disputes and protests across the league."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <BroadcastForm />
        <DisputesPanel
          disputes={disputes.map((d) => ({
            id: d.id,
            fixtureId: d.fixtureId,
            type: d.type,
            status: d.status,
            description: d.description,
            createdAt: d.createdAt,
          }))}
        />
      </div>
    </div>
  )
}

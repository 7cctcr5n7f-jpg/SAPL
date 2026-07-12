import { PageHeader } from "@/components/dashboard/page-header"
import { requirePermissionPage } from "@/lib/access"
import { getOutstandingFees } from "@/lib/queries-dashboard"
import { getSeasonReadiness } from "@/lib/team-readiness"
import { db } from "@/lib/db"
import { seasons } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { BillingManagement } from "@/components/admin/billing-management"
import { TeamReadinessBoard } from "@/components/admin/team-readiness-board"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payments | SAPL" }

export default async function AdminBillingPage() {
  await requirePermissionPage("billing_management")

  const [season] = await db
    .select({ id: seasons.id, name: seasons.name })
    .from(seasons)
    .orderBy(desc(seasons.isCurrent), desc(seasons.id))
    .limit(1)
  const [fees, readiness] = await Promise.all([
    getOutstandingFees(),
    season ? getSeasonReadiness(season.id) : Promise.resolve(null),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Payments"
        subtitle="Track team payment readiness, chase outstanding league fees and keep notes per payer."
      />

      {readiness && <TeamReadinessBoard data={readiness} seasonName={season?.name ?? null} />}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Outstanding fees</h2>
          <p className="text-sm text-muted-foreground">
            Individual players with unpaid league fees. Send reminders and record notes as you follow up.
          </p>
        </div>
        <BillingManagement fees={fees} />
      </section>
    </div>
  )
}

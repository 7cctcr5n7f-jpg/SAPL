import { PageHeader } from "@/components/dashboard/page-header"
import { requirePermissionPage } from "@/lib/access"
import { getOutstandingFees, getPaidPayments } from "@/lib/queries-dashboard"
import { getSeasonReadiness } from "@/lib/team-readiness"
import { db } from "@/lib/db"
import { seasons } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { BillingManagement } from "@/components/admin/billing-management"
import { PaidPayments } from "@/components/admin/paid-payments"
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
  const [fees, paidPayments, readiness] = await Promise.all([
    getOutstandingFees(),
    getPaidPayments(),
    getSeasonReadiness(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Payments"
        subtitle="Track team payment readiness, chase outstanding league fees and keep notes per payer."
      />

      {readiness.totalTeams > 0 && <TeamReadinessBoard data={readiness} seasonName={season?.name ?? null} />}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Outstanding fees</h2>
          <p className="text-sm text-muted-foreground">
            Players and team owners with unpaid league fees. Send reminders, add notes, or mark as paid for EFT/cash payments.
          </p>
        </div>
        <BillingManagement fees={fees} readiness={readiness} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Paid</h2>
          <p className="text-sm text-muted-foreground">
            All confirmed payments — via PayFast or manually marked by an admin.
          </p>
        </div>
        <PaidPayments payments={paidPayments} />
      </section>
    </div>
  )
}

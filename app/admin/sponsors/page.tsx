import { db } from "@/lib/db"
import { sponsors } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { SponsorManager } from "@/components/admin/sponsor-manager"

export const dynamic = "force-dynamic"

export default async function AdminSponsorsPage() {
  const rows = await db.select().from(sponsors).orderBy(asc(sponsors.level))
  const data = rows.map((s) => ({
    id: s.id,
    name: s.name,
    level: s.level,
    website: s.website,
    description: s.description,
    active: s.active,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsors"
        subtitle="Manage league sponsors shown on the public site. Sponsors are managed centrally by the league office."
      />
      <div className="max-w-3xl">
        <SponsorManager sponsors={data} />
      </div>
    </div>
  )
}

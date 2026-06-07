import { getCurrentUser } from "@/lib/session"
import { getPlayerByUserId } from "@/lib/queries-dashboard"
import { db } from "@/lib/db"
import { userMeta } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProfileForm } from "@/components/dashboard/profile-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getClubOptions } from "@/lib/queries"
import { NoProfile } from "@/components/dashboard/no-profile"

export default async function ProfilePage() {
  const me = await getCurrentUser()
  if (!me) return null
  const player = await getPlayerByUserId(me.id)
  if (!player) {
    return (
      <NoProfile
        title="My Profile"
        subtitle="Manage your league identity and marketplace visibility."
        message="Finish setting up your player profile to manage your ratings and marketplace visibility."
      />
    )
  }

  const clubs = await getClubOptions()
  const [meta] = await db.select({ phone: userMeta.phone }).from(userMeta).where(eq(userMeta.userId, me.id)).limit(1)

  return (
    <div>
      <PageHeader title="Update Profile" subtitle="Manage your league identity and marketplace visibility." />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Player Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm player={player} clubs={clubs} email={me.email} phone={meta?.phone ?? null} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

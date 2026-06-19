import { getCurrentUser } from "@/lib/session"
import { getPlayerByUserId } from "@/lib/queries-dashboard"
import { db } from "@/lib/db"
import { userMeta, user as user, teamMembers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProfileForm } from "@/components/dashboard/profile-form"
import { ChangePasswordForm } from "@/components/dashboard/change-password-form"
import { MarketplaceSettings } from "@/components/dashboard/marketplace-settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getClubOptions } from "@/lib/queries"
import { NoProfile } from "@/components/dashboard/no-profile"

export default async function ProfilePage() {
  const me = await getCurrentUser()
  if (!me) return null
  
  // Get user data with player flags
  const [userData] = await db
    .select({ isPlayer: user.isPlayer, onMarketplace: user.onMarketplace })
    .from(user)
    .where(eq(user.id, me.id))
    .limit(1)
  
  // Check if user is on a team
  const [userTeam] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.playerId, me.id))
    .limit(1)
  
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

      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Player Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm player={player} clubs={clubs} email={me.email} phone={meta?.phone ?? null} />
          </CardContent>
        </Card>

        <MarketplaceSettings 
          isPlayer={userData?.isPlayer ?? false}
          onMarketplace={userData?.onMarketplace ?? false}
          isOnTeam={!!userTeam}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

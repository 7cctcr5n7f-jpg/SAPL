import { getCurrentUser } from "@/lib/session"
import { getPlayerByUserId } from "@/lib/queries-dashboard"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProfileForm } from "@/components/dashboard/profile-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Stat } from "@/components/brand/bits"
import { eligibleCategoriesForPlayer } from "@/lib/engine/eligibility"
import { CATEGORY_RULES } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
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
        message="Finish setting up your player profile to manage your ratings, formats and marketplace visibility."
      />
    )
  }

  const clubs = await getClubOptions()

  const eligibleNames = eligibleCategoriesForPlayer(player.gender as "male" | "female", player.currentLi)
  const eligible = CATEGORY_RULES.filter((c) => eligibleNames.includes(c.name))

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your league identity and marketplace visibility." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Player Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm player={player} clubs={clubs} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ratings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Stat label="Current LI" value={player.currentLi.toFixed(2)} />
              <Stat label="Highest LI" value={player.highestLi.toFixed(2)} />
              <Stat label="Team TPR" value={player.currentTpr ? Math.round(player.currentTpr) : "—"} />
              <Stat label="Status" value={player.lookingForTeam ? "Open" : "Closed"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eligible Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No eligible categories at LI {player.currentLi.toFixed(2)}. Update your League Index.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {eligible.map((c) => (
                    <Badge key={c.name} variant="secondary" className="font-medium">
                      {c.name}
                      {c.isFeatureCourt ? " ★" : ""}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Based on your League Index. ★ marks Feature Court categories.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

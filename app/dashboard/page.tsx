import Link from "next/link"
import { getCurrentUser } from "@/lib/session"
import {
  getPlayerByUserId,
  getPlayerMemberships,
  getPlayerPayments,
  getPlayerTeamFees,
  getUserNotifications,
} from "@/lib/queries-dashboard"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TeamsPanel } from "@/components/dashboard/teams-panel"
import { TeamFees } from "@/components/dashboard/team-fees"
import { Stat } from "@/components/brand/bits"
import { Badge } from "@/components/ui/badge"
import { eligibleCategoriesForPlayer } from "@/lib/engine/eligibility"
import { CATEGORY_RULES } from "@/lib/constants"
import { fmtZAR } from "@/lib/format"

export default async function DashboardOverview() {
  const me = await getCurrentUser()
  if (!me) return null
  const player = me.playerId ? await getPlayerByUserId(me.id) : null
  const memberships = player ? await getPlayerMemberships(player.id) : []
  const payments = player ? await getPlayerPayments(me.id, player.id) : []
  const teamFees = player ? await getPlayerTeamFees(player.id) : []
  const notifications = await getUserNotifications(me.id, 5)

  const eligibleNames = player
    ? eligibleCategoriesForPlayer(player.gender as "male" | "female", player.currentLi)
    : []
  const eligible = CATEGORY_RULES.filter((c) => eligibleNames.includes(c.name))

  const activeTeams = memberships.filter((m) => m.membership.status === "active")
  const feesDue = teamFees.filter((f) => f.status === "due").reduce((s, f) => s + f.amount + f.vatAmount, 0)
  const outstanding =
    payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount + p.vatAmount, 0) + feesDue

  // Reshape memberships for the TeamsPanel (handles invites + active + history).
  const teamEntries = memberships.map((m) => ({
    membershipId: m.membership.id,
    status: m.membership.status,
    teamId: m.team.id,
    teamName: m.team.name,
    orgName: m.org?.name ?? "—",
    divisionName: m.division?.name ?? "Unassigned",
    seasonName: m.season?.name ?? null,
    seasonIsCurrent: m.season?.isCurrent ?? false,
    tpr: m.team.tpr,
    role: m.membership.role,
  }))

  return (
    <div>
      <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} subtitle="Your league command centre." />

      {player ? (
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Player snapshot — single source of truth for ratings + status. */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Player Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
                <Stat
                  label="Playtomic Rating"
                  value={player.playtomicRating != null ? player.playtomicRating.toFixed(2) : "—"}
                />
                <Stat label="League Index" value={player.currentLi.toFixed(2)} />
                {activeTeams.length > 0 && (
                  <Stat label="Team TPR" value={player.currentTpr ? Math.round(player.currentTpr) : "—"} />
                )}
                <Stat label="Active Teams" value={activeTeams.length} />
                <Stat label="Fees Due" value={fmtZAR(outstanding)} />
                <Stat
                  label="Marketplace"
                  value={player.lookingForTeam ? "Open" : "Closed"}
                  sub={player.lookingForTeam ? "Listed for captains" : "Hidden from search"}
                />
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Your Playtomic Rating and League Index are managed by the league. Update your Playtomic profile link from
                {" "}
                <Link href="/dashboard/profile" className="text-primary hover:underline">
                  Update Profile
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          {/* Eligible categories driven by gender + LI. */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Eligible Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No eligible categories at LI {player.currentLi.toFixed(2)}.
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
              <p className="mt-3 text-xs text-muted-foreground">★ marks Feature Court categories.</p>
            </CardContent>
          </Card>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <Stat label="Active Teams" value={activeTeams.length} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Stat label="Fees Due" value={fmtZAR(outstanding)} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fees — pay status per team. PayFast link will be wired in later. */}
      {player && (
        <section className="mt-8">
          <h2 className="heading mb-3 text-lg">Fees</h2>
          {teamFees.length > 0 ? (
            <TeamFees fees={teamFees} />
          ) : (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                You have no outstanding league fees right now.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* My Teams — invitations, active teams and history all live here now. */}
      {player && (
        <section className="mt-8">
          <h2 className="heading mb-3 text-lg">My Teams</h2>
          <TeamsPanel entries={teamEntries} />
        </section>
      )}

      <section className="mt-8">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Link href="/dashboard/notifications" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="flex gap-3 rounded-md bg-secondary px-4 py-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

import Link from "next/link"
import { getCurrentUser } from "@/lib/session"
import {
  getPlayerByUserId,
  getPlayerMemberships,
  getPlayerPayments,
  getUserNotifications,
} from "@/lib/queries-dashboard"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Stat } from "@/components/brand/bits"
import { fmtZAR } from "@/lib/format"
import { ArrowUpRight } from "lucide-react"

export default async function DashboardOverview() {
  const me = await getCurrentUser()
  if (!me) return null
  const player = me.playerId ? await getPlayerByUserId(me.id) : null
  const memberships = player ? await getPlayerMemberships(player.id) : []
  const payments = player ? await getPlayerPayments(me.id, player.id) : []
  const notifications = await getUserNotifications(me.id, 5)

  const activeTeams = memberships.filter((m) => m.membership.status === "active")
  const pendingInvites = memberships.filter((m) => m.membership.status === "invited")
  const outstanding = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount + p.vatAmount, 0)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${me.name.split(" ")[0]}`}
        subtitle="Your league command centre."
        action={
          <Button render={<Link href="/dashboard/profile" />} variant="outline" size="sm">
            Edit Profile
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <Stat label="League Index" value={player ? player.currentLi.toFixed(2) : "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Stat label="Team TPR" value={player?.currentTpr ? Math.round(player.currentTpr) : "—"} />
          </CardContent>
        </Card>
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

      {pendingInvites.length > 0 && (
        <Card className="mt-6 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Pending Invitations
              <Badge>{pendingInvites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((m) => (
              <div key={m.membership.id} className="flex items-center justify-between gap-4 rounded-md bg-secondary px-4 py-3">
                <div>
                  <p className="font-semibold">{m.team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.org?.name} · {m.division?.name ?? "Unassigned"}
                  </p>
                </div>
                <Button render={<Link href="/dashboard/teams" />} size="sm">
                  Respond
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">My Teams</CardTitle>
            <Link href="/dashboard/teams" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTeams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                You&apos;re not on a team yet.{" "}
                <Link href="/marketplace" className="text-primary hover:underline">
                  Find a team
                </Link>
                .
              </p>
            )}
            {activeTeams.map((m) => (
              <Link
                key={m.membership.id}
                href={`/teams/${m.team.id}`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="font-semibold">{m.team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.division?.name ?? "Unassigned"} · TPR {Math.round(m.team.tpr)}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

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
      </div>
    </div>
  )
}

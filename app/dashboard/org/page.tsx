import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAccessContext } from "@/lib/access"
import { getMyTeamView } from "@/lib/my-team"
import { PageHeader } from "@/components/dashboard/page-header"
import { MyTeamView } from "@/components/team/my-team-view"
import { Button } from "@/components/ui/button"
import { UsersRound } from "lucide-react"

/**
 * Player-facing "My Team" page. Shows the signed-in player's squad, League Ready
 * status, average rating, next fixture, league position and fees. Captains and
 * team owners can add/remove players inline.
 *
 * League admins are redirected to the wide team-management console at
 * /admin/teams (this route is for a single player's own team).
 */
export default async function MyTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const access = await requireAccessContext()

  // League admins manage every team from the admin console, not this page.
  if (access.isLeagueAdmin) redirect("/admin/teams")

  const { team: teamParam } = await searchParams
  const preferredTeamId = teamParam ? Number(teamParam) : undefined

  const data = await getMyTeamView(access.user.id, {
    preferredTeamId: Number.isFinite(preferredTeamId) ? preferredTeamId : undefined,
  })

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Team" subtitle="Your squad, fixtures and league position" />
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <UsersRound className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-lg font-semibold">You&apos;re not on a team yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground text-pretty">
            Join an existing squad or create your own team to start competing in the league.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/dashboard/league-centre">Browse the league</Link>} />
            <Button variant="outline" render={<Link href="/marketplace">Find a team</Link>} />
          </div>
        </div>
      </div>
    )
  }

  // A player may manage their own team's roster only when they hold a
  // team-management permission (captain / owner / club manager) AND that
  // specific team is in their scope. This mirrors canManageTeam() in the
  // roster server actions so the UI never offers controls the action rejects.
  const canManage =
    (access.can("captain_hub") || access.can("team_management")) &&
    access.canManageTeam(data.team.id)

  return (
    <div className="space-y-6">
      <MyTeamView data={{ ...data, canManage }} />
    </div>
  )
}

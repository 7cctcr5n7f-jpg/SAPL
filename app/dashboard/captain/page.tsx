import {
  getTeamRoster,
  getTeamFixtures,
  getAddablePlayers,
  getCategories,
  getFixtureScores,
  getTeamPairingData,
  getTeamUnavailability,
} from "@/lib/queries-dashboard"
import { getPlayerFee } from "@/lib/queries"
import { db } from "@/lib/db"
import { divisions, teams, user as dbUser } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { CaptainHub, type CaptainTeam } from "@/components/captain/captain-hub"
import { requireAccessContext } from "@/lib/access"
import { redirect } from "next/navigation"

export default async function CaptainPage() {
  // Captains, team owners, and club/team managers all get the Captain Hub for
  // the teams in their scope.
  const access = await requireAccessContext()
  if (!access.can("captain_hub") && !access.can("team_management") && !access.isLeagueAdmin)
    redirect("/dashboard")

  // Super admins can select ANY team and enter scores
  // Everyone else sees only their assigned teams
  let captainTeams: typeof teams.$inferSelect[] = []
  let isAdminSelectingTeams = false

  if (access.isLeagueAdmin) {
    // Super admins can see and manage all teams
    captainTeams = await db.select().from(teams).orderBy(teams.name)
    isAdminSelectingTeams = true
  } else if (access.teamIds.length > 0) {
    // Non-admin captains/managers see only their assigned teams
    captainTeams = await db.select().from(teams).where(inArray(teams.id, access.teamIds)).orderBy(teams.name)
  }

  if (captainTeams.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Captain Hub" subtitle="Manage your roster, lineups, and results" />
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          {access.isLeagueAdmin ? (
            <>
              <p className="text-lg font-semibold">No teams exist yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first team in the Admin panel, then come back here to manage rosters, pairings, and results.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">You are not a team captain yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Captains are assigned by their organisation administrator. Once you captain a team it will appear here.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const cats = await getCategories()
  const catLite = cats.map((c) => ({
    category: c.name,
    session: c.session,
    isFeatureCourt: c.isFeatureCourt,
  }))

  // Get user email for roster players
  const userEmailMap = new Map()
  const users = await db.select({ id: dbUser.id, email: dbUser.email }).from(dbUser)
  users.forEach((u) => userEmailMap.set(u.id, u.email))

  const teamsData: CaptainTeam[] = []
  for (const team of captainTeams) {
    const roster = await getTeamRoster(team.id)
    const fixtures = await getTeamFixtures(team.id)
    const completedIds = fixtures.filter((f) => f.status === "completed").map((f) => f.id)
    const scoreMap = await getFixtureScores(completedIds)
    const pairingData = await getTeamPairingData(
      team.id,
      cats.map((c) => c.name),
    )
    const unavailable = await getTeamUnavailability(team.id)
    let divisionName = "Unassigned"
    if (team.divisionId) {
      const [d] = await db.select().from(divisions).where(eq(divisions.id, team.divisionId)).limit(1)
      if (d) divisionName = d.name
    }
    const playerFee = await getPlayerFee(team.seasonId)
    teamsData.push({
      id: team.id,
      name: team.name,
      divisionName,
      tpr: Math.round(team.tpr),
      playerFee,
      unavailable,
      clubPaysFees: pairingData?.team.clubPaysFees ?? true,
      pairingCategories: pairingData?.categories ?? [],
      pairingRoster: pairingData?.roster ?? [],
      pairingInvites: pairingData?.invites ?? [],
      roster: roster.map((r) => {
        const userEmail = userEmailMap.get(r.player.id)
        return {
          membershipId: r.membership.id,
          playerId: r.player.id,
          name: `${r.player.firstName} ${r.player.lastName}`,
          li: r.player.currentLi,
          status: r.membership.status,
          role: r.membership.role,
          userRole: r.userRole,
          email: userEmail,
          phone: r.meta?.phone,
          playtomicRating: r.player.playtomicRating,
          playtomicUrl: r.player.playtomicUrl,
        }
      }),
      fixtures: fixtures.map((f) => ({
        id: f.id,
        week: f.week,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        homeName: f.homeName,
        awayName: f.awayName,
        matchDate: f.matchDate,
        status: f.status,
        homePoints: f.homePoints,
        awayPoints: f.awayPoints,
        scores: scoreMap[f.id],
      })),
    })
  }

  // Every existing player can be searched (by name or email) and added — not
  // just free agents — so captains can find anyone already on the platform.
  const addableRaw = await getAddablePlayers()
  const freeAgents = addableRaw.map((p) => ({
    playerId: p.id,
    name: `${p.firstName} ${p.lastName}`,
    li: p.currentLi,
    city: p.city,
    email: p.email,
  }))

  const playerFee = await getPlayerFee()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Captain Hub"
        subtitle={
          isAdminSelectingTeams
            ? "As main admin, you can manage scores for any team"
            : "Manage your roster, submit lineups, and enter results"
        }
      />
      <CaptainHub
        teams={teamsData}
        freeAgents={freeAgents}
        categories={catLite}
        canEdit={true}
        playerFee={playerFee}
        isLeagueAdmin={access.isLeagueAdmin}
        isSuperAdmin={access.user.isSuperAdmin}
        allTeams={isAdminSelectingTeams ? teamsData : undefined}
      />
    </div>
  )
}

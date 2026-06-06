import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import {
  getPlayerByUserId,
  getTeamsForCaptain,
  getTeamRoster,
  getTeamFixtures,
  getFreeAgents,
  getCategories,
  getFixtureScores,
  getTeamPairingData,
  getTeamUnavailability,
} from "@/lib/queries-dashboard"
import { getPlayerFee } from "@/lib/queries"
import { db } from "@/lib/db"
import { divisions, teams } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PageHeader } from "@/components/dashboard/page-header"
import { CaptainHub, type CaptainTeam } from "@/components/captain/captain-hub"

export default async function CaptainPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  let captainTeams = await getTeamsForCaptain(user.id)

  // Super admins previewing the captain experience see sample teams.
  const previewing = user.isSuperAdmin && captainTeams.length === 0
  if (previewing) {
    captainTeams = await db.select().from(teams).orderBy(teams.name).limit(2)
  }

  if (captainTeams.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Captain Hub" subtitle="Manage your roster, lineups, and results" />
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold">You are not a team captain yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Captains are assigned by their organisation administrator. Once you captain a team it will appear here.
          </p>
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
      roster: roster.map((r) => ({
        membershipId: r.membership.id,
        playerId: r.player.id,
        name: `${r.player.firstName} ${r.player.lastName}`,
        li: r.player.currentLi,
        status: r.membership.status,
        role: r.membership.role,
      })),
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

  const freeAgentsRaw = await getFreeAgents(40)
  const freeAgents = freeAgentsRaw.map((p) => ({
    playerId: p.id,
    name: `${p.firstName} ${p.lastName}`,
    li: p.currentLi,
    city: p.city,
  }))

  const playerFee = await getPlayerFee()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Captain Hub"
        subtitle={
          previewing
            ? "Preview mode — sample teams shown so you can see the captain experience"
            : "Manage your roster, submit lineups, and enter results"
        }
      />
      <CaptainHub
        teams={teamsData}
        freeAgents={freeAgents}
        categories={catLite}
        canEdit={true}
        playerFee={playerFee}
      />
    </div>
  )
}

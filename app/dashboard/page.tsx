import Link from "next/link"
import { getCurrentUser } from "@/lib/session"
import {
  getPlayerByUserId,
  getPlayerMemberships,
  getPlayerPayments,
  getPlayerTeamFees,
  getPlayerOverviewTeam,
  getFixtureDetails,
  type FixtureDetail,
} from "@/lib/queries-dashboard"
import { getDashboardFixtures } from "@/lib/queries-fixtures"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { PlayerSummary } from "@/components/dashboard/player-summary"
import { MatchCentre } from "@/components/dashboard/match-centre"
import { MoreInformation } from "@/components/dashboard/more-information"
import { MyTeamCard } from "@/components/dashboard/my-team-card"
import { PlayerSelfService } from "@/components/dashboard/player-self-service"
import { TeamOwnerCta } from "@/components/dashboard/team-owner-cta"
import { eligibleCategoriesForPlayer } from "@/lib/engine/eligibility"
import { getAccessContext } from "@/lib/access"
import { TeamFees } from "@/components/dashboard/team-fees"
import { fmtZAR } from "@/lib/format"

export default async function DashboardOverview() {
  const me = await getCurrentUser()
  if (!me) return null
  const access = await getAccessContext(me)
  const player = me.playerId ? await getPlayerByUserId(me.id) : null
  const memberships = player ? await getPlayerMemberships(player.id) : []
  const payments = player ? await getPlayerPayments(me.id, player.id) : []
  const teamFees = player ? await getPlayerTeamFees(player.id) : []
  const overviewTeam = player ? await getPlayerOverviewTeam(player.id) : null
  const myMatches = player ? (await getDashboardFixtures(me)).fixtures : []
  const detailMap =
    player && myMatches.length
      ? await getFixtureDetails(
          myMatches.map((m) => m.id),
          player.id,
        )
      : new Map<number, FixtureDetail>()
  const fixtureDetails = Object.fromEntries(detailMap)

  const activeTeams = memberships.filter((m) => m.membership.status === "active")
  const feesDue = teamFees.filter((f) => f.status === "due").reduce((s, f) => s + f.amount + f.vatAmount, 0)
  const outstanding =
    payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount + p.vatAmount, 0) + feesDue
  const feesPaid = outstanding <= 0
  const isCaptain = overviewTeam?.role === "captain" || access.canCaptainHub

  if (!player) {
    return (
      <div>
        <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} subtitle="Your league command centre." />
        {!access.isLeagueAdmin && access.teamIds.length === 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">Get Started</h2>
            <TeamOwnerCta hasPlayerProfile={false} listedOnMarketplace={false} />
          </section>
        )}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">Active Teams</span>
              <span className="text-lg font-bold tabular-nums">{activeTeams.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">Fees Due</span>
              <span className="text-lg font-bold tabular-nums">{fmtZAR(outstanding)}</span>
            </CardContent>
          </Card>
        </div>
        <section>
          <h2 className="text-lg font-bold mb-4">Player Tools</h2>
          <PlayerSelfService hasPlayerProfile={false} listed={false} />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PlayerSummary
        firstName={me.name.split(" ")[0]}
        leagueIndex={player.currentLi}
        team={overviewTeam}
        feesPaid={feesPaid}
        playtomicRating={player.playtomicRating}
        eligibleCategories={eligibleCategoriesForPlayer(player.gender === "female" ? "female" : "male", player.currentLi)}
      />

      {teamFees.some((f) => f.status === "due") && (
        <section id="fees">
          <h2 className="text-2xl font-bold mb-6">League Fees</h2>
          <TeamFees fees={teamFees} />
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-6">Upcoming Matches</h2>
        <MatchCentre matches={myMatches} details={fixtureDetails} isCaptain={isCaptain} />
      </section>

      {overviewTeam && (
        <section>
          <h2 className="text-2xl font-bold mb-6">My Team</h2>
          <MyTeamCard team={overviewTeam} />
        </section>
      )}

      <section className="pt-4">
        <MoreInformation
          playtomicRating={player.playtomicRating}
          leagueIndex={player.currentLi}
          highestLi={player.highestLi}
          lookingForTeam={!!player.lookingForTeam}
          eligibleCategories={eligibleCategoriesForPlayer(player.gender === "female" ? "female" : "male", player.currentLi)}
        />
      </section>

      {activeTeams.length === 0 && (
        <section className="pt-4">
          <h2 className="text-2xl font-bold mb-6">Find a Team</h2>
          <PlayerSelfService hasPlayerProfile listed={!!player.lookingForTeam} />
        </section>
      )}
    </div>
  )
}

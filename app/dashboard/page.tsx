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
import { MyMatchCards } from "@/components/dashboard/my-match-cards"
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
  // Team fixtures (with per-court booking links) come from the same source the
  // Fixtures management page uses, so links set there appear here too.
  const myMatches = player ? (await getDashboardFixtures(me)).fixtures : []
  // Per-category detail (player pairings + result) keyed by fixture id, so the
  // expanded rows can show player-vs-player like the management view.
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

  // The player can submit scores when they captain (or co-manage) their team.
  const isCaptain = overviewTeam?.role === "captain" || access.canCaptainHub

  // Non-player members (admins-only / unassigned) keep the onboarding flow.
  if (!player) {
    return (
      <div>
        <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} subtitle="Your league command centre." />
        {!access.isLeagueAdmin && access.teamIds.length === 0 && (
          <section className="mb-8">
            <h2 className="heading mb-3 text-lg">Get Started</h2>
            <TeamOwnerCta hasPlayerProfile={false} listedOnMarketplace={false} />
          </section>
        )}
        <div className="grid grid-cols-2 gap-3">
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
        <section className="mt-8">
          <h2 className="heading mb-3 text-lg">Player Tools</h2>
          <PlayerSelfService hasPlayerProfile={false} listed={false} />
        </section>
      </div>
    )
  }

  return (
    <div>
      {/* MY MATCHES — individual rubbers the player is assigned to, always on top */}
      <MyMatchCards matches={myMatches} details={fixtureDetails} isCaptain={isCaptain} />

      {/* SECTION 1 — compact player summary (team, division, region, LI, status). */}
      <PlayerSummary
        firstName={me.name.split(" ")[0]}
        leagueIndex={player.currentLi}
        team={overviewTeam}
        feesPaid={feesPaid}
      />

      {/* SECTIONS 2-4 — Actions required, next match, and the fixtures list. */}
      <MatchCentre matches={myMatches} details={fixtureDetails} isCaptain={isCaptain} />

      {/* SECTION 5 — compact team record (only when on an active team). */}
      {overviewTeam && (
        <div className="mt-6">
          <MyTeamCard team={overviewTeam} />
        </div>
      )}

      {/* SECONDARY — collapsible "More Information" (ratings, eligibility, marketplace). */}
      <div className="mt-6">
        <MoreInformation
          playtomicRating={player.playtomicRating}
          leagueIndex={player.currentLi}
          highestLi={player.highestLi}
          lookingForTeam={!!player.lookingForTeam}
          eligibleCategories={eligibleCategoriesForPlayer(player.gender === "female" ? "female" : "male", player.currentLi)}
        />
      </div>

      {/* Fees — kept on the page, anchored so the summary "Fees due" chip links here. */}
      {teamFees.some((f) => f.status === "due") && (
        <section id="fees" className="mt-6 scroll-mt-20">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-foreground">League Fees</h2>
          <TeamFees fees={teamFees} />
        </section>
      )}

      {/* Marketplace / create-team tools live below the match centre now. */}
      {activeTeams.length === 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-foreground">Find a Team</h2>
          <PlayerSelfService hasPlayerProfile listed={!!player.lookingForTeam} />
        </section>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Looking for standings, rankings and league-wide fixtures?{" "}
        <Link href="/league-centre" className="font-medium text-primary hover:underline">
          Open the League Centre
        </Link>
        .
      </p>
    </div>
  )
}

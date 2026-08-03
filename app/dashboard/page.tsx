import React from "react"
import { getCurrentUser } from "@/lib/session"
import {
  getPlayerByUserId,
  getPlayerMemberships,
  getPlayerTeamFees,
  getPlayerOverviewTeam,
  getFixtureDetails,
  getPendingInvitesForEmail,
  getPairingPartner,
  getTeamOwnerFee,
  getOwnedTeamForFee,
  type FixtureDetail,
  type TeamOwnerFee,
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
import { TeamOwnerFeeCard } from "@/components/dashboard/team-owner-fee-card"
import { fmtZAR } from "@/lib/format"

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-foreground whitespace-nowrap">
        {children}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export default async function DashboardOverview() {
  const me = await getCurrentUser()
  if (!me) return null
  const access = await getAccessContext(me)
  // Load player data for everyone — admins also have LI, ratings, and teams.
  // isPlayer=false only gates the onboarding redirect, not whether data exists.
  const player = await getPlayerByUserId(me.id)
  const memberships = player ? await getPlayerMemberships(me.id) : []
  const teamFees = player ? await getPlayerTeamFees(me.id) : []
  const overviewTeam = player ? await getPlayerOverviewTeam(me.id) : null
  const myMatches = player ? (await getDashboardFixtures(me)).fixtures : []
  const detailMap =
    player && myMatches.length
      ? (await getFixtureDetails(
          myMatches.map((m) => m.id),
          me.id,
        )) ?? new Map<number, FixtureDetail>()
      : new Map<number, FixtureDetail>()
  const fixtureDetails = Object.fromEntries(detailMap)

  // Pending invites (for players who missed the email) + pairing partner
  const pendingInvites = await getPendingInvitesForEmail(me.email)
  const pairingPartner =
    overviewTeam && player
      ? await getPairingPartner(me.id, overviewTeam.teamId)
      : null

  const activeTeams = memberships.filter((m) => m.membership.status === "active")
  const feesDue = teamFees.filter((f) => f.status === "due").reduce((s, f) => s + f.amount + f.vatAmount, 0)
  // outstanding = only individually-owed fees (no double-count with pending payment rows)
  const outstanding = feesDue
  const isCaptain = overviewTeam?.role === "captain" || access.isLeagueAdmin

  // Non-playing team owners have no teamMembers entry, so overviewTeam is null
  // and the normal captain path never fires. Query for owned club-pays-fees teams
  // so they can still see and pay the consolidated R4000 team fee on their dashboard.
  const ownedClubPaysFeeTeam =
    !overviewTeam?.clubPaysFees && !access.isLeagueAdmin && player
      ? await getOwnedTeamForFee(me.id, me.email)
      : null

  // For captains on club-pays-fees teams, fetch the consolidated team fee entry.
  const teamOwnerFee =
    isCaptain && overviewTeam?.clubPaysFees
      ? await getTeamOwnerFee(overviewTeam.teamId)
      : ownedClubPaysFeeTeam
      ? await getTeamOwnerFee(ownedClubPaysFeeTeam.teamId)
      : null

  const feesPaid = outstanding <= 0 && (!teamOwnerFee || teamOwnerFee.status === "paid")

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
    <div className="space-y-10">
      {/* ── Profile hero ─────────────────────────────────────────────────── */}
      <PlayerSummary
        firstName={me.name.split(" ")[0]}
        team={overviewTeam}
        feesPaid={feesPaid}
        playtomicRating={player.playtomicRating ? String(player.playtomicRating) : null}
        avatarUrl={player.avatarUrl as string | null}
        pendingInvites={pendingInvites}
        partner={pairingPartner}
      />

      {/* ── League Fees — individual dues ────────────────────────────────── */}
      {teamFees.some((f) => f.status === "due") && (
        <section id="fees">
          <SectionHeading>League Fees</SectionHeading>
          <TeamFees fees={teamFees} />
        </section>
      )}

      {/* ── League Fees — team owner consolidated fee (club-pays model) ──── */}
      {teamOwnerFee && (
        <section id="team-fee">
          <SectionHeading>League Fees</SectionHeading>
          <TeamOwnerFeeCard fee={teamOwnerFee} />
        </section>
      )}

      {/* ── Matches ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading>Upcoming Matches</SectionHeading>
        <MatchCentre matches={myMatches} details={fixtureDetails} />
      </section>

      {/* ── My Team ──────────────────────────────────────────────────────── */}
      {overviewTeam && (
        <section>
          <SectionHeading>My Team</SectionHeading>
          <MyTeamCard team={overviewTeam} />
        </section>
      )}

      {/* ── More info ────────────────────────────────────────────────────── */}
      <section>
        <MoreInformation
          playtomicRating={player.playtomicRating}
          lookingForTeam={!!player.lookingForTeam}
          eligibleCategories={eligibleCategoriesForPlayer(player.gender === "female" ? "female" : "male", player.playtomicRating ?? 0)}
        />
      </section>

      {/* ── Find a team ──────────────────────────────────────────────────── */}
      {activeTeams.length === 0 && (
        <section>
          <SectionHeading>Find a Team</SectionHeading>
          <PlayerSelfService hasPlayerProfile listed={!!player.lookingForTeam} />
        </section>
      )}
    </div>
  )
}

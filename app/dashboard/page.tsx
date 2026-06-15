import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCurrentUser } from "@/lib/session"
import { cn } from "@/lib/utils"
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
    <div className="space-y-12">
      {/* HERO SECTION — Clean player profile with large stats */}
      <section className="pt-4">
        {/* Player Profile Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-8 mb-12">
          {/* Photo + Info */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1">
            {/* Circular Photo with Border */}
            <div className="w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0 rounded-full border-4 border-primary/20 bg-muted overflow-hidden shadow-lg">
              {/* Placeholder — replace with actual player photo when available */}
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <span className="text-5xl">👤</span>
              </div>
            </div>

            {/* Name + Location */}
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-2">{me.name}</h1>
              <p className="text-lg text-muted-foreground">
                {overviewTeam 
                  ? `${overviewTeam.teamName} • ${overviewTeam.divisionName}`
                  : "Ready to join a team"}
              </p>
              {overviewTeam?.role === "captain" && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
                  <span className="text-sm font-semibold text-primary">Team Captain</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Big Stats Row */}
        <div className="grid grid-cols-3 gap-8 mb-12 py-8 border-y border-border/50">
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold text-foreground mb-2 tabular-nums">
              {memberships.length}
            </div>
            <p className="text-base text-muted-foreground font-medium">Teams</p>
          </div>
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold text-foreground mb-2 tabular-nums">
              {myMatches.length}
            </div>
            <p className="text-base text-muted-foreground font-medium">Matches</p>
          </div>
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold text-foreground mb-2 tabular-nums">
              {player.currentLi?.toFixed(2) ?? "—"}
            </div>
            <p className="text-base text-muted-foreground font-medium">League Index</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <Link
            href="/dashboard/profile"
            className="flex items-center justify-center px-6 py-4 rounded-full border-2 border-primary text-primary font-semibold text-lg hover:bg-primary/5 transition-colors"
          >
            Edit Profile
          </Link>
          <Link
            href={`/dashboard${overviewTeam ? `/captain/${overviewTeam.teamId}` : ""}`}
            className="flex items-center justify-center px-6 py-4 rounded-full bg-foreground text-background font-semibold text-lg hover:bg-foreground/90 transition-colors"
          >
            {overviewTeam ? "Go to Team" : "View Dashboard"}
          </Link>
        </div>
      </section>

      {/* LEAGUE INDEX FEATURED CARD */}
      <section className="rounded-3xl overflow-hidden bg-gradient-to-br from-foreground to-foreground/80 p-8 sm:p-12 text-background shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="flex-1">
            <p className="text-background/80 text-sm font-medium uppercase tracking-wider mb-2">Your League Index</p>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="text-6xl sm:text-7xl font-bold">
                {player.currentLi?.toFixed(2) ?? "—"}
              </div>
              {player.highestLi && player.currentLi && (
                <p className="text-background/70 text-lg">
                  Peak: {player.highestLi.toFixed(2)}
                </p>
              )}
            </div>
            <p className="text-background/80 text-base">
              {player.currentLi && player.currentLi >= 3.5
                ? "Advanced player • Competing at the highest level"
                : player.currentLi && player.currentLi >= 2.5
                  ? "Intermediate player • Ready for competitive matches"
                  : "Beginner player • Growing your skills"}
            </p>
          </div>
          <Link
            href="#"
            className="flex-shrink-0 w-16 h-16 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <ArrowRight className="w-8 h-8 text-background" />
          </Link>
        </div>
      </section>

      {/* MATCHES SECTION */}
      {myMatches.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold mb-6">Upcoming Matches</h2>
          <MatchCentre matches={myMatches} details={fixtureDetails} isCaptain={isCaptain} />
        </section>
      )}

      {/* QUICK NAVIGATION GRID */}
      <section>
        <h2 className="text-3xl font-bold mb-6">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {overviewTeam && (
            <QuickNavCard 
              title="My Team"
              description={overviewTeam.teamName}
              href={`/teams/${overviewTeam.teamId}`}
              icon="⚽"
            />
          )}
          <QuickNavCard 
            title="League Centre"
            description="View standings & fixtures"
            href="/league-centre"
            icon="📊"
          />
          <QuickNavCard 
            title="Find a Team"
            description="Join the marketplace"
            href="/marketplace"
            icon="🔍"
          />
          {feesDue > 0 && (
            <QuickNavCard 
              title="Pay Fees"
              description={`${fmtZAR(feesDue)} outstanding`}
              href="#fees"
              icon="💳"
              highlight
            />
          )}
        </div>
      </section>

      {/* TEAM SECTION */}
      {overviewTeam && (
        <section>
          <h2 className="text-3xl font-bold mb-6">My Team</h2>
          <MyTeamCard team={overviewTeam} />
        </section>
      )}

      {/* MORE INFO — collapsible */}
      <div>
        <MoreInformation
          playtomicRating={player.playtomicRating}
          leagueIndex={player.currentLi}
          highestLi={player.highestLi}
          lookingForTeam={!!player.lookingForTeam}
          eligibleCategories={eligibleCategoriesForPlayer(player.gender === "female" ? "female" : "male", player.currentLi)}
        />
      </div>

      {/* FEES SECTION */}
      {teamFees.some((f) => f.status === "due") && (
        <section id="fees" className="scroll-mt-20">
          <h2 className="text-3xl font-bold mb-6">League Fees</h2>
          <TeamFees fees={teamFees} />
        </section>
      )}

      {/* FIND TEAM SECTION */}
      {activeTeams.length === 0 && (
        <section>
          <h2 className="text-3xl font-bold mb-6">Looking for a Team?</h2>
          <PlayerSelfService hasPlayerProfile listed={!!player.lookingForTeam} />
        </section>
      )}
    </div>
  )
}

function QuickNavCard({
  title,
  description,
  href,
  icon,
  highlight = false,
}: {
  title: string
  description: string
  href: string
  icon: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block p-6 rounded-2xl border-2 transition-all duration-300",
        highlight
          ? "border-primary bg-primary/5 hover:bg-primary/10"
          : "border-border/50 bg-card hover:border-border hover:bg-card/80 hover:shadow-md"
      )}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className={cn("font-semibold mb-1", highlight ? "text-primary" : "text-foreground")}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}

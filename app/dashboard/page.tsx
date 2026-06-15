import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCurrentUser } from "@/lib/session"
import { cn } from "@/lib/utils"
import { Crest } from "@/components/league-centre/crest"
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
    <div className="space-y-8">
      {/* HERO SECTION — Player Profile with Stats */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-background to-background border border-border/40">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            {/* Player Info */}
            <div className="flex items-end gap-4">
              {overviewTeam && (
                <Crest name={overviewTeam.teamName} logoUrl={null} size="lg" />
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Welcome back</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{me.name}</h1>
                {overviewTeam && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {overviewTeam.teamName} · {overviewTeam.divisionName}
                    {overviewTeam.role === "captain" && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold uppercase text-primary">
                        Captain
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              <StatWidget label="League Index" value={player.currentLi?.toFixed(2) ?? "—"} />
              <StatWidget label="Status" value={feesPaid ? "Active" : "Fees Due"} highlight={!feesPaid} />
              <StatWidget label="Next Match" value={myMatches.length > 0 ? "Scheduled" : "None"} />
            </div>
          </div>
        </div>
      </section>

      {/* MATCHES SECTION — Upcoming Fixtures */}
      <MatchCentre matches={myMatches} details={fixtureDetails} isCaptain={isCaptain} />

      {/* QUICK LINKS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLinkCard 
          title="My Team"
          description={overviewTeam?.teamName || "Join a team"}
          href={overviewTeam ? `/teams/${overviewTeam.teamId}` : "/dashboard"}
          icon="⚽"
        />
        <QuickLinkCard 
          title="League Centre"
          description="Standings & fixtures"
          href="/league-centre"
          icon="📊"
        />
        <QuickLinkCard 
          title="Find a Team"
          description="Join the marketplace"
          href="/marketplace"
          icon="🔍"
        />
        <QuickLinkCard 
          title="My Profile"
          description="Update your info"
          href="/dashboard/profile"
          icon="👤"
        />
      </section>

      {/* TEAM SECTION — Only when on active team */}
      {overviewTeam && (
        <section>
          <h2 className="text-2xl font-bold mb-4">My Team</h2>
          <MyTeamCard team={overviewTeam} />
        </section>
      )}

      {/* ADDITIONAL INFO — collapsible */}
      <div className="mt-8">
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
          <h2 className="text-2xl font-bold mb-4">League Fees</h2>
          <TeamFees fees={teamFees} />
        </section>
      )}

      {/* FIND TEAM SECTION */}
      {activeTeams.length === 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Find a Team</h2>
          <PlayerSelfService hasPlayerProfile listed={!!player.lookingForTeam} />
        </section>
      )}
    </div>
  )
}

function StatWidget({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-lg sm:text-2xl font-bold tabular-nums", highlight && "text-amber-600")}>
        {value}
      </p>
    </div>
  )
}

function QuickLinkCard({
  title,
  description,
  href,
  icon,
}: {
  title: string
  description: string
  href: string
  icon: string
}) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/50 p-4 sm:p-6 transition-all hover:border-border hover:bg-card hover:shadow-md">
      <div className="absolute top-0 right-0 text-3xl sm:text-4xl opacity-0 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        Visit <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  )
}

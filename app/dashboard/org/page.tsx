import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import {
  getOrgByOwner,
  getOrgTeams,
  getAllTeamsForAdmin,
  getStandingForTeam,
  getTeamPairingData,
  getCategories,
} from "@/lib/queries-dashboard"
import { db } from "@/lib/db"
import { organisations, players } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getClubsWithUsage } from "@/lib/queries-clubs"
import { getPlayerFee } from "@/lib/queries"
import { PageHeader } from "@/components/dashboard/page-header"
import { OrgHub } from "@/components/org/org-hub"

export default async function OrgPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  // League and super admins manage every team; org admins are scoped to their
  // own. A super admin previewing the org_admin role drops to the scoped view.
  const isAdminWide = user.role === "league_admin" || user.role === "super_admin"

  let org = await getOrgByOwner(user.id)

  // Admins without an owned org borrow a sample org so the create-team dialog
  // still has a context to attach new teams to.
  if (!org && (isAdminWide || user.isSuperAdmin)) {
    const [sample] = await db.select().from(organisations).orderBy(organisations.id).limit(1)
    org = sample ?? null
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Admin" subtitle="Create and manage your teams, captains, squads and fees" />
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold">No teams linked to your account yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Team manager access is granted by the league office. Once you&apos;re set up, your teams will appear here.
          </p>
        </div>
      </div>
    )
  }

  const orgTeamRows = isAdminWide ? await getAllTeamsForAdmin() : await getOrgTeams(org.id)

  // Captain names
  const captainIds = orgTeamRows.map((r) => r.team.captainUserId).filter(Boolean) as string[]
  const captainMap = new Map<string, string>()
  for (const cid of captainIds) {
    const [p] = await db.select().from(players).where(eq(players.userId, cid)).limit(1)
    if (p) captainMap.set(cid, `${p.firstName} ${p.lastName}`)
  }

  const cats = await getCategories()
  const catNames = cats.map((c) => c.name)

  // Home-club lookup (name, logo, region) so each team row can show its club
  // crest and the region it plays in — auto-derived from the venue.
  const clubInfo = await getClubsWithUsage()
  const clubById = new Map(clubInfo.map((c) => [c.id, c]))

  const teamData = []
  for (const row of orgTeamRows) {
    const standing = await getStandingForTeam(row.team.id)
    const pairingData = await getTeamPairingData(row.team.id, catNames)
    const club = row.team.homeClubId ? clubById.get(row.team.homeClubId) : undefined
    const roster = pairingData?.roster ?? []
    const paidCount = roster.filter((p) => p.paid).length
    teamData.push({
      id: row.team.id,
      name: row.team.name,
      teamType: row.team.teamType,
      homeClubId: row.team.homeClubId ?? null,
      homeClubName: club?.name ?? null,
      homeClubLogoUrl: club?.logoUrl ?? null,
      avgLi: row.team.avgLi,
      playerCount: row.team.playerCount,
      maxPlayers: row.team.maxPlayers,
      // Prefer the team's denormalised region, falling back to the home club's.
      saplRegion: row.team.saplRegion ?? club?.saplRegion ?? null,
      divisionName: row.division?.name ?? "Unassigned",
      divisionId: row.team.divisionId ?? null,
      tpr: Math.round(row.team.tpr),
      captainName: row.team.captainUserId ? (captainMap.get(row.team.captainUserId) ?? null) : null,
      played: standing?.played ?? 0,
      won: standing?.wins ?? 0,
      points: standing?.points ?? 0,
      rank: standing?.rank ?? null,
      clubPaysFees: pairingData?.team.clubPaysFees ?? row.team.clubPaysFees,
      rosterCount: roster.length,
      paidCount,
      pairingCategories: pairingData?.categories ?? [],
      pairingRoster: roster,
      pairingInvites: pairingData?.invites ?? [],
    })
  }

  // Free agents
  const freeAgentsRaw = await db.select().from(players).where(eq(players.lookingForTeam, true)).limit(60)
  const freeAgents = freeAgentsRaw.map((p) => ({
    playerId: p.id,
    name: `${p.firstName} ${p.lastName}`,
    li: p.currentLi,
  }))

  // Home-club options with hosting usage. Only venues that still host on
  // Thursday nights AND have remaining capacity are selectable, so a venue can
  // never be over-subscribed. A team's currently assigned venue is always kept
  // available so editing the team doesn't drop its existing home club.
  const clubUsage = await getClubsWithUsage()
  const orgClubs = clubUsage.map((c) => ({
    id: c.id,
    name: c.name,
    remaining: c.remaining,
    hosts: c.hosts,
    available: c.hosts && c.remaining > 0,
  }))

  const playerFee = await getPlayerFee()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Admin"
        subtitle={
          isAdminWide
            ? "All teams across the league"
            : "Create and manage your teams, captains, squads and fees"
        }
      />
      <OrgHub orgId={org.id} teams={teamData} freeAgents={freeAgents} venues={orgClubs} playerFee={playerFee} />
    </div>
  )
}

import {
  getOrgByOwner,
  getOrgTeams,
  getAllTeamsForAdmin,
  getScopedTeamRows,
  getStandingForTeam,
  getTeamPairingData,
  getCategories,
  getUnassignedPlayers,
} from "@/lib/queries-dashboard"
import { db } from "@/lib/db"
import { organisations, players, user as authUser, userMeta, payments } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { TEAM_SQUAD_SIZE } from "@/lib/constants"
import { getClubsWithUsage } from "@/lib/queries-clubs"
import { getPlayerFee } from "@/lib/queries"
import { isSeasonLocked } from "@/lib/season-lock"
import { PageHeader } from "@/components/dashboard/page-header"
import { OrgHub } from "@/components/org/org-hub"
import { requirePermissionPage } from "@/lib/access"

export default async function OrgPage() {
  const access = await requirePermissionPage("team_management")
  const user = access.user

  // League and super admins manage every team; org admins are scoped to their
  // own. A super admin previewing the org_admin role drops to the scoped view.
  const isAdminWide = access.isLeagueAdmin

  // A club manager assigned via a venue's contact email (or a manual team/club
  // assignment) owns no organisation, but should still manage the teams within
  // their scope. Detect that case so we can render their scoped teams instead of
  // falling into the "no teams" empty state.
  const hasScopedAccess = !isAdminWide && (access.clubIds.length > 0 || access.teamIds.length > 0)

  let org = await getOrgByOwner(user.id)

  // Admins, and club managers without an owned org, borrow a sample org so the
  // create-team dialog still has a context to attach new teams to.
  if (!org && (isAdminWide || user.isSuperAdmin || hasScopedAccess)) {
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

  // Team set per role:
  //  - league/super admin: every team
  //  - club manager (no owned org / scoped access): teams within their access
  //    scope (assigned teams ∪ teams homed at their assigned clubs)
  //  - org owner: that organisation's teams
  const orgTeamRows = isAdminWide
    ? await getAllTeamsForAdmin()
    : hasScopedAccess
      ? await getScopedTeamRows(access)
      : await getOrgTeams(org.id)

  // Captain profiles (name + contact details so the row can show and edit them).
  type CaptainInfo = {
    playerId: number
    name: string
    email: string | null
    phone: string | null
  }
  const captainIds = orgTeamRows.map((r) => r.team.captainUserId).filter(Boolean) as string[]
  const captainMap = new Map<string, CaptainInfo>()
  for (const cid of captainIds) {
    if (captainMap.has(cid)) continue
    const [p] = await db.select().from(players).where(eq(players.userId, cid)).limit(1)
    if (!p) continue
    const [u] = await db.select({ email: authUser.email }).from(authUser).where(eq(authUser.id, cid)).limit(1)
    const [m] = await db.select({ phone: userMeta.phone }).from(userMeta).where(eq(userMeta.userId, cid)).limit(1)
    captainMap.set(cid, {
      playerId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      email: u?.email ?? null,
      phone: m?.phone ?? null,
    })
  }

  const cats = await getCategories()
  const catNames = cats.map((c) => c.name)

  // Home-club lookup (name, logo, region) so each team row can show its club
  // crest and the region it plays in — auto-derived from the venue.
  const clubInfo = await getClubsWithUsage()
  const clubById = new Map(clubInfo.map((c) => [c.id, c]))

  // Per-player league fee (R500); a full team's total is 8 × this.
  const playerFee = await getPlayerFee()

  const teamData = []
  for (const row of orgTeamRows) {
    const standing = await getStandingForTeam(row.team.id)
    const pairingData = await getTeamPairingData(row.team.id, catNames)
    const club = row.team.homeClubId ? clubById.get(row.team.homeClubId) : undefined
    const roster = pairingData?.roster ?? []
    const paidCount = roster.filter((p) => p.paid).length
    const clubPaysFees = pairingData?.team.clubPaysFees ?? row.team.clubPaysFees

    // Fee maths: the 8 dedicated squad players each carry the league fee, so a
    // full team total is always 8 × fee (R4000 at R500). Work out how much of
    // that has been collected so the row can show an outstanding balance.
    const teamTotal = TEAM_SQUAD_SIZE * playerFee
    let amountPaid = 0
    if (clubPaysFees) {
      // Team-funded squads settle with a single "team" payment.
      const [teamPay] = await db
        .select({ status: payments.status })
        .from(payments)
        .where(and(eq(payments.teamId, row.team.id), eq(payments.type, "team")))
        .orderBy(desc(payments.createdAt))
        .limit(1)
      amountPaid = teamPay?.status === "paid" ? teamTotal : 0
    } else {
      // Player-funded: each paid squad player covers one fee (capped at 8).
      amountPaid = Math.min(paidCount, TEAM_SQUAD_SIZE) * playerFee
    }
    const outstanding = Math.max(teamTotal - amountPaid, 0)

    teamData.push({
      id: row.team.id,
      name: row.team.name,
      teamType: row.team.teamType,
      homeClubId: row.team.homeClubId ?? null,
      homeClubName: club?.name ?? null,
      homeClubLogoUrl: club?.logoUrl ?? null,
      homeClubContactEmail: club?.contactEmail ?? null,
      ownerEmail: row.team.ownerEmail ?? null,
      avgLi: row.team.avgLi,
      playerCount: row.team.playerCount,
      maxPlayers: row.team.maxPlayers,
      // Prefer the team's denormalised region, falling back to the home club's.
      saplRegion: row.team.saplRegion ?? club?.saplRegion ?? null,
      divisionName: row.division?.name ?? "Unassigned",
      divisionId: row.team.divisionId ?? null,
      tpr: Math.round(row.team.tpr),
      captain: row.team.captainUserId ? (captainMap.get(row.team.captainUserId) ?? null) : null,
      played: standing?.played ?? 0,
      won: standing?.wins ?? 0,
      points: standing?.points ?? 0,
      rank: standing?.rank ?? null,
      clubPaysFees,
      rosterCount: roster.length,
      paidCount,
      teamTotal,
      amountPaid,
      outstanding,
      pairingCategories: pairingData?.categories ?? [],
      pairingRoster: roster,
      pairingInvites: pairingData?.invites ?? [],
    })
  }

  // Captain candidates: every player NOT already committed to another team's
  // active roster. The Assign-Captain picker also folds in the selected team's
  // own squad, so admins can promote a squad member OR recruit any available
  // player — not just those who flagged themselves "looking for a team".
  const freeAgents = await getUnassignedPlayers()

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

  // Venue capacity is managed under Venue Management; here we only need the
  // season lock state for the team-entry controls.
  const locked = await isSeasonLocked()

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
      <OrgHub orgId={org.id} teams={teamData} freeAgents={freeAgents} venues={orgClubs} playerFee={playerFee} locked={locked} />
    </div>
  )
}

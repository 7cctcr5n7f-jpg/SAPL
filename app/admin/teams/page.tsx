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
import { organisations, user as userTable, userMeta, payments } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { TEAM_SQUAD_SIZE } from "@/lib/constants"
import { getClubsWithUsage } from "@/lib/queries-clubs"
import { getPlayerFee } from "@/lib/queries"
import { isSeasonLocked } from "@/lib/season-lock"
import { PageHeader } from "@/components/dashboard/page-header"
import { OrgHub } from "@/components/org/org-hub"
import { requirePermissionPage } from "@/lib/access"

export default async function AdminTeamsPage() {
  const access = await requirePermissionPage("team_management")
  const user = access.user

  // League and super admins manage every team; org admins are scoped to their
  // own. A super admin previewing the org_admin role drops to the scoped view.
  const isAdminWide = access.isLeagueAdmin

  // A club manager assigned via a venue's contact email (or a manual team/club
  // assignment) owns no organisation, but should still manage the teams within
  // their scope.
  const hasScopedAccess = !isAdminWide && (access.clubIds.length > 0 || access.teamIds.length > 0)

  let org = await getOrgByOwner(user.id)

  if (!org && (isAdminWide || user.isSuperAdmin || hasScopedAccess)) {
    const [sample] = await db.select({ id: organisations.id, ownerUserId: organisations.ownerUserId }).from(organisations).orderBy(organisations.id).limit(1)
    org = sample ?? null
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Admin" subtitle="Create and manage teams, captains, squads and fees" />
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold">No teams linked to your account yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Team manager access is granted by the league office. Once you&apos;re set up, your teams will appear here.
          </p>
        </div>
      </div>
    )
  }

  const orgTeamRows = isAdminWide
    ? await getAllTeamsForAdmin()
    : hasScopedAccess
      ? await getScopedTeamRows(access)
      : await getOrgTeams(org.id)

  type CaptainInfo = {
    playerId: string
    name: string
    email: string | null
    phone: string | null
  }
  const captainIds = orgTeamRows.map((r) => r.team.captainUserId).filter(Boolean) as string[]
  const captainMap = new Map<string, CaptainInfo>()
  for (const cid of captainIds) {
    if (captainMap.has(cid)) continue
    const [p] = await db
      .select({ firstName: userTable.firstName, lastName: userTable.lastName, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, cid))
      .limit(1)
    if (!p) continue
    const [m] = await db.select({ phone: userMeta.phone }).from(userMeta).where(eq(userMeta.userId, cid)).limit(1)
    captainMap.set(cid, {
      playerId: cid,
      name: `${p.firstName} ${p.lastName}`,
      email: p.email ?? null,
      phone: m?.phone ?? null,
    })
  }

  const cats = await getCategories()
  const catNames = cats.map((c) => c.name)

  const clubInfo = await getClubsWithUsage()
  const clubById = new Map(clubInfo.map((c) => [c.id, c]))

  const playerFee = await getPlayerFee()

  const teamData = []
  for (const row of orgTeamRows) {
    const standing = await getStandingForTeam(row.team.id)
    const pairingData = await getTeamPairingData(row.team.id, catNames)
    const club = row.team.homeClubId ? clubById.get(row.team.homeClubId) : undefined
    const roster = pairingData?.roster ?? []
    const paidCount = roster.filter((p) => p.paid).length
    const clubPaysFees = pairingData?.team.clubPaysFees ?? row.team.clubPaysFees

    const teamTotal = TEAM_SQUAD_SIZE * playerFee
    let amountPaid = 0
    if (clubPaysFees) {
      const [teamPay] = await db
        .select({ status: payments.status })
        .from(payments)
        .where(and(eq(payments.teamId, row.team.id), eq(payments.type, "team")))
        .orderBy(desc(payments.createdAt))
        .limit(1)
      amountPaid = teamPay?.status === "paid" ? teamTotal : 0
    } else {
      amountPaid = Math.min(paidCount, TEAM_SQUAD_SIZE) * playerFee
    }
    const outstanding = Math.max(teamTotal - amountPaid, 0)

    // Resolve the owner's display name from their email so the UI can show
    // "Ruan Broe" instead of the raw email address.
    let ownerName: string | null = null
    if (row.team.ownerEmail) {
      const [ownerUser] = await db
        .select({ firstName: userTable.firstName, lastName: userTable.lastName })
        .from(userTable)
        .where(eq(userTable.email, row.team.ownerEmail))
        .limit(1)
      if (ownerUser) {
        ownerName = `${ownerUser.firstName ?? ""} ${ownerUser.lastName ?? ""}`.trim() || row.team.ownerEmail
      } else {
        // No registered user for this email yet — show the email address itself
        ownerName = row.team.ownerEmail
      }
    }

    teamData.push({
      id: row.team.id,
      name: row.team.name,
      teamType: row.team.teamType,
      homeClubId: row.team.homeClubId ?? null,
      homeClubName: club?.name ?? null,
      homeClubLogoUrl: club?.logoUrl ?? null,
      homeClubContactEmail: club?.contactEmail ?? null,
      homeClubContactEmail2: club?.contactEmail2 ?? null,
      ownerEmail: row.team.ownerEmail ?? null,
      ownerName,
      avgLi: row.team.avgLi,
      playerCount: row.team.playerCount,
      maxPlayers: row.team.maxPlayers,
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

  const freeAgents = await getUnassignedPlayers()

  const clubUsage = await getClubsWithUsage()
  const orgClubs = clubUsage.map((c) => ({
    id: c.id,
    name: c.name,
    remaining: c.remaining,
    hosts: c.hosts,
    available: c.hosts && c.remaining > 0,
  }))

  const locked = await isSeasonLocked()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Admin"
        subtitle={isAdminWide ? "All teams across the league" : "Create and manage your teams, captains, squads and fees"}
      />
      <OrgHub orgId={org.id} teams={teamData} freeAgents={freeAgents} venues={orgClubs} playerFee={playerFee} locked={locked} />
    </div>
  )
}

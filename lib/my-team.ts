import "server-only"
import { db } from "@/lib/db"
import { teams, teamMembers, teamInvites, divisions, clubs, user, payments, fixtures, standings } from "@/lib/db/schema"
import { and, eq, ne, or, desc } from "drizzle-orm"
import { getTeamReadiness, suggestDivision, type TeamReadiness } from "@/lib/team-readiness"
import { getPlayerFee } from "@/lib/queries"
import { getTeamPairingData, type PairingCategory } from "@/lib/queries-dashboard"
import { CATEGORY_RULES } from "@/lib/constants"

export type MyTeamSlot =
  | {
      kind: "player"
      membershipId: number
      playerId: string
      name: string
      email: string | null
      avatarUrl: string | null
      playtomicRating: number | null
      playtomicUrl: string | null
      isCaptain: boolean
      registered: boolean
      paid: boolean
    }
  | {
      kind: "pending"
      inviteId: number
      name: string | null
      email: string
      playtomicRating: number | null
    }
  | { kind: "empty" }

export type MyTeamPaymentStatus = {
  clubPaysFees: boolean
  playerFee: number
  paidCount: number
  unpaidCount: number
  outstandingAmount: number
}

export type MyTeamNextFixture = {
  id: number
  week: number | null
  opponent: string
  isHome: boolean
  matchDate: string | null
  venue: string | null
  timeslot: string | null
} | null

export type MyTeamView = {
  team: {
    id: number
    name: string
    logoUrl: string | null
    teamType: string
    clubName: string | null
    clubLogoUrl: string | null
    divisionName: string
    captainName: string | null
    captainEmail: string | null
    captainPhone: string | null
    ownerEmail: string | null
  }
  readiness: TeamReadiness
  avgRating: number | null
  suggestedDivision: string | null
  slots: MyTeamSlot[]
  payment: MyTeamPaymentStatus
  nextFixture: MyTeamNextFixture
  standing: { played: number; wins: number; points: number; rank: number | null } | null
  /** Other active teams the player belongs to, for the team switcher. */
  otherTeams: { id: number; name: string }[]
  /** Whether the viewer may add players (owner / captain / manager / admin). */
  canManage: boolean
  /** Pairings grouped by category for the squad section. */
  pairingCategories: PairingCategory[]
}

const SQUAD_SIZE = 8

/**
 * Assembles the read-only "My Team" view for a player: team identity, an
 * 8-slot roster (active players, pending invites, then empty Add-Player slots),
 * League Ready status, average Playtomic rating, payment status, next fixture
 * and league position. Returns null when the player belongs to no team.
 *
 * When `preferredTeamId` is supplied and the player belongs to it, that team is
 * shown; otherwise the most recently updated active membership is used.
 */
export async function getMyTeamView(playerId: string, opts?: { preferredTeamId?: number; canManage?: boolean }): Promise<MyTeamView | null> {
  // Active memberships, newest first.
  const memberships = await db
    .select({ teamId: teamMembers.teamId, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.playerId, playerId), eq(teamMembers.status, "active")))
    .orderBy(desc(teamMembers.updatedAt))

  if (memberships.length === 0) return null

  const chosen =
    (opts?.preferredTeamId && memberships.find((m) => m.teamId === opts.preferredTeamId)) || memberships[0]
  const teamId = chosen.teamId
  const otherTeams = memberships.filter((m) => m.teamId !== teamId).map((m) => ({ id: m.teamId, name: m.name }))

  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      logoUrl: teams.logoUrl,
      teamType: teams.teamType,
      divisionId: teams.divisionId,
      homeClubId: teams.homeClubId,
      captainUserId: teams.captainUserId,
      clubPaysFees: teams.clubPaysFees,
      ownerEmail: teams.ownerEmail,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return null

  // Division, club, captain lookups.
  let divisionName = "Unassigned"
  if (team.divisionId) {
    const [d] = await db.select({ name: divisions.name }).from(divisions).where(eq(divisions.id, team.divisionId)).limit(1)
    if (d) divisionName = d.name
  }
  let clubName: string | null = null
  let clubLogoUrl: string | null = null
  if (team.homeClubId) {
    const [c] = await db.select({ name: clubs.name, logoUrl: clubs.logoUrl }).from(clubs).where(eq(clubs.id, team.homeClubId)).limit(1)
    if (c) {
      clubName = c.name
      clubLogoUrl = c.logoUrl
    }
  }
  console.log("[v0] getMyTeamView: team found, captainUserId=", team.captainUserId, "ownerEmail=", team.ownerEmail)
  let captainName: string | null = null
  let captainEmail: string | null = null
  let captainPhone: string | null = null
  if (team.captainUserId) {
    const [cap] = await db
      .select({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone })
      .from(user)
      .where(eq(user.id, team.captainUserId))
      .limit(1)
    if (cap) {
      const parts = [cap.firstName, cap.lastName].filter(Boolean)
      captainName = parts.length > 0 ? parts.join(" ") : null
      captainEmail = cap.email ?? null
      captainPhone = cap.phone ?? null
    }
  }

  // Active roster (with ratings + registration + payment status).
  const rosterRows = await db
    .select({
      membershipId: teamMembers.id,
      playerId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      playtomicRating: user.playtomicRating,
      playtomicUrl: user.playtomicUrl,
      isPlayer: user.isPlayer,
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.playerId, user.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")))
    .orderBy(desc(user.playtomicRating))

  // Individual payment lookup (per player) unless the club covers fees.
  const paidPlayerIds = new Set<string>()
  if (!team.clubPaysFees) {
    const paidRows = await db
      .select({ playerId: payments.playerId })
      .from(payments)
      .where(and(eq(payments.teamId, teamId), eq(payments.type, "individual"), eq(payments.status, "paid")))
    for (const p of paidRows) if (p.playerId) paidPlayerIds.add(p.playerId)
  }

  // Pending email invites (players added but not yet registered).
  const pendingRows = await db
    .select({
      inviteId: teamInvites.id,
      email: teamInvites.email,
      invitedName: teamInvites.invitedName,
      invitedRating: teamInvites.invitedRating,
    })
    .from(teamInvites)
    .where(and(eq(teamInvites.teamId, teamId), eq(teamInvites.status, "pending")))
    .orderBy(desc(teamInvites.createdAt))

  // Build the ordered slot list: active players, pending invites, empties → 8.
  const slots: MyTeamSlot[] = []
  for (const r of rosterRows) {
    slots.push({
      kind: "player",
      membershipId: r.membershipId,
      playerId: r.playerId,
      name: `${r.firstName} ${r.lastName}`,
      email: r.email ?? null,
      avatarUrl: r.avatarUrl ?? null,
      playtomicRating: r.playtomicRating ?? null,
      playtomicUrl: r.playtomicUrl ?? null,
      isCaptain: r.playerId === team.captainUserId,
      registered: Boolean(r.isPlayer),
      paid: team.clubPaysFees || paidPlayerIds.has(r.playerId),
    })
  }
  for (const p of pendingRows) {
    if (slots.length >= SQUAD_SIZE) break
    slots.push({
      kind: "pending",
      inviteId: p.inviteId,
      name: p.invitedName ?? null,
      email: p.email,
      playtomicRating: p.invitedRating ?? null,
    })
  }
  while (slots.length < SQUAD_SIZE) slots.push({ kind: "empty" })

  // Readiness + averages.
  const readiness =
    (await getTeamReadiness(teamId)) ??
    ({
      teamId,
      playerCount: rosterRows.length,
      maxPlayers: SQUAD_SIZE,
      avgRating: null,
      avgLi: null,
      paidCount: 0,
      unpaidCount: rosterRows.length,
      rosterComplete: rosterRows.length >= SQUAD_SIZE,
      feesSettled: false,
      clubPaysFees: team.clubPaysFees,
      isLeagueReady: false,
      reasons: [],
    } as TeamReadiness)

  // Payment status. For player-funded teams, outstanding is per unpaid player;
  // for club-funded teams, the outstanding balance is the full squad fee total.
  const playerFee = await getPlayerFee()
  const payment: MyTeamPaymentStatus = team.clubPaysFees
    ? {
        clubPaysFees: true,
        playerFee,
        paidCount: readiness.paidCount,
        unpaidCount: 0,
        // Club-funded squads settle a single team payment; approximate the
        // outstanding balance as the full-squad total until it is marked paid.
        outstandingAmount: readiness.feesSettled ? 0 : SQUAD_SIZE * playerFee,
      }
    : {
        clubPaysFees: false,
        playerFee,
        paidCount: readiness.paidCount,
        unpaidCount: readiness.unpaidCount,
        outstandingAmount: readiness.unpaidCount * playerFee,
      }

  // Next fixture: earliest scheduled (non-completed) fixture by week.
  const fxRows = await db
    .select({
      id: fixtures.id,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      status: fixtures.status,
      venue: fixtures.venue,
      timeslot: fixtures.timeslot,
    })
    .from(fixtures)
    .where(
      and(
        ne(fixtures.status, "completed"),
        or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)),
      ),
    )
    .orderBy(fixtures.week)
    .limit(1)
  let nextFixture: MyTeamNextFixture = null
  if (fxRows[0]) {
    const f = fxRows[0]
    const isHome = f.homeTeamId === teamId
    const opponentId = isHome ? f.awayTeamId : f.homeTeamId
    let opponent = "TBD"
    if (opponentId != null) {
      const [o] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, opponentId)).limit(1)
      if (o) opponent = o.name
    }
    nextFixture = {
      id: f.id,
      week: f.week,
      opponent,
      isHome,
      matchDate: f.matchDate ? f.matchDate.toISOString() : null,
      venue: f.venue ?? null,
      timeslot: f.timeslot ?? null,
    }
  }

  // Standing / league position.
  const [standing] = await db
    .select({ played: standings.played, wins: standings.wins, points: standings.points, rank: standings.rank })
    .from(standings)
    .where(eq(standings.teamId, teamId))
    .limit(1)

  // Pairing categories for the grouped squad view.
  console.log("[v0] getMyTeamView: before CATEGORY_RULES", typeof CATEGORY_RULES, Array.isArray(CATEGORY_RULES))
  const catNames = CATEGORY_RULES.map((c) => c.name)
  console.log("[v0] getMyTeamView: catNames", catNames)
  const pairingData = await getTeamPairingData(teamId, catNames)
  console.log("[v0] getMyTeamView: pairingData", pairingData ? "ok" : "null")

  return {
    team: {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl ?? null,
      teamType: team.teamType,
      clubName,
      clubLogoUrl,
      divisionName,
      captainName,
      captainEmail,
      captainPhone,
      ownerEmail: team.ownerEmail ?? null,
    },
    readiness,
    avgRating: readiness.avgRating,
    suggestedDivision: suggestDivision(readiness.avgRating),
    slots,
    payment,
    nextFixture,
    standing: standing ?? null,
    otherTeams,
    canManage: opts?.canManage ?? false,
    pairingCategories: pairingData?.categories ?? [],
  }
}

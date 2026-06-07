import { db } from "@/lib/db"
import {
  players,
  teams,
  teamMembers,
  organisations,
  divisions,
  fixtures,
  payments,
  notifications,
  standings,
  categories,
  seasons,
  matches,
  teamPairings,
  teamInvites,
  fixtureUnavailable,
  user,
  userMeta,
  feeNotes,
  regions,
} from "@/lib/db/schema"
import { eq, and, or, desc, inArray, ne, isNotNull } from "drizzle-orm"

/**
 * Players a captain has marked unavailable, keyed by fixtureId.
 * Returns a plain object so it can cross the server→client boundary.
 */
export async function getTeamUnavailability(teamId: number): Promise<Record<number, number[]>> {
  const rows = await db
    .select({ fixtureId: fixtureUnavailable.fixtureId, playerId: fixtureUnavailable.playerId })
    .from(fixtureUnavailable)
    .where(eq(fixtureUnavailable.teamId, teamId))
  const map: Record<number, number[]> = {}
  for (const r of rows) (map[r.fixtureId] ??= []).push(r.playerId)
  return map
}

export type PairingPlayer = {
  playerId: number
  name: string
  li: number
  gender: string | null
  paid: boolean
}
export type PairingSlot = { pairIndex: number; slotIndex: number; player: PairingPlayer | null }
export type PairingCategory = { category: string; pairs: PairingSlot[][] }

// Aggregate everything the pairings board needs for one team.
export async function getTeamPairingData(teamId: number, categoryNames: string[]) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return null

  // Active roster players.
  const rosterRows = await db
    .select({ player: players, status: teamMembers.status })
    .from(teamMembers)
    .innerJoin(players, eq(teamMembers.playerId, players.id))
    .where(and(eq(teamMembers.teamId, teamId), ne(teamMembers.status, "removed")))

  // Which players have paid (individual payment for this team).
  const paidRows = await db
    .select({ playerId: payments.playerId })
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.status, "paid")))
  const paidSet = new Set(paidRows.map((r) => r.playerId))

  const roster: PairingPlayer[] = rosterRows.map((r) => ({
    playerId: r.player.id,
    name: `${r.player.firstName} ${r.player.lastName}`,
    li: r.player.currentLi,
    gender: r.player.gender,
    // If the club covers fees, everyone is considered covered.
    paid: team.clubPaysFees || paidSet.has(r.player.id),
  }))
  const rosterById = new Map(roster.map((p) => [p.playerId, p]))

  const slotRows = await db.select().from(teamPairings).where(eq(teamPairings.teamId, teamId))
  const slotMap = new Map<string, number | null>()
  for (const s of slotRows) {
    slotMap.set(`${s.category}|${s.pairIndex}|${s.slotIndex}`, s.playerId)
  }

  // Build 1 pair x 2 slots per category (4 categories = 8 players).
  const categoryBoards: PairingCategory[] = categoryNames.map((category) => {
    const pairs: PairingSlot[][] = [1].map((pairIndex) =>
      [1, 2].map((slotIndex) => {
        const pid = slotMap.get(`${category}|${pairIndex}|${slotIndex}`) ?? null
        return {
          pairIndex,
          slotIndex,
          player: pid != null ? (rosterById.get(pid) ?? null) : null,
        }
      }),
    )
    return { category, pairs }
  })

  const invites = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.teamId, teamId), eq(teamInvites.status, "pending")))

  return {
    team: { id: team.id, name: team.name, clubPaysFees: team.clubPaysFees },
    roster,
    categories: categoryBoards,
    invites: invites.map((i) => ({ id: i.id, email: i.email, category: i.category })),
  }
}

export async function getPlayerByUserId(userId: string) {
  const [p] = await db.select().from(players).where(eq(players.userId, userId)).limit(1)
  return p ?? null
}

export async function getCurrentSeason() {
  const [s] = await db.select().from(seasons).where(eq(seasons.isCurrent, true)).limit(1)
  if (s) return s
  const [latest] = await db.select().from(seasons).orderBy(desc(seasons.id)).limit(1)
  return latest ?? null
}

export type RosterEntry = {
  membership: typeof teamMembers.$inferSelect
  team: typeof teams.$inferSelect
  org: typeof organisations.$inferSelect | null
  division: typeof divisions.$inferSelect | null
}

export async function getPlayerMemberships(playerId: number): Promise<RosterEntry[]> {
  const rows = await db
    .select({
      membership: teamMembers,
      team: teams,
      org: organisations,
      division: divisions,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(organisations, eq(teams.organisationId, organisations.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(eq(teamMembers.playerId, playerId))
    .orderBy(desc(teamMembers.updatedAt))
  return rows as RosterEntry[]
}

export async function getPlayerPayments(userId: string, playerId: number) {
  return db
    .select()
    .from(payments)
    .where(or(eq(payments.payerUserId, userId), eq(payments.playerId, playerId)))
    .orderBy(desc(payments.createdAt))
}

export type PlayerTeamFee = {
  teamId: number
  teamName: string
  clubPaysFees: boolean
  amount: number
  vatAmount: number
  status: "covered" | "paid" | "due"
  paymentId: number | null
}

// For each active team the player belongs to, work out their fee status:
//  - covered: the club pays this team's fees
//  - paid: the player already paid their individual fee
//  - due: an individual fee is outstanding
export async function getPlayerTeamFees(playerId: number): Promise<PlayerTeamFee[]> {
  const memberRows = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.playerId, playerId), eq(teamMembers.status, "active")))

  const { splitVatInclusive } = await import("@/lib/constants")
  const { getPlayerFee } = await import("@/lib/queries")

  const result: PlayerTeamFee[] = []
  for (const { team } of memberRows) {
    const { amount, vatAmount } = splitVatInclusive(await getPlayerFee(team.seasonId))
    if (team.clubPaysFees) {
      result.push({
        teamId: team.id,
        teamName: team.name,
        clubPaysFees: true,
        amount,
        vatAmount,
        status: "covered",
        paymentId: null,
      })
      continue
    }
    const [pay] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.teamId, team.id), eq(payments.playerId, playerId), eq(payments.type, "individual")))
      .orderBy(desc(payments.createdAt))
      .limit(1)
    result.push({
      teamId: team.id,
      teamName: team.name,
      clubPaysFees: false,
      amount,
      vatAmount,
      status: pay?.status === "paid" ? "paid" : "due",
      paymentId: pay?.id ?? null,
    })
  }
  return result
}

export type OutstandingFee = {
  // "player" = an individual who must pay their own fee. "team" = a team whose
  // owner/manager agreed to fund the whole squad's fees.
  kind: "player" | "team"
  playerId: number
  playerName: string
  email: string | null
  phone: string | null
  teamId: number
  teamName: string
  amount: number
  vatAmount: number
  // Billing-management metadata (from ppl_fee_notes), merged in for admins.
  note: string | null
  lastReminderAt: string | null
  reminderCount: number
}

/**
 * Admin-only: every player with an outstanding individual league fee, with
 * contact details so admins can chase payment. Only includes teams where the
 * club/manager does NOT cover fees and the player has no successful payment.
 */
export async function getOutstandingFees(): Promise<OutstandingFee[]> {
  const { splitVatInclusive } = await import("@/lib/constants")
  const { getPlayerFee } = await import("@/lib/queries")
  // Cache the resolved fee per season so we don't re-query for every player.
  const feeBySeason = new Map<number | string, { amount: number; vatAmount: number }>()
  async function feeFor(seasonId: number | null) {
    const key = seasonId ?? "current"
    const cached = feeBySeason.get(key)
    if (cached) return cached
    const split = splitVatInclusive(await getPlayerFee(seasonId))
    feeBySeason.set(key, split)
    return split
  }

  // Active memberships on teams whose fees are NOT covered by the club.
  const rows = await db
    .select({
      playerId: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      userId: players.userId,
      teamId: teams.id,
      teamName: teams.name,
      seasonId: teams.seasonId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(players, eq(teamMembers.playerId, players.id))
    // Only chase fees once a team has actually been placed in a division under
    // League Control — unplaced teams aren't competing yet, so no fee is due.
    .where(and(eq(teamMembers.status, "active"), eq(teams.clubPaysFees, false), isNotNull(teams.divisionId)))

  const result: OutstandingFee[] = []
  for (const r of rows) {
    const [pay] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(and(eq(payments.teamId, r.teamId), eq(payments.playerId, r.playerId), eq(payments.type, "individual")))
      .orderBy(desc(payments.createdAt))
      .limit(1)
    if (pay?.status === "paid") continue

    const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, r.userId)).limit(1)
    const [m] = await db.select({ phone: userMeta.phone }).from(userMeta).where(eq(userMeta.userId, r.userId)).limit(1)
    const { amount, vatAmount } = await feeFor(r.seasonId)

    result.push({
      kind: "player",
      playerId: r.playerId,
      playerName: `${r.firstName} ${r.lastName}`.trim(),
      email: u?.email ?? null,
      phone: m?.phone ?? null,
      teamId: r.teamId,
      teamName: r.teamName,
      amount,
      vatAmount,
      note: null,
      lastReminderAt: null,
      reminderCount: 0,
    })
  }

  // Team-funded teams: the owner/manager agreed to cover the whole squad, so the
  // league chases the responsible person, not individual players. Each owes for
  // the 8 dedicated squad players (R4000 at R500) unless a paid team payment
  // already exists.
  const { TEAM_SQUAD_SIZE } = await import("@/lib/constants")
  const fundedTeams = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      seasonId: teams.seasonId,
      managerUserId: teams.managerUserId,
      organisationId: teams.organisationId,
    })
    .from(teams)
    // Same rule for team-funded squads: only billable once placed in a division.
    .where(and(eq(teams.clubPaysFees, true), eq(teams.status, "active"), isNotNull(teams.divisionId)))

  for (const t of fundedTeams) {
    const [pay] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(and(eq(payments.teamId, t.teamId), eq(payments.type, "team")))
      .orderBy(desc(payments.createdAt))
      .limit(1)
    if (pay?.status === "paid") continue

    // Resolve the responsible person: the team manager, else the org owner.
    let ownerUserId = t.managerUserId
    if (!ownerUserId && t.organisationId) {
      const [org] = await db
        .select({ ownerUserId: organisations.ownerUserId })
        .from(organisations)
        .where(eq(organisations.id, t.organisationId))
        .limit(1)
      ownerUserId = org?.ownerUserId ?? null
    }

    let ownerName = "Team owner"
    let email: string | null = null
    let phone: string | null = null
    if (ownerUserId) {
      const [u] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, ownerUserId)).limit(1)
      const [m] = await db.select({ phone: userMeta.phone }).from(userMeta).where(eq(userMeta.userId, ownerUserId)).limit(1)
      ownerName = u?.name?.trim() || "Team owner"
      email = u?.email ?? null
      phone = m?.phone ?? null
    }

    const perPlayer = await feeFor(t.seasonId)
    const amount = Math.round(perPlayer.amount * TEAM_SQUAD_SIZE * 100) / 100
    const vatAmount = Math.round(perPlayer.vatAmount * TEAM_SQUAD_SIZE * 100) / 100

    result.push({
      kind: "team",
      // Negative id keeps the row key unique and clearly non-player.
      playerId: -t.teamId,
      playerName: ownerName,
      email,
      phone,
      teamId: t.teamId,
      teamName: t.teamName,
      amount,
      vatAmount,
      note: null,
      lastReminderAt: null,
      reminderCount: 0,
    })
  }

  // Merge billing-management metadata (admin notes + reminder tracking).
  const noteRows = await db.select().from(feeNotes)
  const noteMap = new Map<string, (typeof noteRows)[number]>()
  for (const n of noteRows) noteMap.set(`${n.kind}-${n.teamId}-${n.playerId}`, n)
  for (const f of result) {
    const n = noteMap.get(`${f.kind}-${f.teamId}-${f.playerId}`)
    if (n) {
      f.note = n.note
      f.lastReminderAt = n.lastReminderAt ? n.lastReminderAt.toISOString() : null
      f.reminderCount = n.reminderCount
    }
  }

  // Sort by team then payer for a readable chase-up list.
  result.sort((a, b) => a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName))
  return result
}

export async function getUserNotifications(userId: string, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(or(eq(notifications.userId, userId), eq(notifications.scope, "broadcast")))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount(userId: string) {
  const rows = await getUserNotifications(userId, 50)
  return rows.filter((n) => !n.readAt).length
}

// Team / captain helpers ----------------------------------------------------

export type ManagedPlayer = {
  playerId: number
  name: string
  gender: "male" | "female"
  currentLi: number
  playtomicRating: number | null
  playtomicUrl: string | null
  teams: { teamId: number; teamName: string; divisionName: string | null }[]
}

/**
 * Admin-only: every registered player with the team(s) they play for, their
 * Playtomic rating, League Index and Playtomic profile link. Used by the
 * Player Management dashboard for inline rating edits + filtering.
 */
export async function getManagedPlayers(): Promise<ManagedPlayer[]> {
  const rows = await db
    .select({
      playerId: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      gender: players.gender,
      currentLi: players.currentLi,
      playtomicRating: players.playtomicRating,
      playtomicUrl: players.playtomicUrl,
      teamId: teams.id,
      teamName: teams.name,
      divisionName: divisions.name,
    })
    .from(players)
    .leftJoin(teamMembers, and(eq(teamMembers.playerId, players.id), eq(teamMembers.status, "active")))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .orderBy(players.firstName, players.lastName)

  const byPlayer = new Map<number, ManagedPlayer>()
  for (const r of rows) {
    let p = byPlayer.get(r.playerId)
    if (!p) {
      p = {
        playerId: r.playerId,
        name: `${r.firstName} ${r.lastName}`.trim(),
        gender: r.gender as "male" | "female",
        currentLi: r.currentLi,
        playtomicRating: r.playtomicRating,
        playtomicUrl: r.playtomicUrl,
        teams: [],
      }
      byPlayer.set(r.playerId, p)
    }
    if (r.teamId && !p.teams.some((t) => t.teamId === r.teamId)) {
      p.teams.push({ teamId: r.teamId, teamName: r.teamName ?? "—", divisionName: r.divisionName ?? null })
    }
  }
  return [...byPlayer.values()]
}

export async function getTeamsForCaptain(userId: string) {
  return db.select().from(teams).where(eq(teams.captainUserId, userId)).orderBy(teams.name)
}

export type TeamRosterMember = {
  membership: typeof teamMembers.$inferSelect
  player: typeof players.$inferSelect
}

export async function getTeamRoster(teamId: number): Promise<TeamRosterMember[]> {
  const rows = await db
    .select({ membership: teamMembers, player: players })
    .from(teamMembers)
    .innerJoin(players, eq(teamMembers.playerId, players.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(desc(players.currentLi))
  return rows as TeamRosterMember[]
}

export async function getTeamFixtures(teamId: number) {
  const rows = await db
    .select()
    .from(fixtures)
    .where(or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)))
    .orderBy(fixtures.week)
  // resolve opponent names
  const ids = new Set<number>()
  rows.forEach((f) => {
    if (f.homeTeamId != null) ids.add(f.homeTeamId)
    if (f.awayTeamId != null) ids.add(f.awayTeamId)
  })
  const names = ids.size
    ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, [...ids]))
    : []
  const nameMap = new Map(names.map((n) => [n.id, n.name]))
  return rows.map((f) => ({
    ...f,
    homeName: (f.homeTeamId != null ? nameMap.get(f.homeTeamId) : undefined) ?? "TBD",
    awayName: (f.awayTeamId != null ? nameMap.get(f.awayTeamId) : undefined) ?? "TBD",
  }))
}

export async function getCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder)
}

// Per-category set scores for a set of fixtures, used to pre-fill result edits.
export async function getFixtureScores(fixtureIds: number[]) {
  const map: Record<number, Record<string, { home: number; away: number }>> = {}
  if (fixtureIds.length === 0) return map
  const rows = await db.select().from(matches).where(inArray(matches.fixtureId, fixtureIds))
  for (const m of rows) {
    if (!map[m.fixtureId]) map[m.fixtureId] = {}
    map[m.fixtureId][m.category] = { home: m.homeSetsWon, away: m.awaySetsWon }
  }
  return map
}

export async function getDivisionTeams(divisionId: number) {
  return db.select().from(teams).where(eq(teams.divisionId, divisionId)).orderBy(teams.name)
}

// Free agents (marketplace) for captain invitations
export async function getFreeAgents(limit = 50) {
  return db
    .select()
    .from(players)
    .where(eq(players.lookingForTeam, true))
    .orderBy(desc(players.currentLi))
    .limit(limit)
}

// Org admin helpers ---------------------------------------------------------

export async function getOrgByOwner(userId: string) {
  const [o] = await db.select().from(organisations).where(eq(organisations.ownerUserId, userId)).limit(1)
  return o ?? null
}

export async function getOrgTeams(orgId: number) {
  const rows = await db
    .select({ team: teams, division: divisions })
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(eq(teams.organisationId, orgId))
    .orderBy(teams.name)
  return rows
}

// League/super admins manage every team, not just one org's. Returns the same
// shape as getOrgTeams so the Team Admin page can render either set.
export async function getAllTeamsForAdmin() {
  const rows = await db
    .select({ team: teams, division: divisions })
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .orderBy(teams.name)
  return rows
}

export async function getStandingForTeam(teamId: number) {
  const [s] = await db.select().from(standings).where(eq(standings.teamId, teamId)).limit(1)
  return s ?? null
}

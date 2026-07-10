import "server-only"
import { db } from "@/lib/db"
import { teams, teamMembers, teamInvites, divisions, clubs, user, payments, fixtures, standings, categories, teamPairings } from "@/lib/db/schema"
import { and, eq, ne, or, desc, inArray } from "drizzle-orm"
import { getTeamReadiness, suggestDivision, type TeamReadiness } from "@/lib/team-readiness"
import { getPlayerFee } from "@/lib/queries"

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

export type MyTeamCategorySlot = {
  /** Slot coordinates — passed to the Add Player dialog so the player lands in exactly this slot. */
  category: string
  pairIndex: number
  slotIndex: number
  player: {
    playerId: string
    name: string
    playtomicRating: number | null
    gender: string | null
    paid: boolean
    isCaptain: boolean
  } | null
  inviteId: number | null
  inviteEmail: string | null
  inviteName: string | null
}

export type MyTeamCategory = {
  name: string
  gender: string
  /** Minimum playtomic rating allowed in this category (inclusive). */
  playerMinLi: number
  /** Maximum playtomic rating allowed in this category (inclusive). */
  playerMaxLi: number
  isFeatureCourt: boolean
  slots: MyTeamCategorySlot[]
}

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
    ownerName: string | null
    ownerPhone: string | null
    ownerEmail: string | null
    coOwnerEmail: string | null
  }
  readiness: TeamReadiness
  avgRating: number | null
  suggestedDivision: string | null
  slots: MyTeamSlot[]
  payment: MyTeamPaymentStatus
  nextFixture: MyTeamNextFixture
  standing: { played: number; wins: number; points: number; rank: number | null } | null
  /** Category-grouped squad view (matches the pairings board). */
  pairingCategories: MyTeamCategory[]
  /** Other active teams the player belongs to, for the team switcher. */
  otherTeams: { id: number; name: string }[]
  /** Whether the viewer may add players (owner / captain / manager / admin). */
  canManage: boolean
}

const SQUAD_SIZE = 8

/**
 * Assembles the read-only "My Team" view for a player: team identity, an
 * 8-slot roster (active players, pending invites, then empty Add-Player slots),
 * League Ready status, average Playtomic rating, payment status, next fixture
 * and league position. Returns null when the player belongs to no team and has
 * no managed teams.
 *
 * When `preferredTeamId` is supplied and the player belongs to it (or manages
 * it), that team is shown; otherwise the most recently updated active
 * membership is used, with manager-only teams as a fallback when the user has
 * no active memberships.
 *
 * `managedTeamIds` — IDs of teams the current user manages (owner/captain/club)
 * even without an active roster membership. Used to surface the "My Team" view
 * for owners who were added before they registered an account.
 */
export async function getMyTeamView(playerId: string, opts?: { preferredTeamId?: number; canManage?: boolean; managedTeamIds?: number[] }): Promise<MyTeamView | null> {
  // Active memberships, newest first.
  const memberships = await db
    .select({ teamId: teamMembers.teamId, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.playerId, playerId), eq(teamMembers.status, "active")))
    .orderBy(desc(teamMembers.updatedAt))

  // Determine the team to show. When the user has memberships, prefer the
  // preferred team or the most-recently-updated active one.
  // When the user has no memberships (e.g. owner added before registering),
  // fall back to teams they manage via email ownership / captaincy.
  let teamId: number
  let otherTeams: { id: number; name: string }[]

  if (memberships.length > 0) {
    const chosen =
      (opts?.preferredTeamId && memberships.find((m) => m.teamId === opts.preferredTeamId)) || memberships[0]
    teamId = chosen.teamId
    otherTeams = memberships.filter((m) => m.teamId !== teamId).map((m) => ({ id: m.teamId, name: m.name }))
  } else {
    // No active memberships — check if this user manages any teams by email.
    const managed = opts?.managedTeamIds ?? []
    if (managed.length === 0) return null

    // Fetch names for all managed teams so the team switcher works.
    const managedRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, managed))

    if (managedRows.length === 0) return null

    // Pick the preferred team if it's in scope, otherwise the first managed one.
    const chosenId =
      (opts?.preferredTeamId && managed.includes(opts.preferredTeamId))
        ? opts.preferredTeamId
        : managed[0]

    teamId = chosenId
    otherTeams = managedRows.filter((r) => r.id !== chosenId).map((r) => ({ id: r.id, name: r.name }))
  }

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
      ownerName: teams.ownerName,
      ownerPhone: teams.ownerPhone,
      ownerEmail: teams.ownerEmail,
      coOwnerEmail: teams.coOwnerEmail,
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
  let captainName: string | null = null
  if (team.captainUserId) {
    const [cap] = await db
      .select({ firstName: user.firstName, lastName: user.lastName })
      .from(user)
      .where(eq(user.id, team.captainUserId))
      .limit(1)
    if (cap) captainName = `${cap.firstName} ${cap.lastName}`
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
      gender: user.gender,
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
  // Fetch category/pairIndex/slotIndex so each invite can be pinned to
  // the exact slot it was sent from.
  const pendingRows = await db
    .select({
      inviteId: teamInvites.id,
      email: teamInvites.email,
      invitedName: teamInvites.invitedName,
      invitedRating: teamInvites.invitedRating,
      category: teamInvites.category,
      pairIndex: teamInvites.pairIndex,
      slotIndex: teamInvites.slotIndex,
    })
    .from(teamInvites)
    .where(and(eq(teamInvites.teamId, teamId), eq(teamInvites.status, "pending")))
    .orderBy(desc(teamInvites.createdAt))

  // Fetch category meta + pairing slots for the category-grouped squad view.
  const catMeta = await db
    .select({
      name: categories.name,
      gender: categories.gender,
      isFeatureCourt: categories.isFeatureCourt,
      playerMinLi: categories.playerMinLi,
      playerMaxLi: categories.playerMaxLi,
    })
    .from(categories)
    .orderBy(categories.sortOrder)

  const pairingSlotRows = await db
    .select({ category: teamPairings.category, pairIndex: teamPairings.pairIndex, slotIndex: teamPairings.slotIndex, playerId: teamPairings.playerId })
    .from(teamPairings)
    .where(eq(teamPairings.teamId, teamId))

  // Build a quick lookup: { playerId → display info } from the already-fetched roster.
  const playerMap = new Map<string, { playerId: string; name: string; playtomicRating: number | null; paid: boolean; isCaptain: boolean }>()
  for (const r of rosterRows) {
    playerMap.set(r.playerId, {
      playerId: r.playerId,
      name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
      playtomicRating: r.playtomicRating ?? null,
      gender: r.gender ?? null,
      paid: team.clubPaysFees || paidPlayerIds.has(r.playerId),
      isCaptain: r.playerId === team.captainUserId,
    })
  }

  // Index pending invites by exact slot key "category|pairIndex|slotIndex"
  // so each invite is pinned to the slot it was sent from and never bleeds
  // into another category.
  const inviteBySlot = new Map<string, { id: number; email: string; name: string | null }>()
  for (const p of pendingRows) {
    const cat = (p.category as string | null)
    const pi = (p.pairIndex as number | null)
    const si = (p.slotIndex as number | null)
    if (cat && pi != null && si != null) {
      const key = `${cat}|${pi}|${si}`
      // Keep the most-recent invite per slot (pendingRows is already ordered desc).
      if (!inviteBySlot.has(key)) {
        inviteBySlot.set(key, { id: p.inviteId, email: p.email, name: (p.invitedName as string | null) ?? null })
      }
    }
  }

  // Desired display order: Ladies Open → Mens Open → Mens Intermediate → Mens Beginner.
  const CATEGORY_SORT: Record<string, number> = {
    "Ladies Open": 0,
    "Mens Open": 1,
    "Mens Intermediate": 2,
    "Mens Beginner": 3,
  }

  // Build MyTeamCategory objects. Each slot is populated only from its explicit
  // ppl_team_pairings row (for active players) or its exact-match invite row.
  // No redistribution across categories — a slot that has no pairing row and no
  // matching invite stays as an empty open slot.
  const pairingCategories: MyTeamCategory[] = catMeta
    .map((cat) => {
      const nameLower = cat.name.toLowerCase()
      const derivedGender: string = nameLower.startsWith("ladies") || nameLower.startsWith("women")
        ? "female"
        : nameLower.startsWith("mixed")
        ? "mixed"
        : "male"

      const slots: MyTeamCategorySlot[] = [1, 2].map((slotIndex) => {
        const pairingRow = pairingSlotRows.find(
          (s) => s.category === cat.name && s.pairIndex === 1 && s.slotIndex === slotIndex,
        )
        const player = pairingRow?.playerId ? (playerMap.get(pairingRow.playerId) ?? null) : null
        const invite = !player ? (inviteBySlot.get(`${cat.name}|1|${slotIndex}`) ?? null) : null
        return {
          category: cat.name,
          pairIndex: 1,
          slotIndex,
          player,
          inviteId: invite?.id ?? null,
          inviteEmail: invite?.email ?? null,
          inviteName: invite?.name ?? null,
        }
      })

      return {
        name: cat.name,
        gender: derivedGender,
        playerMinLi: cat.playerMinLi,
        playerMaxLi: cat.playerMaxLi,
        isFeatureCourt: cat.isFeatureCourt,
        slots,
      }
    })
    .sort((a, b) => {
      const aOrder = CATEGORY_SORT[a.name] ?? 99
      const bOrder = CATEGORY_SORT[b.name] ?? 99
      return aOrder - bOrder
    })

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
      ownerName: team.ownerName ?? null,
      ownerPhone: team.ownerPhone ?? null,
      ownerEmail: team.ownerEmail ?? null,
      coOwnerEmail: team.coOwnerEmail ?? null,
    },
    readiness,
    avgRating: readiness.avgRating,
    suggestedDivision: suggestDivision(readiness.avgRating),
    slots,
    payment,
    nextFixture,
    standing: standing ?? null,
    pairingCategories,
    otherTeams,
    canManage: opts?.canManage ?? false,
  }
}

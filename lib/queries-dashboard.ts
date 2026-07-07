import { db } from "@/lib/db"
import {
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
  clubs,
} from "@/lib/db/schema"
import { eq, and, or, desc, inArray, ne, isNotNull } from "drizzle-orm"
import type { AccessContext } from "@/lib/access"
import { parseScoreDetail } from "@/lib/engine/scoring"

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
  playerId: string
  name: string
  li: number
  gender: string | null
  paid: boolean
}
export type PairingSlot = { pairIndex: number; slotIndex: number; player: PairingPlayer | null }
export type PairingCategory = { category: string; pairs: PairingSlot[][] }

// Aggregate everything the pairings board needs for one team.
export async function getTeamPairingData(teamId: number, categoryNames: string[]) {
  const [team] = await db
    .select({ id: teams.id, name: teams.name, clubPaysFees: teams.clubPaysFees })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return null

  // The squad IS the set of unique players assigned to pairing slots.
  // There is no separate roster table — ppl_team_pairings is the single source
  // of truth for who is on the team.
  const slotRows = await db
    .select({
      category: teamPairings.category,
      pairIndex: teamPairings.pairIndex,
      slotIndex: teamPairings.slotIndex,
      playerId: teamPairings.playerId,
    })
    .from(teamPairings)
    .where(eq(teamPairings.teamId, teamId))

  // Collect unique player IDs that are actually filled in.
  const filledPlayerIds = [...new Set(
    slotRows.map((s) => s.playerId).filter((id): id is string => id != null),
  )]

  // Which players have paid (individual payment for this team).
  const paidRows = await db
    .select({ playerId: payments.playerId })
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.status, "paid")))
  const paidSet = new Set(paidRows.map((r) => r.playerId))

  // Fetch profile data for all players currently in a pairing slot.
  const rosterById = new Map<string, PairingPlayer>()
  if (filledPlayerIds.length > 0) {
    const profileRows = await db
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        currentLi: user.currentLi,
        gender: user.gender,
      })
      .from(user)
      .where(inArray(user.id, filledPlayerIds))
    for (const p of profileRows) {
      rosterById.set(p.id, {
        playerId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        li: p.currentLi,
        gender: p.gender,
        paid: team.clubPaysFees || paidSet.has(p.id),
      })
    }
  }

  // Roster = all players that have at least one pairing slot (for the board's
  // "available to assign" list and fee summary).
  const roster: PairingPlayer[] = [...rosterById.values()]

  const slotMap = new Map<string, string | null>()
  for (const s of slotRows) {
    slotMap.set(`${s.category}|${s.pairIndex}|${s.slotIndex}`, s.playerId ?? null)
  }

  // Build 1 pair x 2 slots per category (4 categories = 8 players).
  const categoryBoards: PairingCategory[] = categoryNames.map((category) => {
    const pairs: PairingSlot[][] = [1].map((pairIndex) =>
      [1, 2].map((slotIndex) => {
        const pid = slotMap.get(`${category}|${pairIndex}|${slotIndex}`) ?? null
        return { pairIndex, slotIndex, player: pid != null ? (rosterById.get(pid) ?? null) : null }
      }),
    )
    return { category, pairs }
  })

  const invites = await db
    .select({ id: teamInvites.id, email: teamInvites.email, category: teamInvites.category, status: teamInvites.status })
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
  const [p] = await db
    .select({
      id: user.id,
      currentLi: user.currentLi,
      highestLi: user.highestLi,
      playtomicRating: user.playtomicRating,
      playtomicUrl: user.playtomicUrl,
      gender: user.gender,
      lookingForTeam: user.lookingForTeam,
      availability: user.availability,
      avatarUrl: user.avatarUrl,
      // Profile form fields
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      city: user.city,
      preferredClubIds: user.preferredClubIds,
      anyClub: user.anyClub,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return p ?? null
}

export async function getCurrentSeason() {
  const [s] = await db
    .select({ id: seasons.id, isCurrent: seasons.isCurrent, playerFee: seasons.playerFee })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1)
  if (s) return s
  const [latest] = await db
    .select({ id: seasons.id, isCurrent: seasons.isCurrent, playerFee: seasons.playerFee })
    .from(seasons)
    .orderBy(desc(seasons.id))
    .limit(1)
  return latest ?? null
}

export type RosterEntry = {
  membership: typeof teamMembers.$inferSelect
  team: typeof teams.$inferSelect
  org: typeof organisations.$inferSelect | null
  division: typeof divisions.$inferSelect | null
  season: typeof seasons.$inferSelect | null
}

export async function getPlayerMemberships(playerId: string): Promise<RosterEntry[]> {
  const rows = await db
    .select({
      membership: {
        id: teamMembers.id, teamId: teamMembers.teamId, playerId: teamMembers.playerId,
        status: teamMembers.status, role: teamMembers.role,
      },
      team: {
        id: teams.id, name: teams.name, divisionId: teams.divisionId, seasonId: teams.seasonId,
        organisationId: teams.organisationId, captainUserId: teams.captainUserId,
        homeClubId: teams.homeClubId, teamType: teams.teamType, clubPaysFees: teams.clubPaysFees,
        avgLi: teams.avgLi, tpr: teams.tpr,
      },
      org: {
        id: organisations.id, name: organisations.name, slug: organisations.slug,
        type: organisations.type, city: organisations.city, province: organisations.province,
        logoUrl: organisations.logoUrl,
      },
      division: {
        id: divisions.id, name: divisions.name, level: divisions.level, seasonId: divisions.seasonId,
      },
      season: {
        id: seasons.id, isCurrent: seasons.isCurrent, playerFee: seasons.playerFee,
      },
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(organisations, eq(teams.organisationId, organisations.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .leftJoin(seasons, eq(teams.seasonId, seasons.id))
    .where(eq(teamMembers.playerId, playerId))
    .orderBy(desc(teamMembers.updatedAt))
  return rows as RosterEntry[]
}

/**
 * Enforces "one team per player per season". Returns the conflicting team
 * (name + id) if the player is already an active member of a *different* team
 * in the same season, otherwise null. A null seasonId (team not yet assigned to
 * a season) is treated as unconstrained.
 */
export async function getPlayerSeasonTeamConflict(
  playerId: string,
  seasonId: number | null,
  excludeTeamId: number,
): Promise<{ teamId: number; teamName: string } | null> {
  if (seasonId == null) return null
  const rows = await db
    .select({ teamId: teams.id, teamName: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(eq(teamMembers.playerId, playerId), eq(teamMembers.status, "active"), eq(teams.seasonId, seasonId)),
    )
  const conflict = rows.find((r) => r.teamId !== excludeTeamId)
  return conflict ?? null
}

export async function getPlayerPayments(userId: string, playerId: string) {
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
export async function getPlayerTeamFees(playerId: string): Promise<PlayerTeamFee[]> {
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

export type PlayerOverviewTeam = {
  membershipId: number
  teamId: number
  teamName: string
  role: string
  clubName: string | null
  divisionName: string
  regionName: string | null
  clubPaysFees: boolean
  // League standing for the current season (null until matches are played).
  position: number | null
  wins: number
  losses: number
  played: number
}

/**
 * Compact summary of the player's primary active team for the Overview match
 * centre: club, division, region, fee responsibility and league position.
 * Returns null when the player isn't on an active team.
 */
export async function getPlayerOverviewTeam(playerId: string): Promise<PlayerOverviewTeam | null> {
  const [row] = await db
    .select({
      membershipId: teamMembers.id,
      role: teamMembers.role,
      teamId: teams.id,
      teamName: teams.name,
      clubPaysFees: teams.clubPaysFees,
      divisionName: divisions.name,
      seasonId: teams.seasonId,
      regionName: regions.name,
      clubName: clubs.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .leftJoin(clubs, eq(teams.homeClubId, clubs.id))
    .where(and(eq(teamMembers.playerId, playerId), eq(teamMembers.status, "active")))
    .orderBy(desc(teamMembers.updatedAt))
    .limit(1)

  if (!row) return null

  const [standing] = await db
    .select({
      rank: standings.rank,
      wins: standings.wins,
      losses: standings.losses,
      played: standings.played,
    })
    .from(standings)
    .where(and(eq(standings.teamId, row.teamId)))
    .limit(1)

  return {
    membershipId: row.membershipId,
    teamId: row.teamId,
    teamName: row.teamName,
    role: row.role,
    clubName: row.clubName,
    divisionName: row.divisionName ?? "Unassigned",
    regionName: row.regionName,
    clubPaysFees: row.clubPaysFees,
    position: standing?.rank ?? null,
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    played: standing?.played ?? 0,
  }
}

// One category rubber within a fixture, from the perspective of a given player.
export type FixtureCategoryDetail = {
  category: string
  isFeatureCourt: boolean
  // Per-category Playtomic booking link (from fixtures.courtLinks), if set.
  courtLink: string | null
  homePlayers: string[]
  awayPlayers: string[]
  // Result fields (only present once the rubber is played).
  scoreDetail: string | null
  homeSetsWon: number | null
  awaySetsWon: number | null
  winnerTeamId: number | null
  // Player perspective: is this the category the player is lined up for?
  isMine: boolean
  partner: string | null
  opponents: string[]
}

export type FixtureDetail = {
  fixtureId: number
  myCategory: string | null
  categories: FixtureCategoryDetail[]
}

/**
 * For each fixture, assembles per-category detail (lineup, partner, opponents,
 * court booking link, and result) from the player's perspective. Lineups come
 * from team pairings; results from played matches. Degrades gracefully — when a
 * captain hasn't set the lineup yet, player lists are simply empty.
 */
export async function getFixtureDetails(
  fixtureIds: number[],
  playerId: string,
): Promise<Map<number, FixtureDetail>> {
  const out = new Map<number, FixtureDetail>()
  if (fixtureIds.length === 0) return out

  const fixtureRows = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      courtLinks: fixtures.courtLinks,
    })
    .from(fixtures)
    .where(inArray(fixtures.id, fixtureIds))

  const teamIds = new Set<number>()
  for (const f of fixtureRows) {
    if (f.homeTeamId) teamIds.add(f.homeTeamId)
    if (f.awayTeamId) teamIds.add(f.awayTeamId)
  }
  const teamIdList = [...teamIds]

  // Played rubbers for these fixtures (carry score + per-match player ids).
  const matchRows = fixtureIds.length
    ? await db
        .select({
          id: matches.id, fixtureId: matches.fixtureId, category: matches.category,
          homeSetsWon: matches.homeSetsWon, awaySetsWon: matches.awaySetsWon,
          homeGames: matches.homeGames, awayGames: matches.awayGames,
          scoreDetail: matches.scoreDetail, winnerTeamId: matches.winnerTeamId,
          homePlayerIds: matches.homePlayerIds, awayPlayerIds: matches.awayPlayerIds,
        })
        .from(matches)
        .where(inArray(matches.fixtureId, fixtureIds))
    : []

  // Planned lineups for every involved team.
  const pairingRows = teamIdList.length
    ? await db
        .select({
          teamId: teamPairings.teamId, category: teamPairings.category,
          pairIndex: teamPairings.pairIndex, slotIndex: teamPairings.slotIndex,
          playerId: teamPairings.playerId,
        })
        .from(teamPairings)
        .where(inArray(teamPairings.teamId, teamIdList))
    : []

  // Resolve player ids → display names (roster + any ids referenced in matches).
  const extraIds = new Set<string>()
  for (const p of pairingRows) if (p.playerId) extraIds.add(p.playerId)
  for (const m of matchRows) {
    for (const arr of [m.homePlayerIds, m.awayPlayerIds]) {
      if (Array.isArray(arr)) for (const id of arr as number[]) if (typeof id === "number") extraIds.add(id)
    }
  }
  const nameRows = extraIds.size
    ? await db
        .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
        .from(user)
        .where(inArray(user.id, [...extraIds]))
    : []
  const nameById = new Map(nameRows.map((r) => [r.id, `${r.firstName} ${r.lastName}`]))

  // team|category → ordered player ids (from pairings).
  const lineupByTeamCat = new Map<string, number[]>()
  for (const p of pairingRows) {
    if (!p.playerId) continue
    const key = `${p.teamId}|${p.category}`
    const list = lineupByTeamCat.get(key) ?? []
    list.push(p.playerId)
    lineupByTeamCat.set(key, list)
  }
  const namesFor = (ids: number[]) => ids.map((id) => nameById.get(id)).filter((n): n is string => !!n)

  for (const f of fixtureRows) {
    const courtLinks = (f.courtLinks ?? {}) as Record<string, string>
    const fxMatches = matchRows.filter((m) => m.fixtureId === f.id)

    // Categories present: union of played rubbers and any lineup entries.
    const catNames = new Set<string>()
    for (const m of fxMatches) catNames.add(m.category)
    for (const key of lineupByTeamCat.keys()) {
      const [tid, cat] = key.split("|")
      if (Number(tid) === f.homeTeamId || Number(tid) === f.awayTeamId) catNames.add(cat)
    }

    let myCategory: string | null = null
    const categories: FixtureCategoryDetail[] = [...catNames].map((category) => {
      const m = fxMatches.find((x) => x.category === category)
      const homeFromMatch = Array.isArray(m?.homePlayerIds) ? (m!.homePlayerIds as number[]) : []
      const awayFromMatch = Array.isArray(m?.awayPlayerIds) ? (m!.awayPlayerIds as number[]) : []
      const homeIds = homeFromMatch.length ? homeFromMatch : (lineupByTeamCat.get(`${f.homeTeamId}|${category}`) ?? [])
      const awayIds = awayFromMatch.length ? awayFromMatch : (lineupByTeamCat.get(`${f.awayTeamId}|${category}`) ?? [])

      const iAmHome = homeIds.includes(playerId)
      const iAmAway = awayIds.includes(playerId)
      const isMine = iAmHome || iAmAway
      if (isMine) myCategory = category

      const myIds = iAmHome ? homeIds : iAmAway ? awayIds : []
      const oppIds = iAmHome ? awayIds : iAmAway ? homeIds : []
      const partnerId = myIds.find((id) => id !== playerId) ?? null

      return {
        category,
        isFeatureCourt: m?.isFeatureCourt ?? false,
        courtLink: courtLinks[category] ?? null,
        homePlayers: namesFor(homeIds),
        awayPlayers: namesFor(awayIds),
        scoreDetail: m?.scoreDetail ?? null,
        homeSetsWon: m ? m.homeSetsWon : null,
        awaySetsWon: m ? m.awaySetsWon : null,
        winnerTeamId: m?.winnerTeamId ?? null,
        isMine,
        partner: partnerId != null ? (nameById.get(partnerId) ?? null) : null,
        opponents: namesFor(oppIds),
      }
    })

    // Stable order: feature court first, then alphabetical.
    categories.sort((a, b) => Number(b.isFeatureCourt) - Number(a.isFeatureCourt) || a.category.localeCompare(b.category))

    out.set(f.id, { fixtureId: f.id, myCategory, categories })
  }

  return out
}

export type OutstandingFee = {
  // "player" = an individual who must pay their own fee. "team" = a team whose
  // owner/manager agreed to fund the whole squad's fees.
  kind: "player" | "team"
  playerId: string
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
      playerId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      userId: user.id,
      teamId: teams.id,
      teamName: teams.name,
      seasonId: teams.seasonId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(user, eq(teamMembers.playerId, user.id))
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
      // Negative-team-id string keeps the row key unique and clearly non-player.
      playerId: String(-t.teamId),
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
  const noteRows = await db
    .select({
      kind: feeNotes.kind, teamId: feeNotes.teamId, playerId: feeNotes.playerId,
      note: feeNotes.note, lastReminderAt: feeNotes.lastReminderAt, reminderCount: feeNotes.reminderCount,
    })
    .from(feeNotes)
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
  /** The user id (same as userId since players are users) */
  playerId: string
  userId: string
  name: string
  firstName: string
  lastName: string
  gender: "male" | "female"
  currentLi: number
  playtomicRating: number | null
  playtomicUrl: string | null
  email: string | null
  phone: string | null
  teams: { teamId: number; teamName: string; divisionName: string | null }[]
}

/**
 * Returns the set of team ids a user is allowed to manage players for, derived
 * from their resolved access context.
 *  - league admins (league_management): null (no restriction — every team)
 *  - everyone else: their assigned teams (owner email / captaincy / manual)
 *    UNION every team homed at one of their assigned clubs.
 */
async function getScopedTeamIds(access: AccessContext): Promise<number[] | null> {
  if (access.isLeagueAdmin) return null

  const ids = new Set<number>(access.teamIds)

  // Teams homed at an assigned club are also in scope for club managers.
  if (access.clubIds.length) {
    const clubTeamRows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(inArray(teams.homeClubId, access.clubIds))
    for (const r of clubTeamRows) ids.add(r.id)
  }

  return [...ids]
}

/** Player ids a user may manage (used to authorise inline edits). */
export async function getManageablePlayerIds(access: AccessContext): Promise<Set<string>> {
  const players = await getManagedPlayers(access)
  return new Set(players.map((p) => p.playerId).filter((id): id is string => id != null))
}

/**
 * Team ids a user may manage, as a Set. null means "no restriction" (league
 * admin — every team). Used to authorise team-membership edits scoped to the
 * actor's own teams.
 */
export async function getScopedTeamIdSet(access: AccessContext): Promise<Set<number> | null> {
  const ids = await getScopedTeamIds(access)
  return ids === null ? null : new Set(ids)
}

/**
 * Players a user may manage, scoped by their access context. League admins see
 * EVERY user account — including those without a player profile yet (playerId
 * null) — so admins can find and edit/onboard anyone. Everyone else sees players
 * who belong to a team within their scope (assigned teams + teams homed at
 * assigned clubs). Includes contact details (email + phone), Playtomic rating,
 * League Index and Playtomic profile link.
 */
export async function getManagedPlayers(access: AccessContext): Promise<ManagedPlayer[]> {
  const scopedTeamIds = await getScopedTeamIds(access)
  // A non-admin with no teams in scope manages nobody.
  if (scopedTeamIds && scopedTeamIds.length === 0) return []

  let whereCondition
  if (scopedTeamIds === null) {
    // League admin: see every user (players AND admin-only accounts). Their real
    // League Index, Playtomic rating and team memberships pull through via the
    // joins below — so admins like Ruan show full data, not an empty placeholder.
    whereCondition = undefined
  } else {
    // Scoped admin/captain: only users who belong to a team within their scope.
    whereCondition = inArray(teams.id, scopedTeamIds)
  }

  const rows = await db
    .select({
      playerId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      currentLi: user.currentLi,
      playtomicRating: user.playtomicRating,
      playtomicUrl: user.playtomicUrl,
      userId: user.id,
      teamId: teams.id,
      teamName: teams.name,
      divisionName: divisions.name,
    })
    .from(user)
    .leftJoin(teamMembers, and(eq(teamMembers.playerId, user.id), eq(teamMembers.status, "active")))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(whereCondition)
    .orderBy(user.firstName, user.lastName)

  const byPlayer = new Map<string, ManagedPlayer & { userId: string }>()
  for (const r of rows) {
    let p = byPlayer.get(r.userId)
    if (!p) {
      p = {
        playerId: r.userId,
        name: `${r.firstName} ${r.lastName}`.trim(),
        firstName: r.firstName,
        lastName: r.lastName,
        gender: r.gender as "male" | "female",
        currentLi: r.currentLi,
        playtomicRating: r.playtomicRating,
        playtomicUrl: r.playtomicUrl,
        email: null,
        phone: null,
        userId: r.userId,
        teams: [],
      }
      byPlayer.set(r.userId, p)
    }
    if (r.teamId && !p.teams.some((t) => t.teamId === r.teamId)) {
      p.teams.push({ teamId: r.teamId, teamName: r.teamName ?? "—", divisionName: r.divisionName ?? null })
    }
  }

  let list = [...byPlayer.values()]

  // Restrict to the scoped teams for non-league admins. Such roles only ever see
  // players who actually belong to a team within their scope.
  if (scopedTeamIds) {
    const allowed = new Set(scopedTeamIds)
    list = list.filter((p) => p.teams.some((t) => allowed.has(t.teamId)))
  }

  // League admins also see user accounts that have NO player profile yet so they
  // can manage/onboard everyone. Append a profile-less entry for each such user.
  if (!scopedTeamIds) {
    const usersWithProfile = new Set(list.map((p) => p.userId))
    const allUsers = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .orderBy(user.name)
    for (const u of allUsers) {
      if (usersWithProfile.has(u.id)) continue
      const [firstName, ...rest] = (u.name ?? "").trim().split(/\s+/)
      list.push({
        playerId: u.id,
        name: (u.name ?? "").trim() || "Unnamed user",
        firstName: firstName ?? "",
        lastName: rest.join(" "),
        gender: "male",
        currentLi: 0,
        playtomicRating: null,
        playtomicUrl: null,
        email: null,
        phone: null,
        userId: u.id,
        teams: [],
      })
    }
  }

  // Attach contact details (email from auth user, phone from userMeta).
  const userIds = [...new Set(list.map((p) => p.userId))]
  if (userIds.length) {
    const emailRows = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, userIds))
    const phoneRows = await db
      .select({ userId: userMeta.userId, phone: userMeta.phone })
      .from(userMeta)
      .where(inArray(userMeta.userId, userIds))
    const emailMap = new Map(emailRows.map((r) => [r.id, r.email]))
    const phoneMap = new Map(phoneRows.map((r) => [r.userId, r.phone]))
    for (const p of list) {
      p.email = emailMap.get(p.userId) ?? null
      p.phone = phoneMap.get(p.userId) ?? null
    }
  }

  // Sort by name for a stable, alphabetical listing (profile-less users mixed in).
  list.sort((a, b) => a.name.localeCompare(b.name))

  return list
}

export async function getTeamsForCaptain(userId: string) {
  return db.select({
    id: teams.id,
    name: teams.name,
    seasonId: teams.seasonId,
    organisationId: teams.organisationId,
    captainUserId: teams.captainUserId,
  }).from(teams).where(eq(teams.captainUserId, userId)).orderBy(teams.name)
}

export type TeamRosterMember = {
  membership: typeof teamMembers.$inferSelect
  player: typeof user.$inferSelect
}

export async function getTeamRoster(teamId: number): Promise<TeamRosterMember[]> {
  const rows = await db
    .select({
      membership: {
        id: teamMembers.id, teamId: teamMembers.teamId, playerId: teamMembers.playerId,
        status: teamMembers.status, role: teamMembers.role,
      },
      player: {
        id: user.id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, currentLi: user.currentLi, highestLi: user.highestLi,
        playtomicRating: user.playtomicRating, playtomicUrl: user.playtomicUrl,
        gender: user.gender, avatarUrl: user.avatarUrl, isPlayer: user.isPlayer,
      },
      meta: {
        role: userMeta.role, phone: userMeta.phone,
      },
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.playerId, user.id))
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    // Exclude players who have been removed from the roster — only active and
    // invited memberships should appear in the Captain Hub.
    .where(and(eq(teamMembers.teamId, teamId), ne(teamMembers.status, "removed")))
    .orderBy(desc(user.currentLi))
  return rows as unknown as TeamRosterMember[]
}

/**
 * Players who can be made captain of a team: everyone NOT currently on an active
 * roster of any team. The selected team's own squad is added separately by the
 * caller, so this returns the pool of genuinely available players (not already
 * committed to another team).
 */
export async function getUnassignedPlayers(
  limit = 500,
): Promise<{ playerId: string; name: string; li: number }[]> {
  const activeRows = await db
    .select({ playerId: teamMembers.playerId })
    .from(teamMembers)
    .where(eq(teamMembers.status, "active"))
  const taken = new Set(activeRows.map((r) => r.playerId))

  const all = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      currentLi: user.currentLi,
    })
    .from(user)
    .orderBy(user.firstName, user.lastName)
    .limit(limit)

  return all
    .filter((p) => !taken.has(p.id))
    .map((p) => ({ playerId: p.id, name: `${p.firstName} ${p.lastName}`, li: p.currentLi }))
}

export async function getTeamFixtures(teamId: number) {
  const rows = await db
    .select({
      id: fixtures.id, week: fixtures.week, matchDate: fixtures.matchDate,
      homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId,
      status: fixtures.status, divisionId: fixtures.divisionId,
      homePoints: fixtures.homePoints, awayPoints: fixtures.awayPoints,
      homeSetsWon: fixtures.homeSetsWon, awaySetsWon: fixtures.awaySetsWon,
      timeslot: fixtures.timeslot, venue: fixtures.venue,
    })
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
  return db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
      session: categories.session,
      isFeatureCourt: categories.isFeatureCourt,
    })
    .from(categories)
    .orderBy(categories.sortOrder)
}

// Per-category set scores for a set of fixtures, used to pre-fill result edits.
export async function getFixtureScores(fixtureIds: number[]) {
  const map: Record<number, Record<string, { home: number; away: number }[]>> = {}
  if (fixtureIds.length === 0) return map
  const rows = await db
    .select({
      fixtureId: matches.fixtureId, category: matches.category,
      scoreDetail: matches.scoreDetail, homeSetsWon: matches.homeSetsWon, awaySetsWon: matches.awaySetsWon,
    })
    .from(matches)
    .where(inArray(matches.fixtureId, fixtureIds))
  for (const m of rows) {
    if (!map[m.fixtureId]) map[m.fixtureId] = {}
    const sets = parseScoreDetail(m.scoreDetail)
    // Fall back to a single synthetic set if no detail was stored (legacy rows).
    map[m.fixtureId][m.category] = sets.length > 0 ? sets : [{ home: m.homeSetsWon, away: m.awaySetsWon }]
  }
  return map
}

export async function getDivisionTeams(divisionId: number) {
  return db.select({ id: teams.id }).from(teams).where(eq(teams.divisionId, divisionId)).orderBy(teams.name)
}

// Free agents (marketplace) for captain invitations
export async function getFreeAgents(limit = 50) {
  return db
    .select({
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      currentLi: user.currentLi, playtomicRating: user.playtomicRating,
      gender: user.gender, city: user.city, email: user.email,
    })
    .from(user)
    .where(eq(user.lookingForTeam, true))
    .orderBy(desc(user.currentLi))
    .limit(limit)
}

export type AddablePlayer = {
  id: string
  firstName: string
  lastName: string
  currentLi: number
  city: string | null
  email: string | null
}

/**
 * Every existing player a captain/club manager can add to a roster — not just
 * free agents. Includes the auth email so the Captain Hub search can match on
 * name OR email (the season/roster conflict checks still run on add). Ordered
 * by name so the picker reads alphabetically.
 */
export async function getAddablePlayers(limit = 500): Promise<AddablePlayer[]> {
  const rows = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      currentLi: user.currentLi,
      city: user.city,
      userId: user.id,
    })
    .from(user)
    .orderBy(user.firstName, user.lastName)
    .limit(limit)

  const userIds = [...new Set(rows.map((r) => r.userId))]
  const emailRows = userIds.length
    ? await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, userIds))
    : []
  const emailMap = new Map(emailRows.map((r) => [r.id, r.email]))

  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    currentLi: r.currentLi,
    city: r.city,
    email: emailMap.get(r.userId) ?? null,
  }))
}

// Org admin helpers ---------------------------------------------------------

export async function getOrgByOwner(userId: string) {
  const [o] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.ownerUserId, userId)).limit(1)
  return o ?? null
}

// Shared team+division field shape used by all three team-row queries below.
const teamRowFields = {
  team: {
    id: teams.id,
    name: teams.name,
    divisionId: teams.divisionId,
    seasonId: teams.seasonId,
    organisationId: teams.organisationId,
    captainUserId: teams.captainUserId,
    homeClubId: teams.homeClubId,
    teamType: teams.teamType,
    clubPaysFees: teams.clubPaysFees,
    managerUserId: teams.managerUserId,
    ownerEmail: teams.ownerEmail,
    avgLi: teams.avgLi,
    tpr: teams.tpr,
    playerCount: teams.playerCount,
    maxPlayers: teams.maxPlayers,
    saplRegion: teams.saplRegion,
  },
  division: {
    id: divisions.id,
    name: divisions.name,
    level: divisions.level,
    seasonId: divisions.seasonId,
  },
}

export async function getOrgTeams(orgId: number) {
  return db
    .select(teamRowFields)
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(eq(teams.organisationId, orgId))
    .orderBy(teams.name)
}

// League/super admins manage every team, not just one org's. Returns the same
// shape as getOrgTeams so the Team Admin page can render either set.
export async function getAllTeamsForAdmin() {
  return db
    .select(teamRowFields)
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .orderBy(teams.name)
}

// Teams a club manager may manage in Team Admin: every team within their access
// scope (assigned teams via owner email / captaincy / manual, UNION every team
// homed at one of their assigned clubs). Returns the same { team, division }
// shape as getOrgTeams so the Team Admin page can render it the same way.
export async function getScopedTeamRows(access: AccessContext) {
  const scopedTeamIds = await getScopedTeamIds(access)
  // null means "no restriction" (league admin) — callers handle that separately.
  if (scopedTeamIds === null) return getAllTeamsForAdmin()
  if (scopedTeamIds.length === 0) return []
  return db
    .select(teamRowFields)
    .from(teams)
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .where(inArray(teams.id, scopedTeamIds))
    .orderBy(teams.name)
}

export async function getStandingForTeam(teamId: number) {
  const [s] = await db
    .select({
      id: standings.id,
      played: standings.played,
      wins: standings.wins,
      points: standings.points,
      rank: standings.rank,
    })
    .from(standings)
    .where(eq(standings.teamId, teamId))
    .limit(1)
  return s ?? null
}

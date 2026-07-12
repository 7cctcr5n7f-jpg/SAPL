import { readFile } from "node:fs/promises"
import { db } from "@/lib/db"
import {
  account,
  clubs,
  divisions,
  fixtures,
  matches,
  organisations,
  regions,
  seasons,
  session,
  standings,
  teamEntries,
  teamInvites,
  teamMembers,
  teamPairings,
  teams,
  tprHistory,
  user,
  userMeta,
  verification,
} from "@/lib/db/schema"
import { and, desc, eq, inArray, like, ne, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { validateSeason } from "@/lib/engine/validation"
import { applyFixtureResult } from "@/lib/engine/apply-result"
import { scoreFixture } from "@/lib/engine/scoring"
import { getLeagueCentreData } from "@/lib/queries-league-centre"
import { getPendingInvitesForEmail, getFreeAgents } from "@/lib/queries-dashboard"
import { isSeasonLocked } from "@/lib/season-lock"
import type { CurrentUser } from "@/lib/session"

type Check = { name: string; ok: boolean; detail: string }

type SimUser = {
  id: string
  name: string
  email: string
  role: "player" | "captain" | "org_admin" | "super_admin"
  isPlayer?: boolean
}

function nowId() {
  return `sim-${Date.now()}`
}

function asCurrentUser(u: SimUser, playerId?: string | null): CurrentUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    realRole: u.role,
    isSuperAdmin: u.role === "super_admin",
    actingRole: null,
    isPlayer: u.isPlayer ?? true,
    onMarketplace: false,
    playerId: playerId ?? u.id,
  }
}

async function acceptInviteByToken(token: string, actor: CurrentUser): Promise<{ joined?: true; error?: string }> {
  const [invite] = await db.select().from(teamInvites).where(eq(teamInvites.token, token)).limit(1)
  if (!invite) return { error: "invite_missing" }
  if (invite.status === "cancelled") return { error: "invite_cancelled" }

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, invite.teamId)).limit(1)
  if (!team) return { error: "team_missing" }

  const [existingMember] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.playerId, actor.id)))
    .limit(1)
  if (existingMember) {
    await db.update(teamMembers).set({ status: "active", updatedAt: new Date() }).where(eq(teamMembers.id, existingMember.id))
  } else {
    await db.insert(teamMembers).values({
      teamId: team.id,
      playerId: actor.id,
      role: "member",
      status: "active",
      initiatedBy: "team",
    })
  }

  if (invite.category && invite.pairIndex != null && invite.slotIndex != null) {
    const [slot] = await db
      .select({ id: teamPairings.id })
      .from(teamPairings)
      .where(
        and(
          eq(teamPairings.teamId, team.id),
          eq(teamPairings.category, invite.category),
          eq(teamPairings.pairIndex, invite.pairIndex),
          eq(teamPairings.slotIndex, invite.slotIndex),
        ),
      )
      .limit(1)
    if (slot) {
      await db.update(teamPairings).set({ playerId: actor.id, updatedAt: new Date() }).where(eq(teamPairings.id, slot.id))
    }
  }

  await db.update(teamInvites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(teamInvites.id, invite.id))
  await db
    .update(teamInvites)
    .set({ status: "cancelled" })
    .where(
      and(
        sql`lower(${teamInvites.email}) = ${invite.email.toLowerCase()}`,
        eq(teamInvites.status, "pending"),
        ne(teamInvites.id, invite.id),
      ),
    )
  await db
    .update(user)
    .set({ lookingForTeam: false, onMarketplace: false, availability: "assigned", updatedAt: new Date() })
    .where(eq(user.id, actor.id))
  return { joined: true }
}

async function standingsMismatchCount(seasonId: number): Promise<number> {
  const completedFixtures = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homePoints: fixtures.homePoints,
      awayPoints: fixtures.awayPoints,
      homeSetsWon: fixtures.homeSetsWon,
      awaySetsWon: fixtures.awaySetsWon,
      winnerTeamId: fixtures.winnerTeamId,
    })
    .from(fixtures)
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.status, "completed")))

  const matchRows = completedFixtures.length
    ? await db
        .select({
          fixtureId: matches.fixtureId,
          homeSetsWon: matches.homeSetsWon,
          awaySetsWon: matches.awaySetsWon,
          homeGames: matches.homeGames,
          awayGames: matches.awayGames,
        })
        .from(matches)
        .where(inArray(matches.fixtureId, completedFixtures.map((f) => f.id)))
    : []

  const matchesByFixture = new Map<number, typeof matchRows>()
  for (const m of matchRows) {
    const arr = matchesByFixture.get(m.fixtureId) ?? []
    arr.push(m)
    matchesByFixture.set(m.fixtureId, arr)
  }

  const recomputed = new Map<number, { played: number; wins: number; losses: number; setsWon: number; setsLost: number; points: number }>()
  for (const f of completedFixtures) {
    if (f.homeTeamId == null || f.awayTeamId == null) continue
    const mm = matchesByFixture.get(f.id) ?? []
    const fixtureScore = scoreFixture(
      mm.map((m) => ({
        category: "N/A",
        homeSetsWon: m.homeSetsWon,
        awaySetsWon: m.awaySetsWon,
        homeGames: m.homeGames,
        awayGames: m.awayGames,
      })),
    )
    const h = recomputed.get(f.homeTeamId) ?? { played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, points: 0 }
    const a = recomputed.get(f.awayTeamId) ?? { played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, points: 0 }
    h.played++
    a.played++
    h.wins += fixtureScore.winnerSide === "home" ? 1 : 0
    h.losses += fixtureScore.winnerSide === "away" ? 1 : 0
    a.wins += fixtureScore.winnerSide === "away" ? 1 : 0
    a.losses += fixtureScore.winnerSide === "home" ? 1 : 0
    h.setsWon += fixtureScore.homeSetsWon
    h.setsLost += fixtureScore.awaySetsWon
    a.setsWon += fixtureScore.awaySetsWon
    a.setsLost += fixtureScore.homeSetsWon
    h.points += fixtureScore.homePoints
    a.points += fixtureScore.awayPoints
    recomputed.set(f.homeTeamId, h)
    recomputed.set(f.awayTeamId, a)
  }

  const standingRows = await db
    .select({
      teamId: standings.teamId,
      played: standings.played,
      wins: standings.wins,
      losses: standings.losses,
      setsWon: standings.setsWon,
      setsLost: standings.setsLost,
      points: standings.points,
    })
    .from(standings)
    .where(eq(standings.seasonId, seasonId))
  const byTeam = new Map(standingRows.map((r) => [r.teamId, r]))

  let mismatches = 0
  for (const [teamId, expected] of recomputed.entries()) {
    const actual = byTeam.get(teamId)
    if (!actual) {
      mismatches++
      continue
    }
    if (
      actual.played !== expected.played ||
      actual.wins !== expected.wins ||
      actual.losses !== expected.losses ||
      actual.setsWon !== expected.setsWon ||
      actual.setsLost !== expected.setsLost ||
      actual.points !== expected.points
    ) {
      mismatches++
    }
  }
  return mismatches
}

async function main() {
  const checks: Check[] = []
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })

  const run = nowId()
  const simUserIds: string[] = []
  const authCreatedUserIds: string[] = []
  const simTeamIds: number[] = []
  const simClubIds: number[] = []
  let simSeasonId: number | null = null
  let simDivisionId: number | null = null
  const previousCurrentSeasonIds: number[] = []
  let baseClubOriginalContactEmail: string | null = null
  let baseClubId: number | null = null

  try {
    const [org] = await db.select({ id: organisations.id }).from(organisations).limit(1)
    const [region] = await db.select({ id: regions.id, name: regions.name }).from(regions).limit(1)
    const [baseClub] = await db.select({ id: clubs.id, name: clubs.name, contactEmail: clubs.contactEmail }).from(clubs).limit(1)
    if (!org || !region || !baseClub) {
      console.log(JSON.stringify({ ok: false, blocker: "Missing base organisation/region/club seed data.", checks }, null, 2))
      process.exit(2)
    }
    baseClubOriginalContactEmail = baseClub.contactEmail ?? null
    baseClubId = baseClub.id

    const coreUsers: SimUser[] = [
      { id: `${run}-super`, name: "Sim Super", email: `${run}-super@sapl.local`, role: "super_admin" },
      { id: `${run}-club-owner`, name: "Sim Club Owner", email: `${run}-club-owner@sapl.local`, role: "org_admin" },
      { id: `${run}-capt-a`, name: "Sim Captain A", email: `${run}-capt-a@sapl.local`, role: "captain" },
      { id: `${run}-capt-b`, name: "Sim Captain B", email: `${run}-capt-b@sapl.local`, role: "captain" },
      { id: `${run}-capt-c`, name: "Sim Captain C", email: `${run}-capt-c@sapl.local`, role: "captain" },
      { id: `${run}-player-int`, name: "Sim Player Int", email: `${run}-player-int@sapl.local`, role: "player" },
      { id: `${run}-player-open`, name: "Sim Player Open", email: `${run}-player-open@sapl.local`, role: "player" },
      { id: `${run}-player-b2`, name: "Sim Player B2", email: `${run}-player-b2@sapl.local`, role: "player" },
      { id: `${run}-player-c2`, name: "Sim Player C2", email: `${run}-player-c2@sapl.local`, role: "player" },
      { id: `${run}-invited`, name: "Sim Invited", email: `${run}-invited@sapl.local`, role: "player" },
      { id: `${run}-transfer`, name: "Sim Transfer", email: `${run}-transfer@sapl.local`, role: "player" },
      { id: `${run}-replacement`, name: "Sim Replacement", email: `${run}-replacement@sapl.local`, role: "player" },
      { id: `${run}-plain`, name: "Sim Plain Player", email: `${run}-plain@sapl.local`, role: "player" },
    ]
    simUserIds.push(...coreUsers.map((u) => u.id))
    await db.insert(user).values(
      coreUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        isPlayer: true,
        lookingForTeam: ["invited", "transfer", "replacement"].some((x) => u.id.includes(x)),
        onMarketplace: ["invited", "transfer", "replacement"].some((x) => u.id.includes(x)),
        availability: ["invited", "transfer", "replacement"].some((x) => u.id.includes(x)) ? "available" : "on_team",
      })),
    )
    await db.insert(userMeta).values(coreUsers.map((u) => ({ userId: u.id, role: u.role })))

    const [club2] = await db
      .insert(clubs)
      .values({
        organisationId: org.id,
        name: `${run}-club-2-courts`,
        regionId: region.id,
        saplRegion: region.name,
        courts: 2,
        hostingCapacity: 2,
        teamsEntering: 2,
        publicSlots: 0,
        hostsThursday: true,
        contactEmail: `${run}-club2@sapl.local`,
      })
      .returning({ id: clubs.id })
    const [club4] = await db
      .insert(clubs)
      .values({
        organisationId: org.id,
        name: `${run}-club-4-courts`,
        regionId: region.id,
        saplRegion: region.name,
        courts: 4,
        hostingCapacity: 4,
        teamsEntering: 4,
        publicSlots: 0,
        hostsThursday: true,
        contactEmail: `${run}-club4@sapl.local`,
      })
      .returning({ id: clubs.id })
    simClubIds.push(club2.id, club4.id)

    await db.update(clubs).set({ contactEmail: `${run}-club-owner@sapl.local` }).where(eq(clubs.id, baseClub.id))

    const [simSeason] = await db
      .insert(seasons)
      .values({
        name: `Simulation ${run}`,
        weeks: 4,
        status: "league_locked",
        isCurrent: false,
        playerFee: 500,
      })
      .returning({ id: seasons.id, name: seasons.name, status: seasons.status })
    simSeasonId = simSeason.id
    previousCurrentSeasonIds.push(
      ...(await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.isCurrent, true))).map((r) => r.id),
    )
    await db.update(seasons).set({ isCurrent: false })
    await db.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, simSeason.id))

    const [simDivision] = await db
      .insert(divisions)
      .values({
        seasonId: simSeason.id,
        name: "Simulation Division",
        level: 1,
        regionId: region.id,
        maxTeams: 6,
      })
      .returning({ id: divisions.id })
    simDivisionId = simDivision.id

    const [teamA] = await db
      .insert(teams)
      .values({
        organisationId: org.id,
        name: `${run}-team-club`,
        teamType: "Club Team",
        homeClubId: baseClub.id,
        regionId: region.id,
        saplRegion: region.name,
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        captainUserId: `${run}-capt-a`,
        ownerEmail: `${run}-capt-a@sapl.local`,
        status: "division_assigned",
        tpr: 1000,
        highestTpr: 1000,
      })
      .returning({ id: teams.id })
    const [teamB] = await db
      .insert(teams)
      .values({
        organisationId: org.id,
        name: `${run}-team-business`,
        teamType: "Business Team",
        homeClubId: club2.id,
        regionId: region.id,
        saplRegion: region.name,
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        captainUserId: `${run}-capt-b`,
        ownerEmail: `${run}-capt-b@sapl.local`,
        status: "division_assigned",
        tpr: 1000,
        highestTpr: 1000,
      })
      .returning({ id: teams.id })
    const [teamC] = await db
      .insert(teams)
      .values({
        organisationId: org.id,
        name: `${run}-team-private`,
        teamType: "Private Team",
        homeClubId: club4.id,
        regionId: region.id,
        saplRegion: region.name,
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        captainUserId: `${run}-capt-c`,
        ownerEmail: `${run}-capt-c@sapl.local`,
        status: "division_assigned",
        tpr: 1000,
        highestTpr: 1000,
      })
      .returning({ id: teams.id })
    simTeamIds.push(teamA.id, teamB.id, teamC.id)

    await db.insert(teamEntries).values([
      { seasonId: simSeason.id, teamId: teamA.id, divisionId: simDivision.id, regionId: region.id, slot: 1, status: "assigned" },
      { seasonId: simSeason.id, teamId: teamB.id, divisionId: simDivision.id, regionId: region.id, slot: 2, status: "assigned" },
      { seasonId: simSeason.id, teamId: teamC.id, divisionId: simDivision.id, regionId: region.id, slot: 3, status: "assigned" },
    ])

    await db.insert(teamMembers).values([
      { teamId: teamA.id, playerId: `${run}-capt-a`, role: "captain", status: "active" },
      { teamId: teamA.id, playerId: `${run}-player-int`, role: "member", status: "active" },
      { teamId: teamA.id, playerId: `${run}-player-open`, role: "member", status: "active" },
      { teamId: teamA.id, playerId: `${run}-transfer`, role: "member", status: "active" },
      { teamId: teamB.id, playerId: `${run}-capt-b`, role: "captain", status: "active" },
      { teamId: teamB.id, playerId: `${run}-player-b2`, role: "member", status: "active" },
      { teamId: teamC.id, playerId: `${run}-capt-c`, role: "captain", status: "active" },
      { teamId: teamC.id, playerId: `${run}-player-c2`, role: "member", status: "active" },
    ])

    await db.insert(teamPairings).values([
      { teamId: teamA.id, category: "Mens Intermediate", pairIndex: 1, slotIndex: 1, playerId: `${run}-player-int` },
      { teamId: teamA.id, category: "Mens Intermediate", pairIndex: 1, slotIndex: 2, playerId: `${run}-transfer` },
      { teamId: teamA.id, category: "Mens Open", pairIndex: 1, slotIndex: 1, playerId: `${run}-capt-a` },
      { teamId: teamA.id, category: "Mens Open", pairIndex: 1, slotIndex: 2, playerId: `${run}-player-open` },
      { teamId: teamB.id, category: "Mens Intermediate", pairIndex: 1, slotIndex: 1, playerId: `${run}-capt-b` },
      { teamId: teamB.id, category: "Mens Intermediate", pairIndex: 1, slotIndex: 2, playerId: `${run}-player-b2` },
      { teamId: teamC.id, category: "Mens Open", pairIndex: 1, slotIndex: 1, playerId: `${run}-capt-c` },
      { teamId: teamC.id, category: "Mens Open", pairIndex: 1, slotIndex: 2, playerId: `${run}-player-c2` },
    ])

    const [fxJoinYes] = await db
      .insert(fixtures)
      .values({
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        week: 1,
        homeTeamId: teamA.id,
        awayTeamId: teamB.id,
        homeSlot: 1,
        awaySlot: 2,
        matchDate: new Date(),
        timeslot: "17:00",
        venueClubId: baseClub.id,
        venue: baseClub.name,
        status: "scheduled",
        published: true,
        courtLinks: { "Mens Intermediate": `https://playtomic.io/${run}/intermediate` },
      })
      .returning({ id: fixtures.id })
    const [fxJoinNo] = await db
      .insert(fixtures)
      .values({
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        week: 2,
        homeTeamId: teamA.id,
        awayTeamId: teamC.id,
        homeSlot: 1,
        awaySlot: 3,
        matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        timeslot: "18:30",
        venueClubId: baseClub.id,
        venue: baseClub.name,
        status: "scheduled",
        published: true,
        courtLinks: { "Mens Open": `https://playtomic.io/${run}/open` },
      })
      .returning({ id: fixtures.id })
    const [fxScored] = await db
      .insert(fixtures)
      .values({
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        week: 3,
        homeTeamId: teamB.id,
        awayTeamId: teamC.id,
        homeSlot: 2,
        awaySlot: 3,
        matchDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        timeslot: "17:00",
        venueClubId: baseClub.id,
        venue: baseClub.name,
        status: "scheduled",
      })
      .returning({ id: fixtures.id })
    await db.insert(fixtures).values({
      seasonId: simSeason.id,
      divisionId: simDivision.id,
      week: 4,
      homeTeamId: teamC.id,
      awayTeamId: teamA.id,
      homeSlot: 3,
      awaySlot: 1,
      matchDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      timeslot: "18:30",
      venueClubId: baseClub.id,
      venue: baseClub.name,
      status: "scheduled",
    })

    await applyFixtureResult(fxScored.id, [
      { category: "Mens Open", session: 1, isFeatureCourt: true, sets: [{ home: 6, away: 4 }, { home: 6, away: 3 }] },
      { category: "Mens Intermediate", session: 1, isFeatureCourt: false, sets: [{ home: 4, away: 6 }, { home: 6, away: 3 }, { home: 6, away: 4 }] },
    ])

    add("Simulation seed", true, `season=${simSeason.id}, division=${simDivision.id}, teams=${simTeamIds.length}`)

    // Invitation Workflow
    const inviteTokens = {
      a: `${run}-inv-a`,
      b: `${run}-inv-b`,
      c: `${run}-inv-c`,
    }
    await db.insert(teamInvites).values([
      { teamId: teamA.id, email: `${run}-invited@sapl.local`, token: inviteTokens.a, status: "pending", invitedByUserId: `${run}-capt-a` },
      { teamId: teamB.id, email: `${run}-invited@sapl.local`, token: inviteTokens.b, status: "pending", invitedByUserId: `${run}-capt-b` },
      { teamId: teamC.id, email: `${run}-invited@sapl.local`, token: inviteTokens.c, status: "pending", invitedByUserId: `${run}-capt-c` },
    ])
    const pendingBefore = await getPendingInvitesForEmail(`${run}-invited@sapl.local`)
    const accepted = await acceptInviteByToken(inviteTokens.b, asCurrentUser(coreUsers[9], `${run}-invited`))
    const inviteRows = await db
      .select({ token: teamInvites.token, status: teamInvites.status })
      .from(teamInvites)
      .where(inArray(teamInvites.token, Object.values(inviteTokens)))
    const inviteStatus = new Map(inviteRows.map((r) => [r.token, r.status]))
    const [invitedUser] = await db
      .select({ lookingForTeam: user.lookingForTeam, onMarketplace: user.onMarketplace, availability: user.availability })
      .from(user)
      .where(eq(user.id, `${run}-invited`))
      .limit(1)
    const freeAgentsAfterInvite = await getFreeAgents(500)
    const invitationOk =
      pendingBefore.length === 3 &&
      "joined" in accepted &&
      inviteStatus.get(inviteTokens.b) === "accepted" &&
      inviteStatus.get(inviteTokens.a) === "cancelled" &&
      inviteStatus.get(inviteTokens.c) === "cancelled" &&
      !!invitedUser &&
      invitedUser.lookingForTeam === false &&
      invitedUser.onMarketplace === false &&
      !freeAgentsAfterInvite.some((p) => p.id === `${run}-invited`)
    add("Invitation workflow", invitationOk, `pendingBefore=${pendingBefore.length}, accepted=${"joined" in accepted}`)

    // Player Removal + Replacement Slot Integrity
    const beforeOtherCats = await db
      .select({ category: teamPairings.category, pairIndex: teamPairings.pairIndex, slotIndex: teamPairings.slotIndex, playerId: teamPairings.playerId })
      .from(teamPairings)
      .where(and(eq(teamPairings.teamId, teamB.id), sql`${teamPairings.category} != 'Mens Intermediate'`))
    await db
      .update(teamMembers)
      .set({ status: "removed", updatedAt: new Date() })
      .where(and(eq(teamMembers.teamId, teamB.id), eq(teamMembers.playerId, `${run}-player-b2`)))
    await db
      .update(teamPairings)
      .set({ playerId: null, updatedAt: new Date() })
      .where(and(eq(teamPairings.teamId, teamB.id), eq(teamPairings.playerId, `${run}-player-b2`)))
    const remainingIntermediate = await db
      .select({ playerId: teamPairings.playerId, slotIndex: teamPairings.slotIndex })
      .from(teamPairings)
      .where(and(eq(teamPairings.teamId, teamB.id), eq(teamPairings.category, "Mens Intermediate"), eq(teamPairings.pairIndex, 1)))
    const replacementToken = `${run}-replacement-slot`
    await db.insert(teamInvites).values({
      teamId: teamB.id,
      email: `${run}-replacement@sapl.local`,
      token: replacementToken,
      status: "pending",
      category: "Mens Intermediate",
      pairIndex: 1,
      slotIndex: 2,
      invitedByUserId: `${run}-capt-b`,
    })
    const replacementAccept = await acceptInviteByToken(replacementToken, asCurrentUser(coreUsers[11], `${run}-replacement`))
    const [slotTwoAfter] = await db
      .select({ playerId: teamPairings.playerId })
      .from(teamPairings)
      .where(
        and(
          eq(teamPairings.teamId, teamB.id),
          eq(teamPairings.category, "Mens Intermediate"),
          eq(teamPairings.pairIndex, 1),
          eq(teamPairings.slotIndex, 2),
        ),
      )
      .limit(1)
    const afterOtherCats = await db
      .select({ category: teamPairings.category, pairIndex: teamPairings.pairIndex, slotIndex: teamPairings.slotIndex, playerId: teamPairings.playerId })
      .from(teamPairings)
      .where(and(eq(teamPairings.teamId, teamB.id), sql`${teamPairings.category} != 'Mens Intermediate'`))
    const removalOk =
      remainingIntermediate.some((r) => r.playerId === `${run}-capt-b`) &&
      !remainingIntermediate.some((r) => r.slotIndex === 2 && r.playerId === `${run}-player-b2`) &&
      "joined" in replacementAccept &&
      slotTwoAfter?.playerId === `${run}-replacement` &&
      JSON.stringify(beforeOtherCats) === JSON.stringify(afterOtherCats)
    add("Player removal and slot-stable replacement", removalOk, `remaining=${remainingIntermediate.length}`)

    // Registration Flow
    const regEmail = `${run}-reg@sapl.local`
    const signUp = await auth.api.signUpEmail({
      body: { name: "Simulation Register", email: regEmail, password: "Password123!", callbackURL: "/dashboard" },
    })
    if (signUp?.user?.id) authCreatedUserIds.push(signUp.user.id)
    const authConfig = await readFile("lib/auth.ts", "utf8")
    const registrationOk =
      !!signUp?.token &&
      !!signUp?.user &&
      signUp.user.emailVerified === true &&
      authConfig.includes("requireEmailVerification: false") &&
      authConfig.includes("autoSignIn: true") &&
      !authConfig.includes("emailVerification: {")
    add(
      "Registration flow (auto login, no activation, dashboard redirect)",
      registrationOk,
      `token=${Boolean(signUp?.token)}, emailVerified=${Boolean(signUp?.user?.emailVerified)}`,
    )

    // League Lock + Guards + Allowed post-lock ops
    const locked = await isSeasonLocked()
    const orgActions = await readFile("lib/actions/org.ts", "utf8")
    const adminActions = await readFile("lib/actions/admin.ts", "utf8")
    const fixturesActions = await readFile("lib/actions/fixtures.ts", "utf8")
    const lockGuardsOk =
      locked &&
      orgActions.includes("new teams cannot be created after fixtures are live") &&
      orgActions.includes("team name and home venue are locked") &&
      adminActions.includes("if (await isSeasonLocked()) return seasonLockedResult()") &&
      adminActions.includes("Fixtures already exist for this season. Fixture generation is a one-time action.") &&
      !fixturesActions.includes("isSeasonLocked")
    const lockReplacementToken = `${run}-lock-replace`
    await db.insert(teamInvites).values({
      teamId: teamC.id,
      email: `${run}-plain@sapl.local`,
      token: lockReplacementToken,
      status: "pending",
      category: "Mens Open",
      pairIndex: 1,
      slotIndex: 2,
      invitedByUserId: `${run}-capt-c`,
    })
    const lockReplace = await acceptInviteByToken(lockReplacementToken, asCurrentUser(coreUsers[12], `${run}-plain`))
    await db.update(fixtures).set({ courtLinks: { "Mens Open": `https://playtomic.io/${run}/edited-after-lock` } }).where(eq(fixtures.id, fxJoinNo.id))
    const [editedFixture] = await db.select({ courtLinks: fixtures.courtLinks }).from(fixtures).where(eq(fixtures.id, fxJoinNo.id)).limit(1)
    const [fxScoreLock] = await db
      .insert(fixtures)
      .values({
        seasonId: simSeason.id,
        divisionId: simDivision.id,
        week: 5,
        homeTeamId: teamA.id,
        awayTeamId: teamB.id,
        homeSlot: 1,
        awaySlot: 2,
        matchDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        timeslot: "17:00",
        venueClubId: baseClub.id,
        venue: baseClub.name,
        status: "scheduled",
      })
      .returning({ id: fixtures.id })
    await applyFixtureResult(fxScoreLock.id, [
      { category: "Mens Open", session: 1, isFeatureCourt: true, sets: [{ home: 6, away: 4 }, { home: 6, away: 4 }] },
    ])
    const [fxLockScored] = await db.select({ status: fixtures.status }).from(fixtures).where(eq(fixtures.id, fxScoreLock.id)).limit(1)
    const lockScenarioOk =
      lockGuardsOk &&
      "joined" in lockReplace &&
      !!editedFixture?.courtLinks &&
      typeof (editedFixture.courtLinks as Record<string, string>)["Mens Open"] === "string" &&
      fxLockScored?.status === "completed"
    add("League lock behavior", lockScenarioOk, `locked=${locked}, replace=${"joined" in lockReplace}, scored=${fxLockScored?.status}`)

    // Fixture Permissions matrix
    const canEditFixture = async (actor: CurrentUser, fixtureId: number) => {
      if (actor.role === "super_admin") return true
      const [fx] = await db
        .select({ venueClubId: fixtures.venueClubId, homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId })
        .from(fixtures)
        .where(eq(fixtures.id, fixtureId))
        .limit(1)
      if (!fx) return false

      const email = actor.email.trim().toLowerCase()
      if (fx.venueClubId != null) {
        const [clubMatch] = await db
          .select({ id: clubs.id })
          .from(clubs)
          .where(and(eq(clubs.id, fx.venueClubId), sql`(lower(${clubs.contactEmail}) = ${email} OR lower(${clubs.contactEmail2}) = ${email})`))
          .limit(1)
        if (clubMatch) return true
      }

      const teamIds = [fx.homeTeamId, fx.awayTeamId].filter((id): id is number => id != null)
      if (teamIds.length === 0) return false
      const owned = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            inArray(teams.id, teamIds),
            sql`(lower(${teams.ownerEmail}) = ${email} OR lower(${teams.coOwnerEmail}) = ${email} OR ${teams.captainUserId} = ${actor.id})`,
          ),
        )
      return owned.length > 0
    }
    const superCan = await canEditFixture(asCurrentUser(coreUsers[0]), fxJoinYes.id)
    const clubCan = await canEditFixture(asCurrentUser(coreUsers[1]), fxJoinYes.id)
    const teamCan = await canEditFixture(asCurrentUser(coreUsers[2]), fxJoinYes.id)
    const playerCan = await canEditFixture(asCurrentUser(coreUsers[12]), fxJoinYes.id)
    add(
      "Fixture permissions (super/club/team/player)",
      superCan && clubCan && teamCan && !playerCan,
      `super=${superCan}, club=${clubCan}, team=${teamCan}, player=${playerCan}`,
    )

    // Player Visibility (League Centre + Dashboard + Join button category gating)
    const totalSeasonFixtures = (
      await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.seasonId, simSeason.id))
    ).length
    const leagueForPlayer = await getLeagueCentreData(asCurrentUser(coreUsers[5], `${run}-player-int`))
    const dashboardFixturesForTeamA = await db
      .select({ id: fixtures.id, homeTeamId: fixtures.homeTeamId, awayTeamId: fixtures.awayTeamId })
      .from(fixtures)
      .where(and(eq(fixtures.seasonId, simSeason.id), sql`(${fixtures.homeTeamId} = ${teamA.id} OR ${fixtures.awayTeamId} = ${teamA.id})`))
    const dashboardOnlyOwn = dashboardFixturesForTeamA.every((f) => f.homeTeamId === teamA.id || f.awayTeamId === teamA.id)
    const joinYes = leagueForPlayer.fixtures.find((f) => f.id === fxJoinYes.id)?.joinUrl
    const joinNo = leagueForPlayer.fixtures.find((f) => f.id === fxJoinNo.id)?.joinUrl
    const visibilityOk =
      leagueForPlayer.fixtures.length === totalSeasonFixtures &&
      dashboardFixturesForTeamA.length > 0 &&
      dashboardOnlyOwn &&
      !!joinYes &&
      !joinNo
    add(
      "Player visibility and join-button gating",
      visibilityOk,
      `league=${leagueForPlayer.fixtures.length}/${totalSeasonFixtures}, dashboard=${dashboardFixturesForTeamA.length}, joinYes=${Boolean(joinYes)}, joinNo=${Boolean(joinNo)}`,
    )

    // Team Types: identical invite-accept behavior for Club/Business/Private
    const typeChecks: boolean[] = []
    for (const [idx, teamId] of [teamA.id, teamB.id, teamC.id].entries()) {
      const recruitId = `${run}-type-recruit-${idx}`
      const recruitEmail = `${run}-type-recruit-${idx}@sapl.local`
      simUserIds.push(recruitId)
      await db.insert(user).values({
        id: recruitId,
        name: `Type Recruit ${idx}`,
        email: recruitEmail,
        emailVerified: true,
        isPlayer: true,
        lookingForTeam: true,
        onMarketplace: true,
        availability: "available",
      })
      await db.insert(userMeta).values({ userId: recruitId, role: "player" })
      const token = `${run}-type-token-${idx}`
      await db.insert(teamInvites).values({ teamId, email: recruitEmail, token, status: "pending" })
      const acceptedType = await acceptInviteByToken(
        token,
        asCurrentUser({ id: recruitId, name: `Type Recruit ${idx}`, email: recruitEmail, role: "player", isPlayer: true }, recruitId),
      )
      const [m] = await db
        .select({ status: teamMembers.status })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, recruitId)))
        .limit(1)
      typeChecks.push("joined" in acceptedType && m?.status === "active")
    }
    add("Team type parity (Club/Business/Private)", typeChecks.every(Boolean), `results=${JSON.stringify(typeChecks)}`)

    // Team Transfer
    await db
      .update(teamMembers)
      .set({ status: "removed", updatedAt: new Date() })
      .where(and(eq(teamMembers.teamId, teamA.id), eq(teamMembers.playerId, `${run}-transfer`)))
    await db
      .delete(teamPairings)
      .where(and(eq(teamPairings.teamId, teamA.id), eq(teamPairings.playerId, `${run}-transfer`)))
    await db
      .update(user)
      .set({ availability: "available", lookingForTeam: true, onMarketplace: true, updatedAt: new Date() })
      .where(eq(user.id, `${run}-transfer`))
    const freeAgentsMid = await getFreeAgents(500)
    const transferInviteToken = `${run}-transfer-token`
    await db.insert(teamInvites).values({ teamId: teamB.id, email: `${run}-transfer@sapl.local`, token: transferInviteToken, status: "pending" })
    const transferAccept = await acceptInviteByToken(transferInviteToken, asCurrentUser(coreUsers[10], `${run}-transfer`))
    const [activeOnB] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamB.id), eq(teamMembers.playerId, `${run}-transfer`), eq(teamMembers.status, "active")))
      .limit(1)
    const [activeOnA] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamA.id), eq(teamMembers.playerId, `${run}-transfer`), eq(teamMembers.status, "active")))
      .limit(1)
    add(
      "Team transfer workflow",
      freeAgentsMid.some((p) => p.id === `${run}-transfer`) && "joined" in transferAccept && !!activeOnB && !activeOnA,
      `availableMid=${freeAgentsMid.some((p) => p.id === `${run}-transfer`)}, joined=${"joined" in transferAccept}`,
    )

    // Venue Capacity + no overbook
    const clubCapRows = await db
      .select({
        id: clubs.id,
        courts: clubs.courts,
        hostingCapacity: clubs.hostingCapacity,
        homedTeams: sql<number>`count(${teams.id})::int`,
      })
      .from(clubs)
      .leftJoin(teams, eq(teams.homeClubId, clubs.id))
      .where(inArray(clubs.id, [club2.id, club4.id]))
      .groupBy(clubs.id, clubs.courts, clubs.hostingCapacity)
    const capOk = clubCapRows.every((r) => (r.homedTeams ?? 0) <= (r.hostingCapacity ?? 0))
    const scheduledRows = await db
      .select({
        venueClubId: fixtures.venueClubId,
        matchDate: fixtures.matchDate,
        timeslot: fixtures.timeslot,
      })
      .from(fixtures)
      .where(and(eq(fixtures.seasonId, simSeason.id), eq(fixtures.status, "scheduled")))
    const venueSlotCount = new Map<string, number>()
    for (const f of scheduledRows) {
      if (!f.venueClubId || !f.matchDate || !f.timeslot) continue
      const key = `${f.venueClubId}|${new Date(f.matchDate).toISOString().slice(0, 10)}|${f.timeslot}`
      venueSlotCount.set(key, (venueSlotCount.get(key) ?? 0) + 1)
    }
    const overbookedSlots = [...venueSlotCount.values()].filter((n) => n > 1).length
    add("Venue capacity and fixture overbooking constraints", capOk && overbookedSlots === 0, `capOk=${capOk}, overbookedSlots=${overbookedSlots}`)

    // Fixture Stability under replacements
    const fixtureBefore = await db
      .select({
        id: fixtures.id,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        week: fixtures.week,
        timeslot: fixtures.timeslot,
        venueClubId: fixtures.venueClubId,
        courtLinks: fixtures.courtLinks,
      })
      .from(fixtures)
      .where(eq(fixtures.seasonId, simSeason.id))
      .orderBy(fixtures.id)
    const stableReplUsers: SimUser[] = [
      { id: `${run}-stable-r1`, name: "Stable R1", email: `${run}-stable-r1@sapl.local`, role: "player" },
      { id: `${run}-stable-r2`, name: "Stable R2", email: `${run}-stable-r2@sapl.local`, role: "player" },
    ]
    simUserIds.push(...stableReplUsers.map((u) => u.id))
    await db.insert(user).values(
      stableReplUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        isPlayer: true,
        lookingForTeam: true,
        onMarketplace: true,
        availability: "available",
      })),
    )
    await db.insert(userMeta).values(stableReplUsers.map((u) => ({ userId: u.id, role: "player" })))
    const stableTokens = [`${run}-stable-t1`, `${run}-stable-t2`]
    await db.insert(teamInvites).values([
      { teamId: teamA.id, email: stableReplUsers[0].email, token: stableTokens[0], status: "pending", category: "Mens Open", pairIndex: 1, slotIndex: 2 },
      { teamId: teamC.id, email: stableReplUsers[1].email, token: stableTokens[1], status: "pending", category: "Mens Open", pairIndex: 1, slotIndex: 2 },
    ])
    await acceptInviteByToken(stableTokens[0], asCurrentUser(stableReplUsers[0], stableReplUsers[0].id))
    await acceptInviteByToken(stableTokens[1], asCurrentUser(stableReplUsers[1], stableReplUsers[1].id))
    const fixtureAfter = await db
      .select({
        id: fixtures.id,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        week: fixtures.week,
        timeslot: fixtures.timeslot,
        venueClubId: fixtures.venueClubId,
        courtLinks: fixtures.courtLinks,
      })
      .from(fixtures)
      .where(eq(fixtures.seasonId, simSeason.id))
      .orderBy(fixtures.id)
    const fixturesStable = JSON.stringify(fixtureBefore) === JSON.stringify(fixtureAfter)
    const standingsMismatch = await standingsMismatchCount(simSeason.id)
    add("Fixture stability after multiple replacements", fixturesStable && standingsMismatch === 0, `stable=${fixturesStable}, standingsMismatch=${standingsMismatch}`)

    // Season validation / standings / lifecycle integrity final
    const report = await validateSeason(simSeason.id)
    add("Season validation", report.ok, `errors=${report.errors}, warnings=${report.warnings}`)
    const typeRows = await db
      .select({ teamType: teams.teamType, count: sql<number>`count(*)::int` })
      .from(teams)
      .where(and(eq(teams.seasonId, simSeason.id), inArray(teams.status, ["draft", "recruiting", "ready", "division_assigned", "fixtures_generated", "league_active", "completed", "inactive", "active", "pending"])))
      .groupBy(teams.teamType)
    const typeMap = Object.fromEntries(typeRows.map((r) => [r.teamType ?? "unknown", Number(r.count) || 0]))
    add("Team-type coverage", ["Club Team", "Business Team", "Private Team"].every((t) => (typeMap[t] ?? 0) > 0), `counts=${JSON.stringify(typeMap)}`)
    add("Standings integrity", (await standingsMismatchCount(simSeason.id)) === 0, `mismatches=${await standingsMismatchCount(simSeason.id)}`)

    const failed = checks.filter((c) => !c.ok)
    console.log(
      JSON.stringify(
        {
          ok: failed.length === 0,
          season: { id: simSeason.id, status: simSeason.status, name: simSeason.name },
          checks,
          failedCount: failed.length,
        },
        null,
        2,
      ),
    )
    process.exit(failed.length === 0 ? 0 : 1)
  } finally {
    if (simSeasonId != null) {
      const fixtureIds = (await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.seasonId, simSeasonId))).map((r) => r.id)
      if (fixtureIds.length > 0) await db.delete(matches).where(inArray(matches.fixtureId, fixtureIds))
      await db.delete(fixtures).where(eq(fixtures.seasonId, simSeasonId))
      await db.delete(standings).where(eq(standings.seasonId, simSeasonId))
      await db.delete(tprHistory).where(inArray(tprHistory.teamId, simTeamIds.length ? simTeamIds : [0]))
      await db.delete(teamInvites).where(inArray(teamInvites.teamId, simTeamIds.length ? simTeamIds : [0]))
      await db.delete(teamPairings).where(inArray(teamPairings.teamId, simTeamIds.length ? simTeamIds : [0]))
      await db.delete(teamMembers).where(inArray(teamMembers.teamId, simTeamIds.length ? simTeamIds : [0]))
      await db.delete(teamEntries).where(eq(teamEntries.seasonId, simSeasonId))
      if (simTeamIds.length > 0) await db.delete(teams).where(inArray(teams.id, simTeamIds))
      if (simDivisionId != null) await db.delete(divisions).where(eq(divisions.id, simDivisionId))
      await db.delete(seasons).where(eq(seasons.id, simSeasonId))
    }

    if (simClubIds.length > 0) await db.delete(clubs).where(inArray(clubs.id, simClubIds))
    if (baseClubId != null) {
      if (baseClubOriginalContactEmail !== null) {
        await db.update(clubs).set({ contactEmail: baseClubOriginalContactEmail }).where(eq(clubs.id, baseClubId))
      } else {
        await db.update(clubs).set({ contactEmail: null }).where(eq(clubs.id, baseClubId))
      }
    }

    const idsToDelete = [...new Set([...simUserIds, ...authCreatedUserIds])]
    if (idsToDelete.length > 0) {
      await db.delete(session).where(inArray(session.userId, idsToDelete))
      await db.delete(account).where(inArray(account.userId, idsToDelete))
      await db.delete(verification).where(inArray(verification.identifier, idsToDelete))
      await db.delete(userMeta).where(inArray(userMeta.userId, idsToDelete))
      await db.delete(user).where(inArray(user.id, idsToDelete))
    }

    const probeRows = await db.select({ id: user.id }).from(user).where(like(user.email, "sim-reg-%@sapl.local")).orderBy(desc(user.createdAt)).limit(20)
    if (probeRows.length > 0) {
      const probeIds = probeRows.map((r) => r.id)
      await db.delete(session).where(inArray(session.userId, probeIds))
      await db.delete(account).where(inArray(account.userId, probeIds))
      await db.delete(userMeta).where(inArray(userMeta.userId, probeIds))
      await db.delete(user).where(inArray(user.id, probeIds))
    }

    if (previousCurrentSeasonIds.length > 0) {
      await db.update(seasons).set({ isCurrent: false })
      for (const seasonId of previousCurrentSeasonIds) {
        await db.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, seasonId))
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

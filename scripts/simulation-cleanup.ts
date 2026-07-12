import { db } from "@/lib/db"
import {
  account,
  clubs,
  disputes,
  divisions,
  fixtures,
  matches,
  playoffs,
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
import { desc, eq, inArray, like, or } from "drizzle-orm"

type CleanupOpts = {
  runId?: string
  includeHistorical?: boolean
}

function simPatterns(opts: CleanupOpts) {
  if (opts.runId) {
    const run = opts.runId
    return {
      seasonExact: `Simulation ${run}`,
      teamNameLike: `${run}-team-%`,
      clubNameLike: `${run}-club-%`,
      userIdLike: `${run}%`,
      userEmailLike: `${run}%@sapl.local`,
      verificationEmailLike: `${run}%@sapl.local`,
    }
  }
  return {
    seasonLike: "Simulation sim-%",
    teamNameLike: "sim-%-team-%",
    clubNameLike: "sim-%-club-%",
    userIdLike: "sim-%",
    userEmailLike: "sim-%@sapl.local",
    verificationEmailLike: "sim-%@sapl.local",
  }
}

export async function cleanupSimulationData(opts: CleanupOpts = {}) {
  const includeHistorical = opts.includeHistorical ?? false
  const patterns = simPatterns(opts)
  if (!opts.runId && !includeHistorical) return { ok: true, deleted: {} as Record<string, number> }

  const seasonRows = opts.runId
    ? await db.select({ id: seasons.id, isCurrent: seasons.isCurrent }).from(seasons).where(eq(seasons.name, patterns.seasonExact!))
    : await db.select({ id: seasons.id, isCurrent: seasons.isCurrent }).from(seasons).where(like(seasons.name, patterns.seasonLike!))
  const seasonIds = seasonRows.map((r) => r.id)
  const deletedCurrentSeason = seasonRows.some((r) => r.isCurrent)

  const baseTeamWhere = like(teams.name, patterns.teamNameLike)
  const teamWhere = seasonIds.length > 0 ? or(baseTeamWhere, inArray(teams.seasonId, seasonIds)) : baseTeamWhere
  const teamRows = await db.select({ id: teams.id }).from(teams).where(teamWhere)
  const teamIds = teamRows.map((r) => r.id)

  const clubRows = await db.select({ id: clubs.id }).from(clubs).where(like(clubs.name, patterns.clubNameLike))
  const clubIds = clubRows.map((r) => r.id)

  const userRows = await db
    .select({ id: user.id })
    .from(user)
    .where(or(like(user.id, patterns.userIdLike), like(user.email, patterns.userEmailLike)))
  const userIds = userRows.map((r) => r.id)

  const deleted: Record<string, number> = {}

  const fixtureWhere =
    seasonIds.length > 0 && teamIds.length > 0
      ? or(inArray(fixtures.seasonId, seasonIds), inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds))
      : seasonIds.length > 0
        ? inArray(fixtures.seasonId, seasonIds)
        : teamIds.length > 0
          ? or(inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds))
          : null

  const fixtureRows = fixtureWhere
    ? await db.select({ id: fixtures.id }).from(fixtures).where(fixtureWhere)
    : []
  const fixtureIds = fixtureRows.map((r) => r.id)

  if (fixtureIds.length > 0) {
    const m = await db.delete(matches).where(inArray(matches.fixtureId, fixtureIds)).returning({ id: matches.id })
    deleted.matches = m.length
    const d = await db.delete(disputes).where(inArray(disputes.fixtureId, fixtureIds)).returning({ id: disputes.id })
    deleted.disputes = d.length
  }

  if (seasonIds.length > 0) {
    const p = await db.delete(playoffs).where(inArray(playoffs.seasonId, seasonIds)).returning({ id: playoffs.id })
    deleted.playoffs = p.length
    const s = await db.delete(standings).where(inArray(standings.seasonId, seasonIds)).returning({ id: standings.id })
    deleted.standings = s.length
    const f = await db.delete(fixtures).where(inArray(fixtures.seasonId, seasonIds)).returning({ id: fixtures.id })
    deleted.fixtures = f.length
    const te = await db.delete(teamEntries).where(inArray(teamEntries.seasonId, seasonIds)).returning({ id: teamEntries.id })
    deleted.teamEntries = te.length
    const dv = await db.delete(divisions).where(inArray(divisions.seasonId, seasonIds)).returning({ id: divisions.id })
    deleted.divisions = dv.length
  }

  if (teamIds.length > 0) {
    const ti = await db.delete(teamInvites).where(inArray(teamInvites.teamId, teamIds)).returning({ id: teamInvites.id })
    deleted.teamInvites = ti.length
    const tp = await db.delete(teamPairings).where(inArray(teamPairings.teamId, teamIds)).returning({ id: teamPairings.id })
    deleted.teamPairings = tp.length
    const tm = await db.delete(teamMembers).where(inArray(teamMembers.teamId, teamIds)).returning({ id: teamMembers.id })
    deleted.teamMembers = tm.length
    const th = await db.delete(tprHistory).where(inArray(tprHistory.teamId, teamIds)).returning({ id: tprHistory.id })
    deleted.tprHistory = th.length
    const t = await db.delete(teams).where(inArray(teams.id, teamIds)).returning({ id: teams.id })
    deleted.teams = t.length
  }

  if (seasonIds.length > 0) {
    const ss = await db.delete(seasons).where(inArray(seasons.id, seasonIds)).returning({ id: seasons.id })
    deleted.seasons = ss.length
  }

  if (clubIds.length > 0) {
    const c = await db.delete(clubs).where(inArray(clubs.id, clubIds)).returning({ id: clubs.id })
    deleted.clubs = c.length
  }

  if (userIds.length > 0) {
    const sess = await db.delete(session).where(inArray(session.userId, userIds)).returning({ id: session.id })
    deleted.sessions = sess.length
    const acc = await db.delete(account).where(inArray(account.userId, userIds)).returning({ id: account.id })
    deleted.accounts = acc.length
    const um = await db.delete(userMeta).where(inArray(userMeta.userId, userIds)).returning({ id: userMeta.id })
    deleted.userMeta = um.length
    const u = await db.delete(user).where(inArray(user.id, userIds)).returning({ id: user.id })
    deleted.users = u.length
  }

  const ver = await db
    .delete(verification)
    .where(
      userIds.length > 0
        ? or(inArray(verification.identifier, userIds), like(verification.identifier, patterns.verificationEmailLike))
        : like(verification.identifier, patterns.verificationEmailLike),
    )
    .returning({ id: verification.id })
  deleted.verification = ver.length

  if (deletedCurrentSeason) {
    const [hasCurrent] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.isCurrent, true)).limit(1)
    if (!hasCurrent) {
      const [fallback] = await db.select({ id: seasons.id }).from(seasons).orderBy(desc(seasons.id)).limit(1)
      if (fallback) await db.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, fallback.id))
    }
  }

  return { ok: true, deleted }
}

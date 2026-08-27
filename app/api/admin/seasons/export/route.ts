import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import {
  seasons,
  teams,
  teamMembers,
  user,
  divisions,
  regions,
  fixtures,
  matches,
  teamPairings,
  teamInvites,
} from "@/lib/db/schema"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { getCurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { CATEGORY_RULES } from "@/lib/constants"

function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const esc = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value)
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replaceAll("\"", "\"\"")}"`
    }
    return text
  }
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => esc(row[header])).join(",")),
  ].join("\n")
}

async function toXlsxBuffer(sheetName: string, rows: Record<string, string | number | null | undefined>[]) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  if (rows.length > 0) {
    const headers = Object.keys(rows[0])
    worksheet.addRow(headers)
    for (const row of rows) {
      worksheet.addRow(headers.map((header) => row[header] ?? ""))
    }
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(16, Math.min(42, header.length + 6)),
    }))
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
    })
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

function normalizePlayerName(firstName: string | null, lastName: string | null, fallbackName: string) {
  const full = `${firstName ?? ""} ${lastName ?? ""}`.trim()
  return full || fallbackName
}

function listToPair(value: string[]) {
  if (value.length >= 2) return `${value[0]} / ${value[1]}`
  if (value.length === 1) return `${value[0]} / TBC`
  return "TBC / TBC"
}

async function getTeamExportRows(seasonId: number) {
  const activeRows = await db
    .select({
      seasonName: seasons.name,
      conference: regions.name,
      division: divisions.name,
      teamId: teams.id,
      team: teams.name,
      playerId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      fallbackName: user.name,
      prRating: user.playtomicRating,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(user, eq(teamMembers.playerId, user.id))
    .innerJoin(seasons, eq(teams.seasonId, seasons.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(and(eq(teams.seasonId, seasonId), eq(teamMembers.status, "active")))
    .orderBy(asc(regions.name), asc(divisions.level), asc(divisions.name), asc(teams.name), asc(user.firstName), asc(user.lastName))

  const pairingCategoryRows = await db
    .select({
      teamId: teamPairings.teamId,
      playerId: teamPairings.playerId,
      category: teamPairings.category,
    })
    .from(teamPairings)
    .innerJoin(teams, eq(teamPairings.teamId, teams.id))
    .where(and(eq(teams.seasonId, seasonId), isNotNull(teamPairings.playerId)))

  const categoryByPlayerTeam = new Map<string, Set<string>>()
  for (const row of pairingCategoryRows) {
    if (!row.playerId) continue
    const key = `${row.teamId}:${row.playerId}`
    const set = categoryByPlayerTeam.get(key) ?? new Set<string>()
    set.add(row.category)
    categoryByPlayerTeam.set(key, set)
  }

  const pendingInviteRows = await db
    .select({
      seasonName: seasons.name,
      conference: regions.name,
      division: divisions.name,
      team: teams.name,
      email: teamInvites.email,
      invitedName: teamInvites.invitedName,
      invitedRating: teamInvites.invitedRating,
      category: teamInvites.category,
    })
    .from(teamInvites)
    .innerJoin(teams, eq(teamInvites.teamId, teams.id))
    .innerJoin(seasons, eq(teams.seasonId, seasons.id))
    .leftJoin(divisions, eq(teams.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .where(and(eq(teams.seasonId, seasonId), eq(teamInvites.status, "pending")))
    .orderBy(asc(regions.name), asc(divisions.level), asc(divisions.name), asc(teams.name), asc(teamInvites.createdAt))

  const playerRows = activeRows.map((row) => ({
    Season: row.seasonName,
    Conference: row.conference ?? "Unassigned",
    Division: row.division ?? "Unassigned",
    Team: row.team,
    Player: normalizePlayerName(row.firstName, row.lastName, row.fallbackName),
    Email: row.email ?? "",
    Category: [...(categoryByPlayerTeam.get(`${row.teamId}:${row.playerId}`) ?? new Set<string>())].join(", ") || "Unassigned",
    "PR Rating": row.prRating ?? "",
    "Entry Status": "Active",
  }))
  const inviteRows = pendingInviteRows
    .filter((row) => !!row.invitedName)
    .map((row) => ({
      Season: row.seasonName,
      Conference: row.conference ?? "Unassigned",
      Division: row.division ?? "Unassigned",
      Team: row.team,
      Player: row.invitedName as string,
      Email: row.email ?? "",
      Category: row.category ?? "Unassigned",
      "PR Rating": row.invitedRating ?? "",
      "Entry Status": "Pending Invite",
    }))
  return [...playerRows, ...inviteRows]
}

async function getFixtureExportRows(seasonId: number, week: number) {
  const homeTeam = alias(teams, "homeTeam")
  const awayTeam = alias(teams, "awayTeam")
  const categoryOrder = CATEGORY_RULES.map((rule) => rule.name)

  const fixtureRows = await db
    .select({
      fixtureId: fixtures.id,
      seasonName: seasons.name,
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      timeslot: fixtures.timeslot,
      venue: fixtures.venue,
      divisionName: divisions.name,
      conference: regions.name,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      courtAssignments: fixtures.courtAssignments,
    })
    .from(fixtures)
    .innerJoin(seasons, eq(fixtures.seasonId, seasons.id))
    .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.week, week)))
    .orderBy(asc(fixtures.matchDate), asc(divisions.level), asc(fixtures.id))

  const teamIds = [...new Set(fixtureRows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter((id): id is number => id != null))]
  if (fixtureRows.length === 0) return []

  const pairingUser = alias(user, "pairingUser")
  const pairingRows = teamIds.length
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          pairIndex: teamPairings.pairIndex,
          slotIndex: teamPairings.slotIndex,
          firstName: pairingUser.firstName,
          lastName: pairingUser.lastName,
          fallbackName: pairingUser.name,
        })
        .from(teamPairings)
        .innerJoin(pairingUser, eq(teamPairings.playerId, pairingUser.id))
        .where(inArray(teamPairings.teamId, teamIds))
    : []

  const inviteRows = teamIds.length
    ? await db
        .select({
          teamId: teamInvites.teamId,
          category: teamInvites.category,
          pairIndex: teamInvites.pairIndex,
          slotIndex: teamInvites.slotIndex,
          invitedName: teamInvites.invitedName,
        })
        .from(teamInvites)
        .where(and(inArray(teamInvites.teamId, teamIds), eq(teamInvites.status, "pending")))
    : []

  const slotMap = new Map<string, string>()
  for (const row of inviteRows) {
    if (!row.category || row.pairIndex == null || row.slotIndex == null || !row.invitedName) continue
    const key = `${row.teamId}:${row.category}:${row.pairIndex}:${row.slotIndex}`
    if (!slotMap.has(key)) slotMap.set(key, row.invitedName)
  }

  for (const row of pairingRows) {
    const player = normalizePlayerName(row.firstName, row.lastName, row.fallbackName)
    const key = `${row.teamId}:${row.category}:${row.pairIndex}:${row.slotIndex}`
    slotMap.set(key, player)
  }

  function playersFor(teamId: number | null, category: string | null) {
    if (teamId == null || !category) return "TBC / TBC"
    const names: string[] = []
    for (const pairIndex of [1, 2]) {
      for (const slotIndex of [1, 2]) {
        const name = slotMap.get(`${teamId}:${category}:${pairIndex}:${slotIndex}`)
        if (name) names.push(name)
      }
    }
    return listToPair(names)
  }

  return fixtureRows.flatMap((row) => {
      const assignments = (row.courtAssignments ?? {}) as Record<string, { court: string | null; time: string | null }>
      const categorySet = new Set<string>([...categoryOrder, ...Object.keys(assignments)])
      const categories = [...categorySet].sort((a, b) => {
        const ai = categoryOrder.indexOf(a)
        const bi = categoryOrder.indexOf(b)
        if (ai === -1 && bi === -1) return a.localeCompare(b)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      const matchDate =
        row.matchDate instanceof Date
          ? row.matchDate.toISOString().slice(0, 10)
          : row.matchDate
            ? new Date(row.matchDate).toISOString().slice(0, 10)
            : ""

      return categories.map((category) => {
        const assignment = assignments[category]
        return {
          Season: row.seasonName,
          Week: row.week,
          Conference: row.conference ?? "Unassigned",
          Division: row.divisionName ?? "Unassigned",
          Date: matchDate,
          Category: category,
          Court: assignment?.court ?? "",
          Time: assignment?.time ?? row.timeslot ?? "",
          Venue: row.venue ?? "",
          "Home Team": row.homeTeam ?? "TBD",
          "Home Pair": playersFor(row.homeTeamId, category),
          "Away Team": row.awayTeam ?? "TBD",
          "Away Pair": playersFor(row.awayTeamId, category),
        }
      })
    })
}

async function getResultsExportRows(seasonId: number, week: number) {
  const homeTeam = alias(teams, "homeTeam")
  const awayTeam = alias(teams, "awayTeam")

  const rows = await db
    .select({
      week: fixtures.week,
      matchDate: fixtures.matchDate,
      timeslot: fixtures.timeslot,
      venue: fixtures.venue,
      conference: regions.name,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      category: matches.category,
      homeSetsWon: matches.homeSetsWon,
      awaySetsWon: matches.awaySetsWon,
      scoreDetail: matches.scoreDetail,
      homePlayerIds: matches.homePlayerIds,
      awayPlayerIds: matches.awayPlayerIds,
      courtAssignments: fixtures.courtAssignments,
    })
    .from(fixtures)
    .innerJoin(seasons, eq(fixtures.seasonId, seasons.id))
    .leftJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .leftJoin(regions, eq(divisions.regionId, regions.id))
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .leftJoin(matches, eq(matches.fixtureId, fixtures.id))
    .where(and(eq(fixtures.seasonId, seasonId), eq(fixtures.week, week)))
    .orderBy(asc(fixtures.matchDate), asc(divisions.level), asc(matches.session), asc(matches.category))

  if (rows.length === 0) return []

  const teamIds = [...new Set(rows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter((id): id is number => id != null))]
  const pairingUser = alias(user, "pairingUserResults")
  const pairingRows = teamIds.length
    ? await db
        .select({
          teamId: teamPairings.teamId,
          category: teamPairings.category,
          pairIndex: teamPairings.pairIndex,
          slotIndex: teamPairings.slotIndex,
          firstName: pairingUser.firstName,
          lastName: pairingUser.lastName,
          fallbackName: pairingUser.name,
        })
        .from(teamPairings)
        .innerJoin(pairingUser, eq(teamPairings.playerId, pairingUser.id))
        .where(inArray(teamPairings.teamId, teamIds))
    : []

  const playerIds = Array.from(
    new Set(
      rows.flatMap((row) => [
        ...(Array.isArray(row.homePlayerIds) ? row.homePlayerIds : []).filter((id): id is number => typeof id === "number"),
        ...(Array.isArray(row.awayPlayerIds) ? row.awayPlayerIds : []).filter((id): id is number => typeof id === "number"),
      ]),
    ),
  )

  const playerRows = playerIds.length
    ? await db
        .select({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          fallbackName: user.name,
        })
        .from(user)
        .where(inArray(user.id, playerIds))
    : []

  const playerNameById = new Map<string, string>()
  for (const p of playerRows) {
    playerNameById.set(p.id, normalizePlayerName(p.firstName, p.lastName, p.fallbackName))
  }

  const pairingByTeamCategory = new Map<string, string[]>()
  for (const row of pairingRows) {
    if (!row.category || row.pairIndex == null || row.slotIndex == null) continue
    const key = `${row.teamId}:${row.category}`
    const player = normalizePlayerName(row.firstName, row.lastName, row.fallbackName)
    const existing = pairingByTeamCategory.get(key) ?? []
    existing.push(player)
    pairingByTeamCategory.set(key, existing)
  }

  function namesFromIds(ids: number[]) {
    const names = ids
      .map((id) => playerNameById.get(String(id)))
      .filter((name): name is string => !!name)
    return listToPair(names)
  }

  function fallbackPair(teamId: number | null, category: string | null) {
    if (teamId == null || !category) return "TBC / TBC"
    const names = pairingByTeamCategory.get(`${teamId}:${category}`) ?? []
    return listToPair(names)
  }

  return rows
    .filter((row) => !!row.category)
    .map((row) => {
      const assignments = (row.courtAssignments ?? {}) as Record<string, { court: string | null; time: string | null }>
      const assignment = row.category ? assignments[row.category] : undefined
      const matchDate =
        row.matchDate instanceof Date
          ? row.matchDate.toISOString().slice(0, 10)
          : row.matchDate
            ? new Date(row.matchDate).toISOString().slice(0, 10)
            : ""
      const homePlayerIds = Array.isArray(row.homePlayerIds) ? row.homePlayerIds : []
      const awayPlayerIds = Array.isArray(row.awayPlayerIds) ? row.awayPlayerIds : []
      const homePlayers = homePlayerIds.length ? namesFromIds(homePlayerIds) : fallbackPair(row.homeTeamId, row.category)
      const awayPlayers = awayPlayerIds.length ? namesFromIds(awayPlayerIds) : fallbackPair(row.awayTeamId, row.category)

      return {
        Week: row.week,
        Conference: row.conference ?? "Unassigned",
        Date: matchDate,
        Time: assignment?.time ?? row.timeslot ?? "",
        Venue: row.venue ?? "",
        "Home Team": row.homeTeam ?? "TBD",
        "Away Team": row.awayTeam ?? "TBD",
        "Category Score": `${row.homeSetsWon ?? 0}-${row.awaySetsWon ?? 0}`,
        Category: row.category ?? "",
        "Home Players": homePlayers,
        "Away Players": awayPlayers,
        "Set Scores": row.scoreDetail ?? "",
      }
    })
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return new NextResponse("Not authenticated", { status: 401 })
  const access = await getAccessContext(currentUser)
  if (!access.can("league_management")) return new NextResponse("Not authorized", { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const seasonId = Number(searchParams.get("seasonId"))
  const week = Number(searchParams.get("week"))

  if (!Number.isFinite(seasonId) || seasonId <= 0) {
    return new NextResponse("Invalid seasonId", { status: 400 })
  }
  const [season] = await db.select({ weeks: seasons.weeks }).from(seasons).where(eq(seasons.id, seasonId)).limit(1)
  if (!season) return new NextResponse("Season not found", { status: 404 })

  if (type === "teams") {
    const rows = await getTeamExportRows(seasonId)
    const xlsx = await toXlsxBuffer("Teams and players", rows)
    return new NextResponse(xlsx, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="season-${seasonId}-teams-players.xlsx"`,
      },
    })
  }

  if (type === "fixtures") {
    if (!Number.isFinite(week) || week < 1 || week > season.weeks) {
      return new NextResponse(`Invalid week. Use 1-${season.weeks}.`, { status: 400 })
    }
    const rows = await getFixtureExportRows(seasonId, week)
    const csv = toCsv(rows)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="season-${seasonId}-week-${week}-fixtures.csv"`,
      },
    })
  }

  if (type === "results") {
    if (!Number.isFinite(week) || week < 1 || week > season.weeks) {
      return new NextResponse("Invalid week.", { status: 400 })
    }
    const rows = await getResultsExportRows(seasonId, week)
    const xlsx = await toXlsxBuffer(`Week ${week} results`, rows)
    return new NextResponse(xlsx, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="season-${seasonId}-week-${week}-results.xlsx"`,
      },
    })
  }

  return new NextResponse("Invalid export type", { status: 400 })
}

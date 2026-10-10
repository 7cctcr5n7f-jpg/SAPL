import "server-only"
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { playoffs, settings, teamEntries, teamPairings, teams, user } from "@/lib/db/schema"
import {
  BOARD_CATEGORIES,
  BOARD_STAGE_ROUNDS,
  LIVE_STAGE_SETTING_KEY,
  boardStageSupportsPlayers,
  showPlayersSettingKey,
  defaultMatchHeading,
  isBoardStage,
  padSets,
  parseCourtNumber,
  sortBoardFixtures,
  type BoardFixture,
  type BoardMatch,
  type BoardStage,
  type BoardTeam,
  type BoardTeamOption,
  type PlayoffBoardData,
} from "@/lib/playoff-board"

function formatBoardDate(date: Date | null): string | null {
  if (!date) return null
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`.replace(/\./g, "").toUpperCase()
}

const BOARD_TYPES = ["regional_final", "tshwane_masters"]

export async function getLiveBoardStage(): Promise<BoardStage> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, LIVE_STAGE_SETTING_KEY)).limit(1)
  return isBoardStage(row?.value) ? row.value : "quarter_final"
}

async function getShowPlayers(stage: BoardStage): Promise<boolean> {
  if (!boardStageSupportsPlayers(stage)) return false
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, showPlayersSettingKey(stage))).limit(1)
  return row?.value === "true"
}

function playerDisplayName(row: { name: string; firstName: string | null; lastName: string | null }): string {
  const joined = [row.firstName, row.lastName].map((part) => part?.trim()).filter(Boolean).join(" ")
  let full = joined || row.name.trim()
  if (full.includes("@")) full = full.split("@")[0]
  // Long names are shortened to an initial plus surname so they fit on the board.
  if (full.length > 20) {
    const parts = full.split(/\s+/)
    if (parts.length > 1) full = `${parts[0][0]}. ${parts.slice(1).join(" ")}`
  }
  return full
}

// Board-only name edits replace the registered name for that slot without touching the player or team.
function withOverrides(names: string[], overrides: Array<string | null> | undefined): string[] {
  return [0, 1].map((slot) => overrides?.[slot]?.trim() || names[slot] || "")
}

// Registered pairing per team and category, e.g. "98|Mens Open" -> ["Egmondt van Heerden", "Wynand Prinsloo"].
async function getPairingNames(teamIds: number[]): Promise<Map<string, string[]>> {
  const byKey = new Map<string, string[]>()
  if (teamIds.length === 0) return byKey
  const rows = await db
    .select({
      teamId: teamPairings.teamId,
      category: teamPairings.category,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    .from(teamPairings)
    .innerJoin(user, eq(teamPairings.playerId, user.id))
    .where(and(inArray(teamPairings.teamId, teamIds), isNotNull(teamPairings.playerId)))
    .orderBy(asc(teamPairings.pairIndex), asc(teamPairings.slotIndex))
  for (const row of rows) {
    const key = `${row.teamId}|${row.category}`
    byKey.set(key, [...(byKey.get(key) ?? []), playerDisplayName(row)])
  }
  return byKey
}

export async function getBoardTeamOptions(seasonId: number): Promise<BoardTeamOption[]> {
  return db
    .select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl })
    .from(teamEntries)
    .innerJoin(teams, eq(teamEntries.teamId, teams.id))
    .where(eq(teamEntries.seasonId, seasonId))
    .orderBy(asc(teams.name))
}

export async function getPlayoffBoard(requestedStage?: BoardStage | null): Promise<PlayoffBoardData> {
  const liveStage = await getLiveBoardStage()
  const stage = requestedStage ?? liveStage
  const showPlayers = await getShowPlayers(stage)
  const empty: PlayoffBoardData = { stage, liveStage, showPlayers, seasonId: null, dateLabel: null, venue: null, matches: [] }

  const [latest] = await db
    .select({ seasonId: playoffs.seasonId })
    .from(playoffs)
    .where(inArray(playoffs.type, BOARD_TYPES))
    .orderBy(desc(playoffs.seasonId))
    .limit(1)
  if (!latest) return empty

  let rows = await db
    .select()
    .from(playoffs)
    .where(
      and(
        eq(playoffs.seasonId, latest.seasonId),
        inArray(playoffs.round, BOARD_STAGE_ROUNDS[stage]),
        inArray(playoffs.type, BOARD_TYPES),
      ),
    )
  if (rows.some((row) => row.type === "tshwane_masters")) rows = rows.filter((row) => row.type === "tshwane_masters")
  rows.sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
  if (rows.length === 0) return { ...empty, seasonId: latest.seasonId }

  const teamIds = [...new Set(rows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter((id): id is number => id != null))]
  const teamRows = teamIds.length
    ? await db.select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl }).from(teams).where(inArray(teams.id, teamIds))
    : []
  const teamById = new Map(teamRows.map((team) => [team.id, team]))
  const pairingNames = showPlayers ? await getPairingNames(teamIds) : new Map<string, string[]>()
  const playersFor = (teamId: number | null, category: string) =>
    teamId == null ? [] : (pairingNames.get(`${teamId}|${category}`) ?? [])

  const resolveTeam = (id: number | null, label: string | null): BoardTeam => {
    const team = id != null ? teamById.get(id) : undefined
    return { id, name: team?.name ?? label ?? "TBD", logoUrl: team?.logoUrl ?? null }
  }

  const roundIndex = new Map<string, number>()
  const matches: BoardMatch[] = rows.map((row) => {
    const schedule = row.categorySchedule ?? {}
    const scores = row.categoryScores ?? {}
    const config = row.boardConfig ?? {}
    const categories = [...new Set([...BOARD_CATEGORIES, ...Object.keys(schedule)])]
    const fixtures: BoardFixture[] = categories.map((category) => ({
      category,
      time: schedule[category]?.timeslot ?? row.timeslot ?? null,
      court: parseCourtNumber(schedule[category]?.court),
      home: padSets(scores[category]?.home),
      away: padSets(scores[category]?.away),
      homePlayers: withOverrides(playersFor(row.homeTeamId, category), config.playerNames?.[category]?.home),
      awayPlayers: withOverrides(playersFor(row.awayTeamId, category), config.playerNames?.[category]?.away),
    }))
    const index = roundIndex.get(row.round) ?? 0
    roundIndex.set(row.round, index + 1)
    const heading = defaultMatchHeading(row.round, index)
    const customTitle = config.title?.trim()
    return {
      playoffId: row.id,
      position: row.bracketPosition ?? 0,
      round: row.round,
      title: customTitle || heading.title,
      defaultTitle: heading.title,
      tag: heading.tag,
      homeHidden: Boolean(config.homeHidden) || (row.homeTeamId == null && !row.homeLabel),
      awayHidden: Boolean(config.awayHidden) || (row.awayTeamId == null && !row.awayLabel),
      home: resolveTeam(row.homeTeamId, row.homeLabel),
      away: resolveTeam(row.awayTeamId, row.awayLabel),
      homePoints: row.homeScore ?? 0,
      awayPoints: row.awayScore ?? 0,
      fixtures: sortBoardFixtures(fixtures),
    }
  })

  const first = rows[0]
  return {
    stage,
    liveStage,
    showPlayers,
    seasonId: latest.seasonId,
    dateLabel: formatBoardDate(first?.matchDate ? new Date(first.matchDate as unknown as string) : null),
    venue: first?.venue ?? null,
    matches,
  }
}

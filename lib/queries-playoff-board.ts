import "server-only"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { playoffs, teams } from "@/lib/db/schema"
import {
  BOARD_CATEGORIES,
  padSets,
  parseCourtNumber,
  sortBoardFixtures,
  type BoardFixture,
  type BoardMatch,
  type BoardTeam,
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

export async function getPlayoffBoard(): Promise<PlayoffBoardData> {
  const [latest] = await db
    .select({ seasonId: playoffs.seasonId })
    .from(playoffs)
    .where(and(eq(playoffs.round, "quarter_final"), inArray(playoffs.type, ["regional_final", "tshwane_masters"])))
    .orderBy(desc(playoffs.seasonId))
    .limit(1)
  if (!latest) return { dateLabel: null, venue: null, matches: [] }

  const rows = await db
    .select()
    .from(playoffs)
    .where(
      and(
        eq(playoffs.seasonId, latest.seasonId),
        eq(playoffs.round, "quarter_final"),
        inArray(playoffs.type, ["regional_final", "tshwane_masters"]),
      ),
    )
  rows.sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))

  const teamIds = [...new Set(rows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter((id): id is number => id != null))]
  const teamRows = teamIds.length
    ? await db.select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl }).from(teams).where(inArray(teams.id, teamIds))
    : []
  const teamById = new Map(teamRows.map((team) => [team.id, team]))

  const resolveTeam = (id: number | null, label: string | null): BoardTeam => {
    const team = id != null ? teamById.get(id) : undefined
    return { id, name: team?.name ?? label ?? "TBD", logoUrl: team?.logoUrl ?? null }
  }

  const matches: BoardMatch[] = rows.map((row) => {
    const schedule = row.categorySchedule ?? {}
    const scores = row.categoryScores ?? {}
    const categories = [...new Set([...BOARD_CATEGORIES, ...Object.keys(schedule)])]
    const fixtures: BoardFixture[] = categories.map((category) => ({
      category,
      time: schedule[category]?.timeslot ?? row.timeslot ?? null,
      court: parseCourtNumber(schedule[category]?.court),
      home: padSets(scores[category]?.home),
      away: padSets(scores[category]?.away),
    }))
    return {
      playoffId: row.id,
      position: row.bracketPosition ?? 0,
      home: resolveTeam(row.homeTeamId, row.homeLabel),
      away: resolveTeam(row.awayTeamId, row.awayLabel),
      homePoints: row.homeScore ?? 0,
      awayPoints: row.awayScore ?? 0,
      fixtures: sortBoardFixtures(fixtures),
    }
  })

  const first = rows[0]
  return {
    dateLabel: formatBoardDate(first?.matchDate ? new Date(first.matchDate as unknown as string) : null),
    venue: first?.venue ?? null,
    matches,
  }
}

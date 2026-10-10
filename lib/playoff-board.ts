export const BOARD_CATEGORIES = ["Ladies Open", "Mens Open", "Mens Beginner", "Mens Intermediate"] as const
export type BoardCategory = (typeof BOARD_CATEGORIES)[number]

export const BOARD_CATEGORY_LABELS: Record<string, string> = {
  "Ladies Open": "Ladies Open",
  "Mens Open": "Men's Open",
  "Mens Beginner": "Men's Beginner",
  "Mens Intermediate": "Men's Intermediate",
}

export const BOARD_SET_COUNT = 3

export type BoardSets = Array<number | null>

export const BOARD_STAGES = ["quarter_final", "semi_final", "final"] as const
export type BoardStage = (typeof BOARD_STAGES)[number]

export const BOARD_STAGE_LABELS: Record<BoardStage, string> = {
  quarter_final: "Quarter-finals",
  semi_final: "Semi-finals",
  final: "Finals",
}

// The "Finals" stage shows the 3rd place playoff next to the final.
export const BOARD_STAGE_ROUNDS: Record<BoardStage, string[]> = {
  quarter_final: ["quarter_final"],
  semi_final: ["semi_final"],
  final: ["third_place", "final"],
}

export const LIVE_STAGE_SETTING_KEY = "playoff_board_stage"

// Player names are only offered once the board has room for them (semi-finals and finals).
export function boardStageSupportsPlayers(stage: BoardStage): boolean {
  return stage !== "quarter_final"
}

export function showPlayersSettingKey(stage: BoardStage): string {
  return `playoff_board_show_players_${stage}`
}
export const MAX_BOARD_TITLE_LENGTH = 40
export const MAX_BOARD_PLAYER_NAME_LENGTH = 30

export function isBoardStage(value: unknown): value is BoardStage {
  return typeof value === "string" && (BOARD_STAGES as readonly string[]).includes(value)
}

export function defaultMatchHeading(round: string, index: number): { title: string; tag: string } {
  const n = index + 1
  if (round === "quarter_final") return { title: `Quarter-final ${n}`, tag: `QF${n}` }
  if (round === "semi_final") return { title: `Semi-final ${n}`, tag: `SF${n}` }
  if (round === "third_place") return { title: "3rd place playoff", tag: "3RD" }
  if (round === "final") return { title: "Final", tag: "FINAL" }
  return { title: `Match ${n}`, tag: `M${n}` }
}

export type BoardTeam = {
  id: number | null
  name: string
  logoUrl: string | null
}

export type BoardTeamOption = {
  id: number
  name: string
  logoUrl: string | null
}

export type BoardFixture = {
  category: string
  time: string | null
  court: number | null
  home: BoardSets
  away: BoardSets
  homePlayers: string[]
  awayPlayers: string[]
}

export type BoardMatch = {
  playoffId: number
  position: number
  round: string
  title: string
  defaultTitle: string
  tag: string
  homeHidden: boolean
  awayHidden: boolean
  home: BoardTeam
  away: BoardTeam
  homePoints: number
  awayPoints: number
  fixtures: BoardFixture[]
}

export type PlayoffBoardData = {
  stage: BoardStage
  liveStage: BoardStage
  showPlayers: boolean
  seasonId: number | null
  dateLabel: string | null
  venue: string | null
  matches: BoardMatch[]
}

export function normalizeBoardTime(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim().replace(/[.\s]/g, ":")
  if (!value) return null
  let hours: number
  let minutes: number
  const colon = value.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colon) {
    hours = Number(colon[1])
    minutes = colon[2].length === 1 ? Number(colon[2]) * 10 : Number(colon[2])
  } else if (/^\d{3,4}$/.test(value)) {
    hours = Number(value.slice(0, value.length - 2))
    minutes = Number(value.slice(-2))
  } else if (/^\d{1,2}$/.test(value)) {
    hours = Number(value)
    minutes = 0
  } else {
    return null
  }
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function parseCourtNumber(raw: string | null | undefined): number | null {
  const match = String(raw ?? "").match(/(\d+)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export function sortBoardFixtures(fixtures: BoardFixture[]): BoardFixture[] {
  const order = (category: string) => {
    const idx = (BOARD_CATEGORIES as readonly string[]).indexOf(category)
    return idx === -1 ? BOARD_CATEGORIES.length : idx
  }
  return [...fixtures].sort((a, b) => {
    const at = a.time ?? "99:99"
    const bt = b.time ?? "99:99"
    return at.localeCompare(bt) || order(a.category) - order(b.category)
  })
}

export function padSets(sets: BoardSets | undefined | null): BoardSets {
  return Array.from({ length: BOARD_SET_COUNT }, (_, i) => {
    const v = sets?.[i]
    return typeof v === "number" && Number.isFinite(v) ? v : null
  })
}

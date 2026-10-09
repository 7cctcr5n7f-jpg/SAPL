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

export type BoardTeam = {
  id: number | null
  name: string
  logoUrl: string | null
}

export type BoardFixture = {
  category: string
  time: string | null
  court: number | null
  home: BoardSets
  away: BoardSets
}

export type BoardMatch = {
  playoffId: number
  position: number
  home: BoardTeam
  away: BoardTeam
  homePoints: number
  awayPoints: number
  fixtures: BoardFixture[]
}

export type PlayoffBoardData = {
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

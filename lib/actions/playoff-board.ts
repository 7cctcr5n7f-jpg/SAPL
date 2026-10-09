"use server"

import { eq } from "drizzle-orm"
import { revalidatePath, revalidateTag } from "next/cache"
import { db } from "@/lib/db"
import { playoffs } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { BOARD_SET_COUNT, normalizeBoardTime, padSets, parseCourtNumber } from "@/lib/playoff-board"

export type PlayoffBoardEdit =
  | { playoffId: number; kind: "points"; side: "home" | "away"; value: number }
  | { playoffId: number; kind: "time"; category: string; value: string }
  | { playoffId: number; kind: "court"; category: string; value: number }
  | { playoffId: number; kind: "set"; category: string; side: "home" | "away"; set: number; value: number | null }

type Result = { ok: true } | { ok: false; error: string }

type ScheduleEntry = { timeslot: string | null; court: string | null }

function validScore(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
}

export async function updatePlayoffBoard(edit: PlayoffBoardEdit): Promise<Result> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Not authenticated" }
  if (user.realRole !== "super_admin") return { ok: false, error: "Admin access required" }

  const playoffId = Number(edit?.playoffId)
  if (!Number.isInteger(playoffId) || playoffId <= 0) return { ok: false, error: "Invalid fixture" }

  const result = await db.transaction(async (tx): Promise<Result> => {
    const [row] = await tx.select().from(playoffs).where(eq(playoffs.id, playoffId)).for("update").limit(1)
    if (!row) return { ok: false, error: "Playoff fixture not found" }

    if (edit.kind === "points") {
      if (!validScore(edit.value, 99)) return { ok: false, error: "Points must be a whole number" }
      await tx
        .update(playoffs)
        .set(edit.side === "home" ? { homeScore: edit.value } : { awayScore: edit.value })
        .where(eq(playoffs.id, playoffId))
      return { ok: true }
    }

    const category = String(edit.category ?? "").trim()
    if (!category) return { ok: false, error: "Missing category" }

    if (edit.kind === "set") {
      if (!Number.isInteger(edit.set) || edit.set < 0 || edit.set >= BOARD_SET_COUNT) {
        return { ok: false, error: "Invalid set" }
      }
      if (edit.value !== null && !validScore(edit.value, 99)) return { ok: false, error: "Invalid score" }
      const scores = { ...(row.categoryScores ?? {}) }
      const current = scores[category] ?? { home: [], away: [] }
      const next = { home: padSets(current.home), away: padSets(current.away) }
      next[edit.side][edit.set] = edit.value
      scores[category] = next
      await tx.update(playoffs).set({ categoryScores: scores }).where(eq(playoffs.id, playoffId))
      return { ok: true }
    }

    const schedule: Record<string, ScheduleEntry> = { ...(row.categorySchedule ?? {}) }
    const prev = schedule[category] ?? { timeslot: row.timeslot ?? null, court: null }
    let timeslot = prev.timeslot
    let court = prev.court
    if (edit.kind === "time") {
      const time = normalizeBoardTime(edit.value)
      if (!time) return { ok: false, error: "Enter a valid 24-hour time, e.g. 09:00" }
      timeslot = time
    } else {
      if (!validScore(edit.value, 99) || edit.value < 1) return { ok: false, error: "Enter a valid court number" }
      court = `Court ${edit.value}`
    }
    schedule[category] = { timeslot, court }

    if (timeslot && court) {
      const day = (d: Date | string | null) => (d ? new Date(d as string).toISOString().slice(0, 10) : "no-date")
      const siblings = await tx
        .select({
          id: playoffs.id,
          matchDate: playoffs.matchDate,
          bracketPosition: playoffs.bracketPosition,
          round: playoffs.round,
          categorySchedule: playoffs.categorySchedule,
        })
        .from(playoffs)
        .where(eq(playoffs.seasonId, row.seasonId))
      for (const sibling of siblings) {
        if (day(sibling.matchDate) !== day(row.matchDate)) continue
        for (const [otherCategory, entry] of Object.entries(sibling.categorySchedule ?? {})) {
          if (sibling.id === playoffId && otherCategory === category) continue
          if (entry?.timeslot === timeslot && parseCourtNumber(entry?.court) === parseCourtNumber(court)) {
            const where =
              sibling.id === playoffId
                ? `${otherCategory}`
                : `${sibling.round.replace("_", " ")} ${sibling.bracketPosition ?? ""} (${otherCategory})`
            return { ok: false, error: `${court} at ${timeslot} is already used by ${where.trim()}` }
          }
        }
      }
    }

    await tx.update(playoffs).set({ categorySchedule: schedule }).where(eq(playoffs.id, playoffId))
    return { ok: true }
  })

  if (result.ok) {
    revalidatePath("/league-centre")
    revalidatePath("/dashboard/league-centre")
    revalidatePath("/admin/playoffs")
    revalidateTag("league-centre-shared", "max")
  }
  return result
}

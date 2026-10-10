"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath, revalidateTag } from "next/cache"
import { db } from "@/lib/db"
import { playoffs, settings, teamEntries } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import {
  BOARD_SET_COUNT,
  LIVE_STAGE_SETTING_KEY,
  boardStageSupportsPlayers,
  showPlayersSettingKey,
  MAX_BOARD_PLAYER_NAME_LENGTH,
  MAX_BOARD_TITLE_LENGTH,
  isBoardStage,
  normalizeBoardTime,
  padSets,
  parseCourtNumber,
} from "@/lib/playoff-board"

export type PlayoffBoardEdit =
  | { playoffId: number; kind: "points"; side: "home" | "away"; value: number }
  | { playoffId: number; kind: "title"; value: string }
  | { playoffId: number; kind: "player"; category: string; side: "home" | "away"; slot: number; value: string }
  | { playoffId: number; kind: "team"; side: "home" | "away"; teamId: number | null }
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

    if (edit.kind === "title") {
      const title = String(edit.value ?? "").trim().slice(0, MAX_BOARD_TITLE_LENGTH)
      await tx
        .update(playoffs)
        .set({ boardConfig: { ...(row.boardConfig ?? {}), title: title || null } })
        .where(eq(playoffs.id, playoffId))
      return { ok: true }
    }

    if (edit.kind === "player") {
      if (edit.side !== "home" && edit.side !== "away") return { ok: false, error: "Invalid side" }
      if (typeof edit.category !== "string" || !edit.category || edit.category.length > 40) return { ok: false, error: "Invalid category" }
      if (edit.slot !== 0 && edit.slot !== 1) return { ok: false, error: "Invalid player slot" }
      const name = String(edit.value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_BOARD_PLAYER_NAME_LENGTH)
      const config = { ...(row.boardConfig ?? {}) }
      const allNames = { ...(config.playerNames ?? {}) }
      const entry = { ...(allNames[edit.category] ?? {}) }
      const sideNames: Array<string | null> = [entry[edit.side]?.[0] ?? null, entry[edit.side]?.[1] ?? null]
      sideNames[edit.slot] = name || null
      entry[edit.side] = sideNames
      if (entry.home?.every((n) => n == null)) delete entry.home
      if (entry.away?.every((n) => n == null)) delete entry.away
      if (entry.home || entry.away) allNames[edit.category] = entry
      else delete allNames[edit.category]
      config.playerNames = allNames
      await tx.update(playoffs).set({ boardConfig: config }).where(eq(playoffs.id, playoffId))
      return { ok: true }
    }

    if (edit.kind === "team") {
      if (edit.side !== "home" && edit.side !== "away") return { ok: false, error: "Invalid side" }
      const config = { ...(row.boardConfig ?? {}) }
      const hiddenKey = edit.side === "home" ? "homeHidden" : "awayHidden"
      if (edit.teamId === null) {
        config[hiddenKey] = true
        await tx.update(playoffs).set({ boardConfig: config }).where(eq(playoffs.id, playoffId))
        return { ok: true }
      }
      const teamId = Number(edit.teamId)
      if (!Number.isInteger(teamId) || teamId <= 0) return { ok: false, error: "Invalid team" }
      const [entry] = await tx
        .select({ teamId: teamEntries.teamId })
        .from(teamEntries)
        .where(and(eq(teamEntries.seasonId, row.seasonId), eq(teamEntries.teamId, teamId)))
        .limit(1)
      if (!entry) return { ok: false, error: "Selected team is not part of this season" }
      const otherId = edit.side === "home" ? row.awayTeamId : row.homeTeamId
      const otherHidden = Boolean(edit.side === "home" ? config.awayHidden : config.homeHidden)
      if (otherId === teamId && !otherHidden) return { ok: false, error: "That team is already in this match" }
      delete config[hiddenKey]
      const homeTeamId = edit.side === "home" ? teamId : row.homeTeamId
      const awayTeamId = edit.side === "away" ? teamId : row.awayTeamId
      await tx
        .update(playoffs)
        .set({
          ...(edit.side === "home" ? { homeTeamId: teamId } : { awayTeamId: teamId }),
          boardConfig: config,
          winnerTeamId: row.winnerTeamId != null && [homeTeamId, awayTeamId].includes(row.winnerTeamId) ? row.winnerTeamId : null,
        })
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

export async function setLivePlayoffStage(stage: string): Promise<Result> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Not authenticated" }
  if (user.realRole !== "super_admin") return { ok: false, error: "Admin access required" }
  if (!isBoardStage(stage)) return { ok: false, error: "Invalid stage" }
  await db
    .insert(settings)
    .values({ key: LIVE_STAGE_SETTING_KEY, value: stage })
    .onConflictDoUpdate({ target: settings.key, set: { value: stage, updatedAt: new Date() } })
  return { ok: true }
}

export async function setBoardShowPlayers(stage: string, show: boolean): Promise<Result> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Not authenticated" }
  if (user.realRole !== "super_admin") return { ok: false, error: "Admin access required" }
  if (!isBoardStage(stage) || !boardStageSupportsPlayers(stage)) return { ok: false, error: "Player names are only available for semi-finals and finals" }
  const value = show ? "true" : "false"
  await db
    .insert(settings)
    .values({ key: showPlayersSettingKey(stage), value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
  return { ok: true }
}

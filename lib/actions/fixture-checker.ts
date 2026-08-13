"use server"

import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { getAccessContext } from "@/lib/access"
import { revalidatePath } from "next/cache"

function normalizeCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
}

function entryKey(fixtureId: number, category: string) {
  return `${fixtureId}:${normalizeCategoryKey(category)}`
}

async function requireLeagueManagement() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Not authenticated")
  const access = await getAccessContext(me)
  if (!access.can("league_management")) throw new Error("League management access required")
}

export async function setFixtureCheckerPlayerJoined(input: {
  seasonId: number
  fixtureId: number
  category: string
  playerId: string
  joined: boolean
}) {
  await requireLeagueManagement()

  const key = `fixture_checker_state:${input.seasonId}`
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1)

  let state: Record<string, string[]> = {}
  try {
    const parsed = JSON.parse(row?.value ?? "{}")
    if (parsed && typeof parsed === "object") state = parsed as Record<string, string[]>
  } catch {
    state = {}
  }

  const itemKey = entryKey(input.fixtureId, input.category)
  const current = new Set(state[itemKey] ?? [])
  if (input.joined) current.add(input.playerId)
  else current.delete(input.playerId)
  state[itemKey] = [...current]

  if (row) {
    await db
      .update(settings)
      .set({ value: JSON.stringify(state), updatedAt: new Date() })
      .where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value: JSON.stringify(state), updatedAt: new Date() })
  }

  revalidatePath("/admin/seasons")
  return { ok: true as const }
}

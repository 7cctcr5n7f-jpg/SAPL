import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/session"
import { getPlayoffBoard } from "@/lib/queries-playoff-board"
import { PlayoffBoard } from "@/components/playoffs/playoff-board"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Playoffs Live Scoreboard | SAPL",
  description: "Live SAPL playoff scoreboard: quarter-final team points, set scores, times and courts.",
}

export default async function PlayoffsPage({ searchParams }: { searchParams: Promise<{ tv?: string }> }) {
  const { tv: tvParam } = await searchParams
  const tv = tvParam === "true" || tvParam === "1"
  const [user, data] = await Promise.all([getCurrentUser(), getPlayoffBoard()])
  const canEdit = !tv && user?.realRole === "super_admin"
  return <PlayoffBoard initial={data} canEdit={canEdit} tv={tv} />
}

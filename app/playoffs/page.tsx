import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/session"
import { getBoardTeamOptions, getPlayoffBoard } from "@/lib/queries-playoff-board"
import { isBoardStage } from "@/lib/playoff-board"
import { PlayoffBoard } from "@/components/playoffs/playoff-board"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Playoffs Live Scoreboard | SAPL",
  description: "Live SAPL playoff scoreboard: team points, set scores, times and courts.",
}

export default async function PlayoffsPage({ searchParams }: { searchParams: Promise<{ tv?: string; stage?: string }> }) {
  const { tv: tvParam, stage: stageParam } = await searchParams
  const tv = tvParam === "true" || tvParam === "1"
  const user = await getCurrentUser()
  const canEdit = !tv && user?.realRole === "super_admin"
  // Only admins can pick a stage to edit; TV and public views always follow the live stage.
  const data = await getPlayoffBoard(canEdit && isBoardStage(stageParam) ? stageParam : null)
  const teamOptions = canEdit && data.seasonId != null ? await getBoardTeamOptions(data.seasonId) : []
  return <PlayoffBoard initial={data} canEdit={canEdit} tv={tv} teamOptions={teamOptions} />
}

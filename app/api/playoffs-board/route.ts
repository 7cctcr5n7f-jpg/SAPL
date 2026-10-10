import { createHash } from "node:crypto"
import { getPlayoffBoard } from "@/lib/queries-playoff-board"
import { isBoardStage } from "@/lib/playoff-board"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const stage = new URL(request.url).searchParams.get("stage")
  const data = await getPlayoffBoard(isBoardStage(stage) ? stage : null)
  const body = JSON.stringify(data)
  const etag = `"${createHash("sha1").update(body).digest("hex")}"`
  const headers = { ETag: etag, "Cache-Control": "no-store" }
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers })
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } })
}

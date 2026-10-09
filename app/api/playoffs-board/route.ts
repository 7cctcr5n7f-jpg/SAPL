import { createHash } from "node:crypto"
import { getPlayoffBoard } from "@/lib/queries-playoff-board"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const data = await getPlayoffBoard()
  const body = JSON.stringify(data)
  const etag = `"${createHash("sha1").update(body).digest("hex")}"`
  const headers = { ETag: etag, "Cache-Control": "no-store" }
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers })
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } })
}

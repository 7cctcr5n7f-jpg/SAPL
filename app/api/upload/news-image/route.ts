import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"

const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"]

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me || (me.realRole !== "super_admin" && me.realRole !== "league_admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is larger than 8MB" }, { status: 400 })

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const blob = await put(`news/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] News image upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

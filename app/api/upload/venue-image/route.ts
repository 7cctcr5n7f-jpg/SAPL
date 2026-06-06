import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"

const MAX_BYTES = 6 * 1024 * 1024 // 6MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"]

export async function POST(request: NextRequest) {
  // Only authenticated admins/managers can upload venue images.
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is larger than 6MB" }, { status: 400 })
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const blob = await put(`venues/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] Venue image upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

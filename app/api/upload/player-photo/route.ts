import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const MAX_BYTES = 6 * 1024 * 1024 // 6MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"]

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
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
    const blob = await put(`player-photos/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
    })

    // Update user's avatarUrl in database
    if (me.isPlayer) {
      await db.update(userTable).set({ avatarUrl: blob.url }).where(eq(userTable.id, me.id))
    }

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] Player photo upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

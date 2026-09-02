import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { uploadImageToCloudinary } from "@/lib/cloudinary"

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

    const url = await uploadImageToCloudinary(file, "news")
    return NextResponse.json({ url })
  } catch (error) {
    console.error("[v0] News image upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

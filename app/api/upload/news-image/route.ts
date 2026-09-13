import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { uploadMediaToCloudinary } from "@/lib/cloudinary"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB
const ALLOWED_IMAGES = ["image/png", "image/jpeg", "image/webp"]
const ALLOWED_VIDEOS = ["video/mp4", "video/webm", "video/quicktime"]

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me || (me.realRole !== "super_admin" && me.realRole !== "league_admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    const isImage = ALLOWED_IMAGES.includes(file.type)
    const isVideo = ALLOWED_VIDEOS.includes(file.type)
    if (!isImage && !isVideo) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is larger than 8MB" }, { status: 400 })
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video is larger than 50MB" }, { status: 400 })
    }

    const url = await uploadMediaToCloudinary(file, "news", isVideo ? "video" : "image")
    return NextResponse.json({ url })
  } catch (error) {
    console.error("[v0] News media upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

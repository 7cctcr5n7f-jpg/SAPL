import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { uploadImageToCloudinary } from "@/lib/cloudinary"

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

    const url = await uploadImageToCloudinary(file, "venues")
    return NextResponse.json({ url })
  } catch (error) {
    console.error("[v0] Venue image upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

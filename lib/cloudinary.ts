import "server-only"
import { v2 as cloudinary } from "cloudinary"

let configured = false

function ensureCloudinaryConfigured() {
  if (configured) return
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.")
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  configured = true
}

export async function uploadImageToCloudinary(file: File, folder: string): Promise<string> {
  ensureCloudinaryConfigured()
  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString("base64")
  const dataUri = `data:${file.type};base64,${base64}`
  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    unique_filename: true,
    overwrite: false,
    invalidate: false,
  })
  if (!uploaded.secure_url) {
    throw new Error("Cloudinary upload failed: missing secure URL.")
  }
  return uploaded.secure_url
}

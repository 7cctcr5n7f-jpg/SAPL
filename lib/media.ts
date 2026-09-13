const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"]

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (VIDEO_EXTENSIONS.some((ext) => lower.includes(ext))) return true
  return lower.includes("/video/upload/")
}

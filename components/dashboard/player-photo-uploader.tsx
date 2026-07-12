"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Upload, Loader2, Crown } from "lucide-react"
import { toast } from "sonner"

export function PlayerPhotoUploader({
  value,
  onChange,
  isCapitan = false,
}: {
  value?: string | null
  onChange: (url: string) => void
  isCapitan?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please choose a PNG, JPG or WEBP image")
      return
    }
    uploadFile(file)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/player-photo", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      onChange(data.url)
      toast.success("Photo updated")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative w-24 h-24 group">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={pickFile}
        disabled={uploading}
      />

      {/* Circle Photo */}
      <div className="w-full h-full rounded-full border-4 border-primary/20 bg-secondary/20 flex items-center justify-center overflow-hidden relative transition-opacity group-hover:opacity-75 cursor-pointer"
        onClick={() => !uploading && fileRef.current?.click()}
      >
        {value ? (
          <Image
            src={value}
            alt="Player photo"
            width={96}
            height={96}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="text-4xl">👤</div>
        )}

        {/* Upload Indicator (shows on hover) */}
        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
          <Upload className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Loading Spinner */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}

        {/* Captain Badge - bottom right */}
        {isCapitan && (
          <div className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 border-2 border-background shadow-lg">
            <Crown className="h-4 w-4 text-background" />
          </div>
        )}
      </div>
    </div>
  )
}

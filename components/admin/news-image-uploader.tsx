"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImageIcon, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function NewsImageUploader({
  value,
  onChange,
}: {
  value: string
  onChange: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload/news-image", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      onChange(data.url)
      toast.success("Image uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please choose a PNG, JPG, or WEBP image")
      e.target.value = ""
      return
    }
    uploadFile(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onPickFile}
      />
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
          {value ? (
            <Image src={value} alt="Article image preview" width={144} height={80} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {value ? "Replace image" : "Upload image"}
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => onChange("")}>
              <X className="h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

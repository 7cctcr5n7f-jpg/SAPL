"use client"

import { useCallback, useRef, useState } from "react"
import Cropper from "react-easy-crop"
import Image from "next/image"
import { Building2, Upload, Crop as CropIcon, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getCroppedBlob, type CropPixels } from "@/lib/crop-image"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Aspect = { key: string; label: string; ratio: number; out: [number, number] }

const ASPECTS: Aspect[] = [
  { key: "square", label: "Square", ratio: 1, out: [600, 600] },
  { key: "wide", label: "Wide", ratio: 16 / 9, out: [960, 540] },
]

export function VenueImageUploader({
  value,
  onChange,
}: {
  value: string
  onChange: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<string | null>(null) // local object URL being edited
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [aspect, setAspect] = useState<Aspect>(ASPECTS[0])
  const [stretch, setStretch] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropPixels | null>(null)

  const onCropComplete = useCallback((_: unknown, areaPixels: CropPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please choose a PNG, JPG or WEBP image")
      return
    }
    const url = URL.createObjectURL(file)
    setSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setStretch(false)
    setEditing(true)
    e.target.value = ""
  }

  function cancelEdit() {
    if (src) URL.revokeObjectURL(src)
    setSrc(null)
    setEditing(false)
  }

  async function save() {
    if (!src) return
    setUploading(true)
    try {
      const [w, h] = aspect.out
      const blob = await getCroppedBlob(src, stretch ? "stretch" : "crop", croppedAreaPixels, w, h)
      const fd = new FormData()
      fd.append("file", new File([blob], "venue.png", { type: "image/png" }))
      const res = await fetch("/api/upload/venue-image", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      onChange(data.url)
      toast.success("Image uploaded")
      cancelEdit()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={pickFile}
      />

      {/* Current image + actions */}
      {!editing && (
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
            {value ? (
              <Image src={value || "/placeholder.svg"} alt="Venue image" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {value ? "Replace image" : "Upload image"}
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => onChange("")}>
                <X className="h-4 w-4" /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Editor */}
      {editing && src && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          {/* Preview / crop frame — this is exactly what gets saved */}
          <div
            className="relative mx-auto w-full overflow-hidden rounded-md bg-black/40"
            style={{ aspectRatio: String(aspect.ratio), maxWidth: aspect.ratio === 1 ? 320 : 480 }}
          >
            {stretch ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src || "/placeholder.svg"} alt="Stretched preview" className="h-full w-full" style={{ objectFit: "fill" }} />
            ) : (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect.ratio}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid
              />
            )}
          </div>

          <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            Preview of the saved image
          </p>

          {/* Aspect ratio */}
          <div className="flex items-center justify-center gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAspect(a)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  aspect.key === a.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Zoom (disabled in stretch mode) */}
          <div className={cn("space-y-1", stretch && "opacity-40")}>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Zoom</Label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={stretch}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-primary"
              aria-label="Zoom"
            />
          </div>

          {/* Stretch toggle */}
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Stretch to fill</p>
              <p className="text-xs text-muted-foreground">Fit the whole image into the frame, ignoring proportions</p>
            </div>
            <Switch checked={stretch} onCheckedChange={setStretch} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={uploading}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={save} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CropIcon className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Save image"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

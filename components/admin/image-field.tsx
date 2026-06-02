'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2 } from 'lucide-react'

export function ImageField({
  label,
  name,
  defaultValue = '',
}: {
  label: string
  name: string
  defaultValue?: string
}) {
  const [url, setUrl] = useState(defaultValue)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-light-grey">{label}</span>
      <input type="hidden" name={name} value={url} readOnly />
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-steel bg-background">
            <Image src={url || '/placeholder.svg'} alt="" fill sizes="64px" className="object-cover" />
            <button
              type="button"
              onClick={() => setUrl('')}
              aria-label="Remove image"
              className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-foreground hover:bg-black"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-md border border-steel bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-neon-blue disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? 'Uploading…' : url ? 'Replace photo' : 'Upload photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  )
}

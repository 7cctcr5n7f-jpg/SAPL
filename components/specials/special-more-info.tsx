'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Info, X } from 'lucide-react'

export function SpecialMoreInfo({
  imageUrl,
  title,
}: {
  imageUrl: string
  title: string
}) {
  const [open, setOpen] = useState(false)
  if (!imageUrl) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neon-green/70 bg-neon-green/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-neon-green transition-colors hover:bg-neon-green hover:text-background"
      >
        <Info className="size-3.5" /> More info
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} details`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-neon-green/70 bg-card green-glow"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/70 text-foreground transition-colors hover:bg-black"
            >
              <X className="size-5" />
            </button>
            <div className="relative max-h-[90vh] w-full">
              <Image
                src={imageUrl || '/placeholder.svg'}
                alt={`${title} details`}
                width={1200}
                height={1200}
                sizes="(max-width: 768px) 100vw, 672px"
                className="h-auto max-h-[90vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

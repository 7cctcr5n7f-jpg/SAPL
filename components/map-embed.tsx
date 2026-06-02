'use client'

import { useState } from 'react'
import Image from 'next/image'
import { MapPin } from 'lucide-react'

/**
 * Click-to-load Google Maps facade.
 * - Initial render shows a lightweight, optimized preview image (no Google Maps).
 * - The interactive iframe is only injected after the user clicks, keeping
 *   Google Maps off the critical path and out of LCP / initial payload.
 */
export function MapEmbed({
  src,
  title,
  previewImage = '/gym-exterior-night.jpg',
}: {
  src: string
  title: string
  previewImage?: string
}) {
  const [loaded, setLoaded] = useState(false)

  if (loaded) {
    return (
      <iframe
        title={title}
        src={src}
        className="h-full min-h-64 w-full grayscale sm:min-h-80"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      aria-label="Load interactive map"
      className="group relative h-full min-h-64 w-full overflow-hidden sm:min-h-80"
    >
      <Image
        src={previewImage}
        alt="TENROUNDS gym exterior in Garsfontein, Pretoria East"
        fill
        sizes="(max-width: 1024px) 100vw, 55vw"
        className="object-cover grayscale transition-transform duration-500 group-hover:scale-105"
      />
      <span className="absolute inset-0 bg-black/55 transition-colors group-hover:bg-black/45" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-full bg-neon-blue text-background shadow-lg transition-transform group-hover:scale-110">
          <MapPin className="size-6" />
        </span>
        <span className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
          Load Interactive Map
        </span>
      </span>
    </button>
  )
}

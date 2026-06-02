'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { galleryImages, galleryCategories, type GalleryImage } from '@/lib/gallery'

type Filter = 'All' | (typeof galleryCategories)[number]

const filters: Filter[] = ['All', ...galleryCategories]

export function GalleryGrid() {
  const [active, setActive] = useState<Filter>('All')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const visible: GalleryImage[] =
    active === 'All'
      ? galleryImages
      : galleryImages.filter((img) => img.category === active)

  const close = useCallback(() => setLightbox(null), [])
  const next = useCallback(
    () => setLightbox((i) => (i === null ? i : (i + 1) % visible.length)),
    [visible.length],
  )
  const prev = useCallback(
    () => setLightbox((i) => (i === null ? i : (i - 1 + visible.length) % visible.length)),
    [visible.length],
  )

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, close, next, prev])

  const current = lightbox === null ? null : visible[lightbox]

  return (
    <div>
      {/* filter chips */}
      <div className="mb-6 flex flex-wrap justify-center gap-2 sm:mb-10 sm:gap-3">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActive(f)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:px-5 sm:py-2 sm:text-sm',
              active === f
                ? 'border-neon-blue bg-cobalt text-accent-foreground'
                : 'border-steel text-light-grey hover:border-neon-blue hover:text-foreground',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* masonry grid */}
      <div className="columns-2 gap-3 sm:gap-4 lg:columns-3 [&>*]:mb-3 sm:[&>*]:mb-4">
        {visible.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setLightbox(i)}
            className="group relative block w-full break-inside-avoid overflow-hidden rounded-xl border border-steel/60 bg-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue"
            aria-label={`View image: ${img.alt}`}
          >
            <Image
              src={img.src || '/placeholder.svg'}
              alt={img.alt}
              width={800}
              height={1000}
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="absolute bottom-3 left-3 right-3 translate-y-2 text-left text-xs font-medium uppercase tracking-wide text-light-grey opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              {img.category}
            </span>
          </button>
        ))}
      </div>

      {/* lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-full border border-steel bg-black/50 p-2 text-foreground transition-colors hover:bg-cobalt"
            aria-label="Close"
          >
            <X className="size-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            className="absolute left-4 rounded-full border border-steel bg-black/50 p-2 text-foreground transition-colors hover:bg-cobalt md:left-8"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-steel bg-black/50 p-2 text-foreground transition-colors hover:bg-cobalt md:right-8"
            aria-label="Next image"
          >
            <ChevronRight className="size-6" />
          </button>

          <figure
            className="relative max-h-[85vh] w-auto max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={current.src || '/placeholder.svg'}
              alt={current.alt}
              width={1400}
              height={1750}
              className="h-auto max-h-[85vh] w-auto rounded-lg object-contain"
            />
            <figcaption className="mt-3 text-center text-sm text-light-grey">
              {current.alt}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}

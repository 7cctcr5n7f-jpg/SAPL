"use client"

import { useMemo, useRef, useState } from "react"
import Image from "next/image"

export function ArticleImageCarousel({
  featuredImage,
  featuredImageAlt,
  title,
  galleryImages,
}: {
  featuredImage: string | null
  featuredImageAlt: string | null
  title: string
  galleryImages: string[]
}) {
  const images = useMemo(() => {
    const merged = [featuredImage, ...galleryImages]
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      .filter((url, index, arr) => arr.indexOf(url) === index)
    return merged
  }, [featuredImage, galleryImages])

  const [activeIndex, setActiveIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  function goTo(index: number) {
    const track = trackRef.current
    if (!track) return
    const next = Math.max(0, Math.min(images.length - 1, index))
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" })
    setActiveIndex(next)
  }

  if (!images.length) return null

  return (
    <div className="space-y-3">
      <div
        ref={trackRef}
        className="relative flex snap-x snap-mandatory overflow-x-auto bg-black"
        onScroll={(event) => {
          const element = event.currentTarget
          const nextIndex = Math.round(element.scrollLeft / Math.max(1, element.clientWidth))
          if (nextIndex !== activeIndex) setActiveIndex(nextIndex)
        }}
      >
        {images.map((url) => (
          <div key={url} className="relative aspect-[16/9] w-full shrink-0 snap-center bg-black">
            <Image src={url} alt={featuredImageAlt || title} fill className="object-contain" />
          </div>
        ))}
        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-white hover:bg-black/70"
              onClick={() => goTo(activeIndex - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-white hover:bg-black/70"
              onClick={() => goTo(activeIndex + 1)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex items-center justify-center gap-2 pb-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to image ${index + 1}`}
              className={`h-2.5 w-2.5 rounded-full ${index === activeIndex ? "bg-white" : "bg-white/35"}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

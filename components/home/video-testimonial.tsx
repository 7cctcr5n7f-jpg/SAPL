'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'

/**
 * Self-hosted testimonial video with a poster + click-to-play facade.
 * - No iframe, no third-party (Facebook) scripts.
 * - preload="none" so the ~1.7MB MP4 is NOT downloaded until the user clicks play.
 * - The poster uses next/image (optimized AVIF/WebP) to keep the initial paint light.
 */
export function VideoTestimonial() {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handlePlay() {
    setPlaying(true)
    // Wait for the <video> to mount, then start playback.
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        /* user can press the native control if autoplay is blocked */
      })
    })
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-steel bg-background p-6">
      <p className="text-center font-display text-lg font-bold uppercase tracking-tight text-foreground">
        Watch Izelle&apos;s Story
      </p>

      <div className="relative mx-auto aspect-[9/16] w-full max-w-[267px] overflow-hidden rounded-lg bg-charcoal">
        {playing ? (
          <video
            ref={videoRef}
            src="/testimonial-member.mp4"
            poster="/izelle-theron-transformation.jpg"
            controls
            playsInline
            preload="none"
            className="absolute inset-0 size-full object-cover"
          >
            <track kind="captions" />
          </video>
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            aria-label="Play Izelle's transformation testimonial video"
            className="group absolute inset-0 size-full"
          >
            <Image
              src="/izelle-theron-transformation.jpg"
              alt="Izelle Theron, a TENROUNDS member who lost 15kg, before her video testimonial"
              fill
              sizes="267px"
              className="object-cover object-top"
            />
            <span className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
            <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neon-blue text-background shadow-lg transition-transform group-hover:scale-110">
              <Play className="ml-1 size-7 fill-current" />
            </span>
          </button>
        )}
      </div>

      <a
        href="https://www.facebook.com/reel/913669278115712/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs uppercase tracking-wider text-light-grey underline-offset-4 transition-colors hover:text-neon-blue hover:underline"
      >
        View original post
      </a>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { ClientSpecial } from './types'

function dismissKey(s: ClientSpecial) {
  return `tr_special_dismissed_${s.id}_${s.version}`
}

export function SpecialPopup({ special }: { special: ClientSpecial | null }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!special) return
    // Don't re-show a special this visitor already dismissed (same version).
    try {
      if (localStorage.getItem(dismissKey(special))) return
    } catch {
      // ignore storage errors (private mode etc.)
    }

    let triggered = false
    const trigger = () => {
      if (triggered) return
      triggered = true
      setOpen(true)
      cleanup()
    }

    // 1) Show after the visitor scrolls past 50% of the page.
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable <= 0) return
      if (window.scrollY / scrollable >= 0.5) trigger()
    }

    // 2) Show on exit intent (pointer leaves through the top of the viewport).
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger()
    }

    function cleanup() {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onMouseOut)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('mouseout', onMouseOut)
    return cleanup
  }, [special])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!special) return null

  function close() {
    try {
      localStorage.setItem(dismissKey(special!), '1')
    } catch {
      // ignore
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={special.title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neon-blue/50 bg-card blue-glow">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-foreground transition-colors hover:bg-black/70"
        >
          <X className="size-5" />
        </button>

        {special.imageUrl ? (
          <div className="relative h-44 w-full">
            <Image src={special.imageUrl || '/placeholder.svg'} alt="" fill className="object-cover" sizes="448px" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          </div>
        ) : null}

        <div className="p-7">
          {special.badge ? (
            <span className="inline-flex items-center rounded-full border border-neon-blue/50 bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neon-blue">
              {special.badge}
            </span>
          ) : null}
          <h2 className="mt-4 font-display text-3xl font-black uppercase leading-none tracking-tight text-balance">
            {special.title}
          </h2>
          {special.description ? (
            <p className="mt-3 text-pretty leading-relaxed text-light-grey">{special.description}</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2">
            {special.ctaHref ? (
              <Link
                href={special.ctaHref}
                onClick={close}
                className="rounded-md bg-neon-blue px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-accent-foreground transition-transform hover:scale-[1.02]"
              >
                {special.ctaLabel || 'Learn More'}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={close}
              className="text-center text-xs font-semibold uppercase tracking-wide text-light-grey transition-colors hover:text-foreground"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

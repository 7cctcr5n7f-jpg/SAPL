'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Click-to-open Jotform lightbox.
 *
 * The heavy Jotform iframe (~1.7MB of third-party JS) is NOT loaded on page
 * load — it is only mounted once the user opens the modal, which keeps LCP fast.
 * If no formId is supplied, the in-app fallback form is rendered inline instead.
 */
export function JotformLightbox({
  formId,
  title,
  triggerLabel,
  triggerHint,
  fallback,
}: {
  formId?: string
  title: string
  triggerLabel: string
  triggerHint?: string
  fallback: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!formId) {
    return <>{fallback}</>
  }

  return (
    <>
      {/* Warm up Jotform origins so the iframe connects fast the moment it opens. */}
      <link rel="preconnect" href="https://form.jotform.com" />
      <link rel="dns-prefetch" href="https://cdn.jotfor.ms" />

      {/* Trigger panel — sits where the embed used to be */}
      <div className="flex flex-col items-start gap-5 rounded-2xl border border-steel bg-card p-8 text-left">
        <span className="font-display text-2xl font-bold uppercase leading-tight tracking-tight text-foreground text-balance">
          {title}
        </span>
        {triggerHint ? (
          <p className="text-sm leading-relaxed text-light-grey">{triggerHint}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md bg-cobalt px-7 py-4 font-display text-base font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
        >
          {triggerLabel}
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
        >
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close form"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          {/* dialog panel */}
          <div className="relative z-10 flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-steel bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-steel px-5 py-3">
              <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                {title}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close form"
                className="flex size-9 items-center justify-center rounded-md text-light-grey transition-colors hover:bg-charcoal hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <iframe
              title={title}
              src={`https://form.jotform.com/${formId}`}
              className="h-full w-full flex-1 bg-card"
              allow="geolocation; microphone; camera"
              scrolling="auto"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

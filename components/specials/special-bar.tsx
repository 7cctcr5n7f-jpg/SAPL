'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { ClientSpecial } from './types'

function dismissKey(s: ClientSpecial) {
  return `tr_bar_dismissed_${s.id}_${s.version}`
}

export function SpecialBar({ special }: { special: ClientSpecial | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!special) return
    try {
      if (!localStorage.getItem(dismissKey(special))) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [special])

  if (!special || !visible) return null

  function close() {
    try {
      localStorage.setItem(dismissKey(special!), '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <div className="relative z-50 bg-neon-blue text-accent-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-10 py-2.5 text-center">
        <p className="text-sm font-semibold">
          {special.badge ? <span className="font-black uppercase tracking-wide">{special.badge}: </span> : null}
          {special.title}
          {special.ctaHref ? (
            <Link href={special.ctaHref} className="ml-2 inline underline underline-offset-2 hover:opacity-80">
              {special.ctaLabel || 'Learn more'}
            </Link>
          ) : null}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss announcement"
          className="absolute right-3 flex size-7 items-center justify-center rounded-full transition-colors hover:bg-black/15"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Download, ArrowRight, PartyPopper, Gift } from 'lucide-react'

const UPTIVO_LINK = 'https://uptivo.page.link/XX5n'

export function SessionSuccess({
  firstName,
  unitLabel,
  totalSessions,
  bonusSessions,
}: {
  firstName?: string
  unitLabel?: string
  totalSessions?: number
  bonusSessions?: number
}) {
  const [qr, setQr] = useState('')

  useEffect(() => {
    QRCode.toDataURL(UPTIVO_LINK, {
      margin: 1,
      width: 320,
      color: { dark: '#0a0e14', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(''))
  }, [])

  const hasBonus = (bonusSessions ?? 0) > 0

  return (
    <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-8 text-center blue-glow sm:p-12">
      <span className="flex size-16 items-center justify-center rounded-full bg-neon-green/15 text-neon-green ring-1 ring-neon-green/50">
        <PartyPopper className="size-8" />
      </span>
      <p className="mt-5 font-display text-sm font-bold uppercase tracking-[0.3em] text-neon-blue">Payment Complete</p>
      <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
        {firstName ? `Thanks ${firstName}!` : 'Thank You!'}
      </h2>

      {unitLabel ? (
        <div className="mt-5 w-full rounded-xl border border-steel bg-background/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-light-grey">You Purchased</p>
          <p className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-foreground">{unitLabel}</p>
          {hasBonus ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-neon-green/15 px-3 py-1 text-sm font-semibold text-neon-green">
              <Gift className="size-4" /> {totalSessions} total sessions (incl. {bonusSessions} free)
            </p>
          ) : totalSessions ? (
            <p className="mt-2 text-sm text-light-grey">{totalSessions} sessions loaded and ready</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 max-w-md space-y-3 text-sm leading-relaxed text-light-grey">
        <p>Your sessions are loaded and ready to use at the club. We&apos;ve emailed your receipt and agreement.</p>
        <p>
          Save time and scan below to download the TENROUNDS app so we can assign a heart rate monitor to your profile
          before arrival.
        </p>
      </div>

      {qr ? (
        <div className="mt-6 rounded-2xl border border-steel bg-background p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr || '/placeholder.svg'} alt="QR code to download the TENROUNDS app" width={160} height={160} className="size-40 rounded-lg" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-light-grey">Scan to download</p>
        </div>
      ) : null}

      <a
        href={UPTIVO_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex items-center gap-2 rounded-md bg-cobalt px-7 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
      >
        <Download className="size-4" /> Download App
      </a>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-steel px-7 py-3 font-display text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-neon-blue hover:text-neon-blue"
      >
        Return Home <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

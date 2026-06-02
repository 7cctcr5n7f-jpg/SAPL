'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Download, ArrowRight, PartyPopper } from 'lucide-react'

const UPTIVO_LINK = 'https://uptivo.page.link/XX5n'

export function SuccessScreen({ firstName }: { firstName?: string }) {
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

  return (
    <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-8 text-center blue-glow sm:p-12">
      <span className="flex size-16 items-center justify-center rounded-full bg-neon-green/15 text-neon-green ring-1 ring-neon-green/50">
        <PartyPopper className="size-8" />
      </span>
      <p className="mt-5 font-display text-sm font-bold uppercase tracking-[0.3em] text-neon-blue">Get. Set. Go.</p>
      <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
        {firstName ? `Welcome ${firstName},` : 'Welcome'} Tenrounder!
      </h2>
      <div className="mt-4 max-w-md space-y-3 text-sm leading-relaxed text-light-grey">
        <p>Rock up in your active gear, a bottle of water and leave the rest to us.</p>
        <p>
          Save time and click below to download the TENROUNDS app so we can assign a heart rate monitor to your profile
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

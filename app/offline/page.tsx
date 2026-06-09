import type { Metadata } from "next"
import Image from "next/image"
import { OfflineRetry } from "@/components/pwa/offline-retry"

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Image
        src="/icons/icon-192.png"
        alt="SAPL"
        width={96}
        height={96}
        className="h-24 w-24 rounded-2xl"
        priority
      />
      <div className="flex flex-col gap-2">
        <h1 className="heading text-3xl text-foreground">You&apos;re offline</h1>
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          SAPL can&apos;t reach the network right now. Check your connection — your fixtures, standings and rankings
          will load again as soon as you&apos;re back online.
        </p>
      </div>
      <OfflineRetry />
    </main>
  )
}

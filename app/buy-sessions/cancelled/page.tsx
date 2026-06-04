import type { Metadata } from 'next'
import Link from 'next/link'
import { XCircle, ArrowRight, RefreshCw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Payment Cancelled — TENROUNDS',
  description: 'Your TENROUNDS session purchase was cancelled.',
  robots: { index: false, follow: false },
}

export default async function CancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  const retryHref = ref ? '/buy-sessions' : '/memberships#sessions'

  return (
    <main className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-2xl px-5 lg:px-8">
        <div className="flex flex-col items-center rounded-2xl border border-steel bg-card p-8 text-center sm:p-12">
          <span className="flex size-16 items-center justify-center rounded-full bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/50">
            <XCircle className="size-8" />
          </span>
          <h2 className="mt-5 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
            Payment Cancelled
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-light-grey">
            No payment was taken and nothing was charged. You can pick up where you left off whenever you&apos;re ready.
          </p>

          <Link
            href={retryHref}
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-cobalt px-7 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
          >
            <RefreshCw className="size-4" /> Try Again
          </Link>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-steel px-7 py-3 font-display text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-neon-blue hover:text-neon-blue"
          >
            Return Home <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}

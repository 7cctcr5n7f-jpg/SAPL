import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { BuySessionsForm, type PackSelection } from '@/components/forms/buy-sessions-form'
import { resolveSessionPack } from '@/lib/content-queries'
import { sessionPacks } from '@/lib/memberships'

export const metadata: Metadata = {
  title: 'Buy Sessions — TENROUNDS',
  description:
    'Purchase a TENROUNDS session pack online and pay securely. No monthly commitment — train on your own terms.',
  alternates: { canonical: '/buy-sessions' },
  robots: { index: false, follow: false },
}

export default async function BuySessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>
}) {
  const params = await searchParams
  const requested = Number(params.pack)
  const fallback = sessionPacks.find((p) => p.popular) ?? sessionPacks[0]
  const quantity = sessionPacks.some((p) => p.quantity === requested) ? requested : fallback.quantity

  const resolved = await resolveSessionPack(quantity)

  if (!resolved) {
    return (
      <main>
        <PageHero
          eyebrow="Buy Sessions"
          title="Pack Unavailable"
          description="That session pack could not be found. Please choose another from our pricing."
          image="/strength-training.png"
          imageAlt="Athlete training at TENROUNDS"
        />
        <section className="bg-background py-20 text-center">
          <Link
            href="/memberships#sessions"
            className="inline-flex items-center gap-2 rounded-md bg-cobalt px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
          >
            <ArrowLeft className="size-4" /> Back To Session Packs
          </Link>
        </section>
      </main>
    )
  }

  const pack: PackSelection = {
    quantity: resolved.quantity,
    unitLabel: resolved.unitLabel,
    baseAmount: resolved.baseAmount,
    amount: resolved.amount,
    bonusSessions: resolved.bonusSessions,
    totalSessions: resolved.totalSessions,
    specialTitle: resolved.special?.title ?? '',
  }

  return (
    <main>
      <PageHero
        eyebrow="Buy Sessions"
        title="Secure Your Session Pack"
        description="Complete your details, accept the terms and pay securely online. Your sessions are loaded and ready to use at the club."
        image="/strength-training.png"
        imageAlt="Athlete training at TENROUNDS"
      />

      <section className="bg-background pb-20 pt-12 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <BuySessionsForm pack={pack} />
        </div>
      </section>
    </main>
  )
}

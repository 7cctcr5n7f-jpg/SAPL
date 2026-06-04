import type { Metadata } from 'next'
import { getSessionPurchase } from '@/lib/content-queries'
import { SessionSuccess } from '@/components/forms/session-success'

export const metadata: Metadata = {
  title: 'Purchase Complete — TENROUNDS',
  description: 'Your TENROUNDS session pack purchase is complete.',
  robots: { index: false, follow: false },
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  const id = Number(ref)
  const purchase = Number.isFinite(id) && id > 0 ? await getSessionPurchase(id) : null

  return (
    <main className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-2xl px-5 lg:px-8">
        <SessionSuccess
          firstName={purchase?.firstName}
          unitLabel={purchase?.unitLabel}
          totalSessions={purchase?.totalSessions}
          bonusSessions={purchase?.bonusSessions}
        />
      </div>
    </main>
  )
}

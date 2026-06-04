import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessionPurchases } from '@/lib/db/schema'
import { getSessionPurchase } from '@/lib/content-queries'
import { verifyItn } from '@/lib/payfast'
import { sendSessionPurchaseEmails } from '@/lib/session-emails'

export const dynamic = 'force-dynamic'

// PayFast Instant Transaction Notification (server-to-server). PayFast expects
// a 200 OK quickly; all verification happens before we mutate the record.
export async function POST(req: Request) {
  let rawBody = ''
  try {
    rawBody = await req.text()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Preserve field order exactly as posted (required for signature checks).
  const params = new URLSearchParams(rawBody)
  const pairs: [string, string][] = [...params.entries()]

  const host = req.headers.get('referer') || req.headers.get('host')

  const result = await verifyItn(pairs, rawBody, host)

  // Always 200 so PayFast does not endlessly retry; we just don't act on
  // unverified notifications.
  if (!result.valid || !result.paymentId) {
    console.warn('[v0] Ignoring invalid PayFast ITN', { paymentId: result.paymentId })
    return new NextResponse('OK', { status: 200 })
  }

  const purchase = await getSessionPurchase(result.paymentId)
  if (!purchase) {
    console.warn('[v0] PayFast ITN for unknown purchase', result.paymentId)
    return new NextResponse('OK', { status: 200 })
  }

  // Guard against amount tampering — the gross must match what we charged.
  const expected = Number(purchase.amount)
  if (Math.abs(expected - result.amountGross) > 0.01) {
    console.error('[v0] PayFast ITN amount mismatch', { expected, got: result.amountGross })
    return new NextResponse('OK', { status: 200 })
  }

  const status = result.paymentStatus.toUpperCase()

  // Only act on a COMPLETE payment, and only once (idempotent).
  if (status === 'COMPLETE') {
    if (purchase.paymentStatus === 'Paid') {
      return new NextResponse('OK', { status: 200 })
    }
    try {
      await db
        .update(sessionPurchases)
        .set({
          paymentStatus: 'Paid',
          pfPaymentId: result.pfPaymentId,
          paidAt: new Date(),
          confirmationSent: true,
        })
        .where(eq(sessionPurchases.id, purchase.id))
    } catch (err) {
      console.error('[v0] Failed to mark purchase paid:', err)
      return new NextResponse('OK', { status: 200 })
    }

    // Send confirmations + receipt (best-effort).
    try {
      const updated = await getSessionPurchase(purchase.id)
      if (updated) await sendSessionPurchaseEmails(updated)
    } catch (err) {
      console.error('[v0] Failed to send session purchase emails:', err)
    }
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    try {
      await db
        .update(sessionPurchases)
        .set({ paymentStatus: status === 'FAILED' ? 'Failed' : 'Cancelled', pfPaymentId: result.pfPaymentId })
        .where(eq(sessionPurchases.id, purchase.id))
    } catch (err) {
      console.error('[v0] Failed to update purchase status:', err)
    }
  }

  return new NextResponse('OK', { status: 200 })
}

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { payments } from "@/lib/db/schema"
import { verifyPayFastSignature } from "@/lib/payfast"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

/**
 * PayFast Instant Transaction Notification (ITN) endpoint.
 *
 * PayFast POSTs to this URL after every payment event. We:
 *  1. Parse the URL-encoded POST body.
 *  2. Verify the MD5 signature.
 *  3. Confirm payment_status === "COMPLETE" and find the matching payment row.
 *  4. Mark the payment as paid.
 *
 * PayFast expects a 200 OK with no body on success. Any other status is
 * treated as an error and PayFast will retry.
 */
export async function POST(req: NextRequest) {
  try {
    // PayFast sends application/x-www-form-urlencoded
    const text = await req.text()
    const params = Object.fromEntries(new URLSearchParams(text))

    // Verify the MD5 signature.
    if (!verifyPayFastSignature(params)) {
      console.error("[PayFast ITN] Invalid signature", { params })
      return new NextResponse("Invalid signature", { status: 400 })
    }

    const { payment_status, m_payment_id, amount_gross } = params

    if (payment_status !== "COMPLETE") {
      // Not a completed payment — log and return 200 so PayFast stops retrying.
      console.log("[PayFast ITN] Non-complete status received:", payment_status)
      return new NextResponse("OK", { status: 200 })
    }

    if (!m_payment_id) {
      console.error("[PayFast ITN] Missing m_payment_id")
      return new NextResponse("Missing m_payment_id", { status: 400 })
    }

    // Find the payment by our reference field.
    const [pay] = await db
      .select({ id: payments.id, status: payments.status, amount: payments.amount, vatAmount: payments.vatAmount })
      .from(payments)
      .where(eq(payments.reference, m_payment_id))
      .limit(1)

    if (!pay) {
      console.error("[PayFast ITN] Payment not found for reference:", m_payment_id)
      // Return 200 so PayFast doesn't keep retrying for a reference we don't recognise.
      return new NextResponse("OK", { status: 200 })
    }

    if (pay.status === "paid") {
      // Already marked paid (duplicate ITN) — idempotent, return 200.
      return new NextResponse("OK", { status: 200 })
    }

    // Verify the amount matches to prevent amount tampering.
    // The payments table stores ex-VAT (amount) + vatAmount; their sum is the
    // VAT-inclusive total that was passed to PayFast as the charge amount.
    const received = parseFloat(amount_gross ?? "0")
    const storedTotal = pay.amount + pay.vatAmount
    if (Math.abs(received - storedTotal) > 0.01) {
      console.error("[PayFast ITN] Amount mismatch", { received, storedTotal, reference: m_payment_id })
      return new NextResponse("Amount mismatch", { status: 400 })
    }

    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payments.id, pay.id))

    // Revalidate the dashboard and admin billing so UI updates on next load.
    revalidatePath("/dashboard")
    revalidatePath("/admin/billing")

    console.log("[PayFast ITN] Payment marked paid:", m_payment_id)
    return new NextResponse("OK", { status: 200 })
  } catch (err) {
    console.error("[PayFast ITN] Unexpected error:", err)
    return new NextResponse("Internal error", { status: 500 })
  }
}

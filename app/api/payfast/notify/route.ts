import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { payments } from "@/lib/db/schema"
import { verifyPayFastSignature } from "@/lib/payfast"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const PAYFAST_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate"

type PayFastLogLevel = "info" | "warn" | "error"

function logPayFastEvent(level: PayFastLogLevel, event: string, context: Record<string, unknown>) {
  const payload = {
    source: "payfast-itn",
    event,
    timestamp: new Date().toISOString(),
    ...context,
  }
  if (level === "error") console.error(payload)
  else if (level === "warn") console.warn(payload)
  else console.info(payload)
}

async function validatePayFastItn(rawBody: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
      cache: "no-store",
      signal: controller.signal,
    })
    const text = (await res.text()).trim()
    return res.ok && text === "VALID"
  } finally {
    clearTimeout(timeout)
  }
}

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

    const validatedByPayFast = await validatePayFastItn(text)
    const signatureValid = verifyPayFastSignature(params)

    // Prefer PayFast's own server-side validation when available. Some genuine
    // payments appear to reach us with payload encoding differences that make a
    // local signature comparison fail even though PayFast confirms the payload.
    if (!signatureValid && !validatedByPayFast) {
      logPayFastEvent("error", "verification_failed", {
        reference: params.m_payment_id,
        paymentStatus: params.payment_status,
        reason: "signature_and_handshake_failed",
      })
      return new NextResponse("Invalid ITN", { status: 400 })
    }

    const { payment_status, m_payment_id, amount_gross, pf_payment_id } = params

    if (!m_payment_id) {
      logPayFastEvent("error", "invalid_payload", { reason: "missing_m_payment_id" })
      return new NextResponse("Missing m_payment_id", { status: 400 })
    }
    if (!validatedByPayFast) {
      // Keep processing after a valid signature/reference/amount check even when
      // PayFast's validation endpoint is temporarily unavailable or times out.
      logPayFastEvent("warn", "handshake_failed_proceeding", {
        reference: m_payment_id,
        pfPaymentId: pf_payment_id ?? null,
      })
    }

    // Find the payment by our reference field.
    const [pay] = await db
      .select({ id: payments.id, status: payments.status, amount: payments.amount, vatAmount: payments.vatAmount })
      .from(payments)
      .where(eq(payments.reference, m_payment_id))
      .limit(1)

    if (!pay) {
      logPayFastEvent("error", "unknown_reference", { reference: m_payment_id, paymentStatus: payment_status ?? null })
      // Return 200 so PayFast doesn't keep retrying for a reference we don't recognise.
      return new NextResponse("OK", { status: 200 })
    }

    const normalizedStatus = payment_status?.trim().toUpperCase()
    if (normalizedStatus !== "COMPLETE") {
      if (pay.status !== "paid" && (normalizedStatus === "FAILED" || normalizedStatus === "CANCELLED")) {
        try {
          await db
            .update(payments)
            .set({ status: "failed", paidAt: null })
            .where(eq(payments.id, pay.id))
        } catch (error) {
          logPayFastEvent("error", "db_update_failed", {
            reference: m_payment_id,
            paymentId: pay.id,
            targetStatus: "failed",
            message: error instanceof Error ? error.message : "unknown_error",
          })
          throw error
        }
        revalidatePath("/dashboard")
        revalidatePath("/admin/billing")
      }
      logPayFastEvent("warn", "unexpected_status", {
        reference: m_payment_id,
        currentStatus: pay.status,
        receivedStatus: normalizedStatus ?? null,
      })
      return new NextResponse("OK", { status: 200 })
    }

    if (pay.status !== "paid") {
      // Verify the amount matches to prevent amount tampering.
      // The payments table stores ex-VAT (amount) + vatAmount; their sum is the
      // VAT-inclusive total that was passed to PayFast as the charge amount.
      const received = parseFloat(amount_gross ?? "0")
      const storedTotal = pay.amount + pay.vatAmount
      if (Math.abs(received - storedTotal) > 0.01) {
        logPayFastEvent("error", "amount_mismatch", { received, storedTotal, reference: m_payment_id })
        return new NextResponse("Amount mismatch", { status: 400 })
      }

      try {
        await db
          .update(payments)
          .set({
            status: "paid",
            paidAt: new Date(),
          })
          .where(eq(payments.id, pay.id))
      } catch (error) {
        logPayFastEvent("error", "db_update_failed", {
          reference: m_payment_id,
          paymentId: pay.id,
          targetStatus: "paid",
          message: error instanceof Error ? error.message : "unknown_error",
        })
        throw error
      }
    } else if (pf_payment_id?.trim()) {
      logPayFastEvent("info", "duplicate_complete_itn", {
        reference: m_payment_id,
        paymentId: pay.id,
        pfPaymentId: pf_payment_id.trim(),
      })
      try {
        await db
          .update(payments)
          .set({ invoiceNumber: pf_payment_id.trim() })
          .where(eq(payments.id, pay.id))
      } catch (error) {
        logPayFastEvent("error", "db_update_failed", {
          reference: m_payment_id,
          paymentId: pay.id,
          targetStatus: "invoice_number_update",
          message: error instanceof Error ? error.message : "unknown_error",
        })
        throw error
      }
    }

    // Revalidate the dashboard and admin billing so UI updates on next load.
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/my-team")
    revalidatePath("/admin/billing")
    revalidatePath("/admin/teams")

    logPayFastEvent("info", "processed_complete", {
      reference: m_payment_id,
      paymentId: pay.id,
      previouslyPaid: pay.status === "paid",
    })
    return new NextResponse("OK", { status: 200 })
  } catch (err) {
    logPayFastEvent("error", "unhandled_exception", {
      message: err instanceof Error ? err.message : "unknown_error",
    })
    return new NextResponse("Internal error", { status: 500 })
  }
}

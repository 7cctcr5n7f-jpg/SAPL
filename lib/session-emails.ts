import 'server-only'

import { sendEmail } from '@/lib/email'
import { generateSessionPdf } from '@/lib/session-pdf'
import { formatRand } from '@/lib/memberships'
import { business } from '@/lib/business'
import type { SessionPurchase } from '@/lib/db/schema'

const UPTIVO_LINK = 'https://uptivo.page.link/XX5n'

// Send the member + TENROUNDS confirmation emails for a PAID session purchase,
// with the signed agreement/receipt PDF attached. Best-effort: a failure here
// must never roll back the payment.
export async function sendSessionPurchaseEmails(s: SessionPurchase): Promise<void> {
  const fullName = `${s.firstName} ${s.surname}`

  let pdfBase64: string | null = null
  try {
    const bytes = await generateSessionPdf(s)
    pdfBase64 = Buffer.from(bytes).toString('base64')
  } catch (err) {
    console.error('[v0] Failed to generate session PDF:', err)
  }

  const attachments = pdfBase64
    ? [{ filename: `TENROUNDS-Sessions-${fullName.replace(/\s+/g, '-')}.pdf`, content: pdfBase64 }]
    : undefined

  const sessionsLine =
    s.bonusSessions > 0
      ? `${s.packQuantity} + ${s.bonusSessions} free = ${s.totalSessions} sessions`
      : `${s.packQuantity} session${s.packQuantity === 1 ? '' : 's'}`

  // Email to the member.
  await sendEmail({
    to: s.email,
    subject: 'Your TENROUNDS Sessions Are Confirmed',
    replyTo: business.email,
    attachments,
    text: `Hi ${fullName},

Thank you for your purchase! We hereby confirm your ${s.unitLabel} at TENROUNDS.

WHAT YOU BOUGHT
${s.unitLabel} — ${sessionsLine}
Amount Paid: ${formatRand(s.amount)}${s.specialTitle ? `\nSpecial Applied: ${s.specialTitle}` : ''}

Your sessions are loaded and ready to use at the club. Rock up in your active gear, a bottle of water and leave the rest to us!

Save time and click on the link below, download the TENROUNDS app, so that we can assign a heart rate monitor to your profile before arrival.
${UPTIVO_LINK}

Your signed agreement and receipt are attached.

Looking forward to seeing you!!!

Kind regards,
TENROUNDS Team`,
  })

  // Email to TENROUNDS.
  await sendEmail({
    to: business.email,
    subject: 'New TENROUNDS Session Purchase',
    replyTo: s.email,
    attachments,
    text: `A new online session purchase has been paid via PayFast.

PURCHASE
${s.unitLabel} — ${sessionsLine}
Amount Paid: ${formatRand(s.amount)}${s.baseAmount > s.amount ? `\nStandard Price: ${formatRand(s.baseAmount)}` : ''}${
      s.specialTitle ? `\nSpecial Applied: ${s.specialTitle}` : ''
    }
PayFast Payment ID: ${s.pfPaymentId || '—'}

MEMBER
Name: ${fullName}
Email: ${s.email}
Contact: ${s.contactNumber}
ID Number: ${s.idNumber}
Emergency Contact: ${s.emergencyContactName} (${s.emergencyContactNumber})

The signed agreement and receipt PDF is attached.`,
  })
}

import 'server-only'

// Lightweight email sender using the Resend HTTP API directly (no SDK / no
// vendor lock-in beyond the API key). If RESEND_API_KEY is not configured the
// call is skipped gracefully so bookings still succeed.

type Attachment = {
  filename: string
  /** Base64-encoded file content. */
  content: string
}

type SendArgs = {
  to: string | string[]
  subject: string
  text: string
  replyTo?: string
  attachments?: Attachment[]
}

// Default to a verified TENROUNDS sender — never the Resend sandbox address.
// Override with EMAIL_FROM (e.g. "TENROUNDS <hello@tenrounds.co.za>").
const FROM = process.env.EMAIL_FROM || 'TENROUNDS <noreply@tenrounds.co.za>'

export async function sendEmail({ to, subject, text, replyTo, attachments }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[v0] RESEND_API_KEY not set — skipping email to', to)
    return { ok: false, error: 'email-not-configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments && attachments.length ? { attachments } : {}),
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[v0] Resend error', res.status, body)
      return { ok: false, error: `resend-${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[v0] Email send failed:', err)
    return { ok: false, error: 'send-failed' }
  }
}

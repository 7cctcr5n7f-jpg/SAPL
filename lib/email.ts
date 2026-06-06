import { Resend } from "resend"
import { BRAND } from "@/lib/constants"

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null

// Sender + reply-to use the verified SAPL domain mailbox. Override with
// RESEND_FROM if a different verified sender is ever configured.
export const ADMIN_EMAIL = "admin@southafricapadelleague.co.za"
const FROM = process.env.RESEND_FROM ?? `SAPL <${ADMIN_EMAIL}>`

type SendArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Sends an email via Resend. If no RESEND_API_KEY is configured, the email is
 * not sent — instead the content is logged so flows remain testable in preview.
 * Returns whether a real email was dispatched.
 */
export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<{ sent: boolean }> {
  if (!resend) {
    console.log("[v0] RESEND_API_KEY not set — email not sent. Preview only:", { to, subject })
    return { sent: false }
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html, text: text ?? "", replyTo: ADMIN_EMAIL })
    return { sent: true }
  } catch (err) {
    console.log("[v0] Resend send failed:", err instanceof Error ? err.message : err)
    return { sent: false }
  }
}

/** Branded password-reset email markup. */
export function resetPasswordEmail(url: string) {
  const subject = `Reset your ${BRAND.short} password`
  const html = `
  <div style="background:#0a0a0a;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;border-bottom:1px solid #262626;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:2px;">${BRAND.short}</span>
        <span style="color:#E10600;font-size:20px;font-weight:800;"> ●</span>
      </div>
      <div style="padding:32px;">
        <h1 style="color:#ffffff;font-size:22px;margin:0 0 12px;">Reset your password</h1>
        <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 24px;">
          We received a request to reset your ${BRAND.name} password. Click the button below to choose a new one. This link expires in 1 hour.
        </p>
        <a href="${url}" style="display:inline-block;background:#E10600;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
          Reset password
        </a>
        <p style="color:#737373;font-size:12px;line-height:1.6;margin:24px 0 0;">
          If you didn't request this, you can safely ignore this email. Or paste this link into your browser:<br/>
          <a href="${url}" style="color:#E10600;word-break:break-all;">${url}</a>
        </p>
      </div>
    </div>
  </div>`
  const text = `Reset your ${BRAND.name} password using this link (expires in 1 hour): ${url}`
  return { subject, html, text }
}

/** Branded email-verification (account activation) markup. */
export function verifyEmail(url: string) {
  const subject = `Activate your ${BRAND.short} account`
  const html = `
  <div style="background:#0a0a0a;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;border-bottom:1px solid #262626;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:2px;">${BRAND.short}</span>
        <span style="color:#E10600;font-size:20px;font-weight:800;"> ●</span>
      </div>
      <div style="padding:32px;">
        <h1 style="color:#ffffff;font-size:22px;margin:0 0 12px;">Activate your account</h1>
        <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Welcome to ${BRAND.name}. Confirm your email address to activate your account and start competing. This link expires in 24 hours.
        </p>
        <a href="${url}" style="display:inline-block;background:#E10600;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
          Activate account
        </a>
        <p style="color:#737373;font-size:12px;line-height:1.6;margin:24px 0 0;">
          If you didn't create this account, you can safely ignore this email. Or paste this link into your browser:<br/>
          <a href="${url}" style="color:#E10600;word-break:break-all;">${url}</a>
        </p>
      </div>
    </div>
  </div>`
  const text = `Activate your ${BRAND.name} account using this link (expires in 24 hours): ${url}`
  return { subject, html, text }
}

import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import { sendEmail, resetPasswordEmail, verifyEmail, adminNewMemberEmail, ADMIN_EMAIL, appBaseUrl } from "@/lib/email"

// Email verification is built but NOT enforced yet: users can still sign in
// before activating. Flip `requireEmailVerification` to true (below) once a
// RESEND_API_KEY + verified sender domain are configured so real activation
// emails reach users.
const ENFORCE_EMAIL_VERIFICATION = false

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: ENFORCE_EMAIL_VERIFICATION,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      const { subject, html, text } = resetPasswordEmail(url)
      const { sent } = await sendEmail({ to: user.email, subject, html, text })
      if (!sent) {
        console.log(`[auth] Password reset link for ${user.email}: ${url}`)
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Auto-verify email on account creation while email verification is not
        // enforced. This prevents users from being locked out if the flag is
        // toggled on later without a backfill.
        before: async (user) => {
          return { data: { ...user, emailVerified: ENFORCE_EMAIL_VERIFICATION ? user.emailVerified : true } }
        },
        // Fire-and-forget admin alert — never blocks the registration flow.
        after: async (user) => {
          const adminUrl = `${appBaseUrl()}/admin/members`
          const { subject, html, text } = adminNewMemberEmail({ name: user.name ?? "", email: user.email, adminUrl })
          sendEmail({ to: ADMIN_EMAIL, subject, html, text }).catch(() => {})
        },
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html, text } = verifyEmail(url)
      const { sent } = await sendEmail({ to: user.email, subject, html, text })
      if (!sent) {
        // No email provider configured — surface the activation link for testing.
        console.log(`[v0] Account activation link for ${user.email}: ${url}`)
      }
    },
  },
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    // Wildcard for all v0 preview URLs (*.vusercontent.net) — Better Auth
    // supports glob patterns via wildcardMatch so this covers every dynamic
    // preview URL without needing to hardcode individual hostnames.
    "https://*.vusercontent.net",
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
    // Extra trusted origins (comma-separated). Required when serving from a
    // custom domain that differs from the Vercel-assigned URL — e.g. the Demo
    // Environment on https://demo.sapl.co.za — so Better Auth accepts its
    // sign-in requests instead of rejecting them as "Invalid origin".
    ...(process.env.AUTH_TRUSTED_ORIGINS
      ? process.env.AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    // The app runs inside a cross-site preview iframe (and may be embedded
    // elsewhere), so the session cookie must be SameSite=None + Secure or the
    // browser drops it and sign-in appears to "do nothing". Browsers treat
    // localhost as a secure context, so this also works in local dev.
    // `partitioned: true` (CHIPS) is required for modern browsers (Chrome,
    // Safari) that block/partition third-party cookies in iframes — without it
    // the cookie is silently dropped and the user is bounced back to sign-in.
    defaultCookieAttributes: {
      sameSite: "none" as const,
      secure: true,
      partitioned: true,
    },
  },
})

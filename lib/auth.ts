import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import { sendEmail, resetPasswordEmail, adminNewMemberEmail, ADMIN_EMAIL, appBaseUrl } from "@/lib/email"

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
    requireEmailVerification: false,
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
        // Email verification is disabled, so mark accounts verified at signup to
        // keep downstream checks and reports consistent with the current flow.
        before: async (user) => ({ data: { ...user, emailVerified: true } }),
        // Fire-and-forget admin alert — never blocks the registration flow.
        after: async (user) => {
          const adminUrl = `${appBaseUrl()}/admin/members`
          const { subject, html, text } = adminNewMemberEmail({ name: user.name ?? "", email: user.email, adminUrl })
          sendEmail({ to: ADMIN_EMAIL, subject, html, text }).catch(() => {})
        },
      },
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
    // In production / preview iframes the session cookie must be SameSite=None
    // + Secure + Partitioned (CHIPS) or browsers silently drop it.
    // In local development use standard Lax cookies so they work over plain HTTP.
    defaultCookieAttributes:
      process.env.NODE_ENV === "production"
        ? { sameSite: "none" as const, secure: true, partitioned: true }
        : { sameSite: "lax" as const, secure: false },
  },
})

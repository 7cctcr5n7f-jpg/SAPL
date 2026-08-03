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
  trustedOrigins: async (request) => {
    // Build a fresh list on every auth request so dynamic preview URLs are
    // always covered without needing to restart the server.
    const fixed = [
      "http://localhost:3000",
      "http://localhost:3001",
      // Wildcard patterns — Better Auth's matchesOriginPattern supports * and ?
      "https://*.vusercontent.net",
      "https://*.v0.dev",
      "https://*.vercel.app",
    ]

    const fromEnv = [
      process.env.V0_RUNTIME_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
      // Extra trusted origins (comma-separated) — e.g. custom domains like
      // https://demo.sapl.co.za set via AUTH_TRUSTED_ORIGINS env var.
      ...(process.env.AUTH_TRUSTED_ORIGINS
        ? process.env.AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
        : []),
    ].filter((o): o is string => Boolean(o))

    // Also dynamically trust the Origin header of the incoming request itself
    // so any new preview / deploy URL works on first load without config changes.
    const requestOrigin = request?.headers?.get?.("origin") ?? ""
    const dynamic = requestOrigin ? [requestOrigin] : []

    return [...fixed, ...fromEnv, ...dynamic]
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    // The session cookie must be SameSite=None + Secure + Partitioned (CHIPS)
    // whenever the app is served inside a cross-origin iframe (production AND
    // the v0 preview sandbox), otherwise browsers silently drop the cookie.
    // Pure local dev (no V0_RUNTIME_URL) uses Lax so plain HTTP works.
    defaultCookieAttributes:
      process.env.NODE_ENV === "production" || process.env.V0_RUNTIME_URL
        ? { sameSite: "none" as const, secure: true, partitioned: true }
        : { sameSite: "lax" as const, secure: false },
  },
})

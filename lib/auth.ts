import { betterAuth } from "better-auth"
import { getPool } from "@/lib/db"
import { sendEmail, resetPasswordEmail, adminNewMemberEmail, ADMIN_EMAIL, appBaseUrl } from "@/lib/email"

let authInstance: ReturnType<typeof betterAuth> | null = null

export function getAuth() {
  if (!authInstance) {
    authInstance = betterAuth({
      database: getPool(),
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
            before: async (user) => ({ data: { ...user, emailVerified: true } }),
            after: async (user) => {
              const adminUrl = `${appBaseUrl()}/admin/members`
              const { subject, html, text } = adminNewMemberEmail({ name: user.name ?? "", email: user.email, adminUrl })
              sendEmail({ to: ADMIN_EMAIL, subject, html, text }).catch(() => {})
            },
          },
        },
      },
      trustedOrigins: async (request) => {
        const fixed = [
          "http://localhost:3000",
          "http://localhost:3001",
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
          ...(process.env.AUTH_TRUSTED_ORIGINS
            ? process.env.AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
            : []),
        ].filter((o): o is string => Boolean(o))

        const requestOrigin = request?.headers?.get?.("origin") ?? ""
        const dynamic = requestOrigin ? [requestOrigin] : []

        return [...fixed, ...fromEnv, ...dynamic]
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
      },
      advanced: {
        defaultCookieAttributes:
          process.env.NODE_ENV === "production" || process.env.V0_RUNTIME_URL
            ? { sameSite: "none" as const, secure: true, partitioned: true }
            : { sameSite: "lax" as const, secure: false },
      },
    })
  }
  return authInstance
}

export const auth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop)
  },
}) as ReturnType<typeof getAuth>

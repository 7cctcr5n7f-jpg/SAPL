import "server-only"

export {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  getDemoAccount,
  type DemoAccount,
} from "@/lib/demo-accounts"

/**
 * Demo Environment control plane (server-only).
 *
 * The Demo Environment is a completely separate Vercel deployment bound to
 * demo.sapl.co.za with its own Neon database branch (DATABASE_URL) and the
 * env flag NEXT_PUBLIC_DEMO_MODE=true. Because isolation is enforced at the
 * deployment/database level, production code never switches databases at
 * runtime — it simply reads whether THIS deployment is the demo one.
 *
 * Nothing here can read or write production data: a demo deployment only ever
 * holds the demo branch connection string.
 */

/** True when this deployment is the Demo Environment. */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

/**
 * Hard guard for demo-only destructive/admin operations (reset, regenerate,
 * refresh). Throws unless this deployment is explicitly the demo one, so these
 * actions can never run against production even if a route is reached.
 */
export function assertDemo(): void {
  if (!IS_DEMO) {
    throw new Error("This operation is only available in the Demo Environment.")
  }
}

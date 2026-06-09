import "server-only"

import type { Role } from "@/lib/session"

/**
 * Demo Environment control plane.
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

/** A pre-provisioned demo login shown on the /demo helper page. */
export type DemoAccount = {
  /** Stable key used by the seed to create the matching user. */
  key: string
  role: Role
  /** Friendly role label for the card. */
  label: string
  name: string
  email: string
  /** One-line description of what this account can explore. */
  blurb: string
}

/**
 * Shared password for every demo account. Demo only — these credentials are
 * intentionally public on the /demo page and only ever exist in the demo
 * database branch.
 */
export const DEMO_PASSWORD = "DemoPadel123!"

/**
 * Canonical catalog of demo logins. The seed script creates exactly these
 * users (via Better Auth) and the /demo page renders them. Keep both in sync
 * by importing from here.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "super",
    role: "super_admin",
    label: "Super Admin",
    name: "Demo Super Admin",
    email: "superadmin@demo.sapl.co.za",
    blurb: "Full god-mode access — every league, club, member and admin control.",
  },
  {
    key: "league",
    role: "league_admin",
    label: "League Admin",
    name: "Demo League Admin",
    email: "league@demo.sapl.co.za",
    blurb: "Run the whole competition — seasons, divisions, fixtures and members.",
  },
  {
    key: "club",
    role: "org_admin",
    label: "Club Admin",
    name: "Demo Club Admin",
    email: "club@demo.sapl.co.za",
    blurb: "Manage a club, its venues, teams, rosters and entry-fee payments.",
  },
  {
    key: "captain",
    role: "captain",
    label: "Team Captain",
    name: "Demo Captain",
    email: "captain@demo.sapl.co.za",
    blurb: "Captain Hub — line-ups, fixture results and team billing.",
  },
  {
    key: "player",
    role: "player",
    label: "Player",
    name: "Demo Player",
    email: "player@demo.sapl.co.za",
    blurb: "A player's view — standings, rankings, profile and the marketplace.",
  },
]

/** Look up a demo account by its stable key. */
export function getDemoAccount(key: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.key === key)
}

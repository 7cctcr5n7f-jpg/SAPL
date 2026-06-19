import type { Role } from "@/lib/session"

/**
 * Demo account catalog — plain data, safe to import from anywhere (scripts,
 * server, client). The runtime guards live in lib/demo.ts (server-only).
 */

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
 * users (via Better Auth) and the /demo page renders them.
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

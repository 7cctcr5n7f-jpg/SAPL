import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import {
  user,
  account,
  session,
  verification,
  userMeta,
  pushSubscriptions,
  clubs,
  teams,
  teamMembers,
  players,
  organisations,
} from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { runSeed, DEMO_ORGS } from "@/lib/seed"
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/lib/demo-accounts"

/**
 * Wipes EVERY auth/PII row. Critical: the demo Neon branch is a copy-on-write
 * fork of production, so before reseeding it still contains real user accounts,
 * sessions and player PII. We must clear all of it so the demo never exposes a
 * single real person's data.
 */
async function wipeAuthAndPii() {
  await db.delete(pushSubscriptions)
  await db.delete(session)
  await db.delete(verification)
  await db.delete(account)
  await db.delete(userMeta)
  await db.delete(user)
}

/** Hash a password with Better Auth's own hasher so sign-in validates. */
async function hashPassword(plain: string): Promise<string> {
  const ctx = await auth.$context
  return ctx.password.hash(plain)
}

/** Create a Better Auth credential user + meta row. Returns the new user id. */
async function createDemoUser(acct: DemoAccount, phone: string): Promise<string> {
  const id = `demo-user-${acct.key}`
  const now = new Date()
  await db.insert(user).values({
    id,
    name: acct.name,
    email: acct.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(account).values({
    id: `demo-cred-${acct.key}`,
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(DEMO_PASSWORD),
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(userMeta).values({
    userId: id,
    role: acct.role,
    phone,
    whatsappOptIn: true,
  })
  return id
}

/**
 * Full demo seed: wipe everything (including real PII from the production
 * fork), generate the rich league via runSeed(), then create the canonical
 * demo logins and wire them to seeded entities so each role lands on
 * meaningful, populated screens.
 */
export async function runDemoSeed() {
  // 1. Remove all real accounts/PII carried over from the production fork.
  await wipeAuthAndPii()

  // 2. Generate the full synthetic league (orgs, clubs, teams, players,
  //    fixtures, standings, TPR/CPI, sponsors, payments, notifications).
  //    DEMO_ORGS scales to ~20 organisations / ~80 teams for a rich demo.
  const summary = await runSeed(DEMO_ORGS)

  // 3. Create the five demo logins.
  const userIdByKey = new Map<string, string>()
  let phoneSeq = 100
  for (const acct of DEMO_ACCOUNTS) {
    const id = await createDemoUser(acct, `+2782000${phoneSeq++}`)
    userIdByKey.set(acct.key, id)
  }

  // 4. Link role accounts to seeded entities so their dashboards are populated.
  //    - Club Admin owns an organisation + its club (club.contactEmail match).
  //    - Captain captains a team (teams.captainUserId) and owns it by email.
  const clubAdminId = userIdByKey.get("club")!
  const captainId = userIdByKey.get("captain")!
  const playerId = userIdByKey.get("player")!
  const clubEmail = DEMO_ACCOUNTS.find((a) => a.key === "club")!.email
  const captainEmail = DEMO_ACCOUNTS.find((a) => a.key === "captain")!.email

  // Pick the first organisation + its club for the club admin.
  const [firstOrg] = await db.select().from(organisations).orderBy(organisations.id).limit(1)
  if (firstOrg) {
    await db.update(organisations).set({ ownerUserId: clubAdminId }).where(eq(organisations.id, firstOrg.id))
    await db
      .update(clubs)
      .set({ ownerUserId: clubAdminId, contactEmail: clubEmail })
      .where(eq(clubs.organisationId, firstOrg.id))
  }

  // Make the captain own + captain the first team of that organisation.
  const [firstTeam] = firstOrg
    ? await db.select().from(teams).where(eq(teams.organisationId, firstOrg.id)).orderBy(teams.id).limit(1)
    : await db.select().from(teams).orderBy(teams.id).limit(1)
  if (firstTeam) {
    await db
      .update(teams)
      .set({ captainUserId: captainId, ownerEmail: captainEmail })
      .where(eq(teams.id, firstTeam.id))

    // Attach the demo player to that team's roster as a real linked player.
    const [demoPlayerRow] = await db
      .insert(players)
      .values({
        userId: playerId,
        firstName: "Demo",
        lastName: "Player",
        gender: "male",
        province: "Gauteng",
        city: "Centurion",
        regionId: firstTeam.regionId ?? null,
        currentLi: 3.2,
        highestLi: 3.4,
        liDate: new Date("2026-01-15"),
        currentTpr: 1050,
        availability: "rostered",
        lookingForTeam: false,
      })
      .returning()
    await db.insert(teamMembers).values({
      teamId: firstTeam.id,
      playerId: demoPlayerRow.id,
      role: "member",
      status: "active",
    })
  }

  // Sanity: confirm no leftover non-demo users slipped through.
  const [{ count: strayUsers }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(sql`${user.id} NOT LIKE 'demo-user-%'`)

  return {
    ...summary,
    demoUsers: DEMO_ACCOUNTS.length,
    strayUsers: Number(strayUsers),
    linkedOrg: firstOrg?.name ?? null,
    linkedTeam: firstTeam?.name ?? null,
  }
}

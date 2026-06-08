"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, userMeta, players, teams, teamMembers, organisations, clubs } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { getCurrentUser, type CurrentUser, type Role } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { recomputeTeamStats } from "@/lib/engine/team-stats"
import { getAccessContext, type ClubAssignment, type TeamAssignment } from "@/lib/access"
import {
  PERMISSIONS,
  ROLE_DEFAULTS,
  sanitizePermissions,
  type Permission,
} from "@/lib/permissions"

const ASSIGNABLE: Role[] = ["player", "captain", "org_admin", "league_admin", "super_admin"]
/** Roles only a main (super) admin may grant — prevents privilege escalation. */
const PRIVILEGED_ROLES: Role[] = ["league_admin", "super_admin"]

/**
 * Members management requires the League Management permission. Only a main
 * (super) admin may grant privileged roles or god-mode permissions; this helper
 * returns both the actor and whether they hold that elevated authority.
 */
async function requireMemberManager() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Not authenticated")
  const access = await getAccessContext(me)
  if (!access.can("league_management")) throw new Error("League management access required")
  return { me, isMainAdmin: me.realRole === "super_admin" }
}

/** Back-compat alias used by the existing create/password/role actions. */
async function requireSuperAdmin() {
  const { me } = await requireMemberManager()
  return me
}

export type MemberRow = {
  id: string
  name: string
  email: string
  role: Role
  playerName: string | null
  createdAt: string
}

export async function listMembers(): Promise<MemberRow[]> {
  await requireSuperAdmin()
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: userMeta.role,
      firstName: players.firstName,
      lastName: players.lastName,
      createdAt: user.createdAt,
    })
    .from(user)
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    .leftJoin(players, eq(players.userId, user.id))
    .orderBy(user.createdAt)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: (r.role as Role) ?? "player",
    playerName: r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : null,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
  }))
}

export async function setMemberRole(userId: string, role: Role) {
  const { me, isMainAdmin } = await requireMemberManager()
  if (!ASSIGNABLE.includes(role)) return { ok: false, error: "Invalid role" }
  if (userId === me.id) return { ok: false, error: "You can't change your own role." }
  // Only the main admin may grant League Admin / Main Admin.
  if (!isMainAdmin && PRIVILEGED_ROLES.includes(role)) {
    return { ok: false, error: "Only the main admin can grant that role." }
  }

  const [target] = await db.select({ role: userMeta.role }).from(userMeta).where(eq(userMeta.userId, userId)).limit(1)
  // Non-main-admins also can't demote an existing privileged member.
  if (!isMainAdmin && target && PRIVILEGED_ROLES.includes(target.role as Role)) {
    return { ok: false, error: "Only the main admin can change that member." }
  }

  const existing = await db.select({ id: userMeta.id }).from(userMeta).where(eq(userMeta.userId, userId)).limit(1)
  if (existing.length) {
    await db.update(userMeta).set({ role }).where(eq(userMeta.userId, userId))
  } else {
    await db.insert(userMeta).values({ userId, role })
  }

  revalidatePath("/admin/members")
  return { ok: true }
}

export async function sendMemberResetEmail(userId: string) {
  await requireSuperAdmin()
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
  if (!u) return { ok: false, error: "User not found" }

  try {
    await auth.api.requestPasswordReset({ body: { email: u.email, redirectTo: "/reset-password" } })
  } catch {
    return { ok: false, error: "Could not send reset email" }
  }
  return { ok: true, email: u.email }
}

function generatePassword(): string {
  // Readable but reasonably strong: e.g. "Padel-7K2m9QXz"
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let s = ""
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `Sapl-${s}`
}

export async function setMemberTempPassword(userId: string, custom?: string) {
  await requireSuperAdmin()
  const password = custom && custom.length >= 8 ? custom : generatePassword()

  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1)
  if (!u) return { ok: false, error: "User not found" }

  try {
    const ctx = await auth.$context
    const hashed = await ctx.password.hash(password)
    await ctx.internalAdapter.updatePassword(userId, hashed)
  } catch (err) {
    console.log("[v0] setMemberTempPassword failed:", err instanceof Error ? err.message : err)
    return { ok: false, error: "Could not set password" }
  }

  return { ok: true, password }
}

// ---------------------------------------------------------------------------
// Creating new members / players
// ---------------------------------------------------------------------------

/**
 * Provisions a Better Auth account (email + password + credential) and assigns
 * the platform role. Returns the password so the creator can share it. Calling
 * `auth.api.signUpEmail` here does NOT touch the creator's session because no
 * cookie-writing plugin is configured — the new session token is simply ignored.
 */
async function provisionUser(opts: {
  name: string
  email: string
  role: Role
  password?: string
}): Promise<{ ok: true; userId: string; password: string } | { ok: false; error: string }> {
  const name = opts.name.trim()
  const email = opts.email.trim().toLowerCase()
  if (!name) return { ok: false, error: "Name is required." }
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." }

  const [dupe] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (dupe) return { ok: false, error: "A member with that email already exists." }

  const password = opts.password && opts.password.length >= 8 ? opts.password : generatePassword()

  let userId: string
  try {
    const res = await auth.api.signUpEmail({ body: { name, email, password } })
    userId = res.user.id
  } catch (err) {
    console.log("[v0] provisionUser failed:", err instanceof Error ? err.message : err)
    return { ok: false, error: "Could not create the account." }
  }

  const [existingMeta] = await db.select({ id: userMeta.id }).from(userMeta).where(eq(userMeta.userId, userId)).limit(1)
  if (existingMeta) {
    await db.update(userMeta).set({ role: opts.role }).where(eq(userMeta.userId, userId))
  } else {
    await db.insert(userMeta).values({ userId, role: opts.role })
  }

  return { ok: true, userId, password }
}

/** Create (or reuse) a player profile for a user. lastName may be empty. */
async function ensurePlayerProfile(
  userId: string,
  firstName: string,
  lastName: string,
  extra?: {
    gender?: string
    playtomicUrl?: string | null
    bio?: string | null
  },
) {
  // League Index, province, city and preferred category are intentionally not
  // set here — they default and are filled in later by the player or a league
  // admin under Player Management.
  const profileValues = {
    gender: extra?.gender === "female" ? "female" : "male",
    playtomicUrl: extra?.playtomicUrl?.trim() || null,
    bio: extra?.bio?.trim() || null,
  }

  const [existing] = await db.select({ id: players.id }).from(players).where(eq(players.userId, userId)).limit(1)
  if (existing) {
    // Reuse an existing profile but apply the details supplied here.
    await db
      .update(players)
      .set({ firstName: firstName || "New", lastName: lastName || "Player", ...profileValues, updatedAt: new Date() })
      .where(eq(players.id, existing.id))
    return existing.id
  }
  const [created] = await db
    .insert(players)
    .values({
      userId,
      firstName: firstName || "New",
      lastName: lastName || "Player",
      currentLi: 0,
      highestLi: 0,
      liDate: new Date(),
      currentTpr: 1000,
      highestTpr: 1000,
      lookingForTeam: true,
      availability: "available",
      ...profileValues,
    })
    .returning({ id: players.id })
  return created.id
}

/**
 * Main-admin: create any kind of member (player, captain/team admin, club
 * admin, league admin, main admin). Players & captains also get a player
 * profile so they function on the marketplace and in squads.
 */
export async function createMember(input: {
  firstName: string
  lastName: string
  email: string
  role: Role
  password?: string
}) {
  await requireSuperAdmin()
  if (!ASSIGNABLE.includes(input.role)) return { ok: false, error: "Invalid role" }

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName) return { ok: false, error: "First name is required." }

  const res = await provisionUser({
    name: `${firstName} ${lastName}`.trim(),
    email: input.email,
    role: input.role,
    password: input.password,
  })
  if (!res.ok) return res

  if (input.role === "player" || input.role === "captain") {
    await ensurePlayerProfile(res.userId, firstName, lastName)
  }

  revalidatePath("/admin/members")
  return { ok: true, password: res.password }
}

/** Roles allowed to add players: captains, org admins, league/main admins. */
async function requirePlayerManager() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Not authenticated")
  const role = me.realRole
  if (role !== "captain" && role !== "org_admin" && role !== "league_admin" && role !== "super_admin") {
    throw new Error("Captain or club admin access required")
  }
  return me
}

/**
 * Captains and club admins can create a player account directly. The player can
 * optionally be assigned straight onto one of the teams the creator controls
 * (their captained teams, or their organisation's teams); otherwise they become
 * a free agent (looking for a team) so they immediately appear in squad and
 * captain assignment lists. League Index / location are set later.
 */
export async function createPlayerAccount(input: {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  gender?: string
  playtomicUrl?: string | null
  bio?: string | null
  assignTeamId?: number | null
  password?: string
}) {
  const me = await requirePlayerManager()

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName || !lastName) return { ok: false, error: "First and last name are required." }

  // If a team is selected, verify the creator controls it before creating
  // anything, so we never half-provision an account.
  let targetTeam: typeof teams.$inferSelect | null = null
  if (input.assignTeamId) {
    const [t] = await db.select().from(teams).where(eq(teams.id, input.assignTeamId)).limit(1)
    if (!t) return { ok: false, error: "Selected team not found." }
    if (me.realRole === "captain") {
      if (t.captainUserId !== me.id) return { ok: false, error: "You can only add players to your own teams." }
    } else if (me.realRole === "org_admin") {
      const [org] = await db.select().from(organisations).where(eq(organisations.id, t.organisationId ?? 0)).limit(1)
      if (!org || org.ownerUserId !== me.id) return { ok: false, error: "You cannot add players to that team." }
    }
    targetTeam = t
  }

  const res = await provisionUser({
    name: `${firstName} ${lastName}`,
    email: input.email,
    role: "player",
    password: input.password,
  })
  if (!res.ok) return res

  // Persist optional contact number on the user's meta record.
  const phone = input.phone?.trim() || null
  if (phone) {
    const [existingMeta] = await db
      .select({ id: userMeta.id })
      .from(userMeta)
      .where(eq(userMeta.userId, res.userId))
      .limit(1)
    if (existingMeta) {
      await db.update(userMeta).set({ phone, updatedAt: new Date() }).where(eq(userMeta.userId, res.userId))
    } else {
      await db.insert(userMeta).values({ userId: res.userId, role: "player", phone })
    }
  }

  const playerId = await ensurePlayerProfile(res.userId, firstName, lastName, {
    gender: input.gender,
    playtomicUrl: input.playtomicUrl,
    bio: input.bio,
  })

  // Optionally drop the new player straight onto a team roster.
  if (targetTeam) {
    const [existing] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, targetTeam.id), eq(teamMembers.playerId, playerId)))
      .limit(1)
    if (existing) {
      await db.update(teamMembers).set({ status: "active", updatedAt: new Date() }).where(eq(teamMembers.id, existing.id))
    } else {
      await db.insert(teamMembers).values({ teamId: targetTeam.id, playerId, role: "member", status: "active" })
    }
    await db.update(players).set({ availability: "on_team", lookingForTeam: false }).where(eq(players.id, playerId))
    await recomputeTeamStats(targetTeam.id)
  }

  revalidatePath("/dashboard/org")
  revalidatePath("/dashboard/captain")
  revalidatePath("/marketplace")
  return { ok: true, password: res.password, playerId, userId: res.userId, assignedTeamName: targetTeam?.name ?? null }
}

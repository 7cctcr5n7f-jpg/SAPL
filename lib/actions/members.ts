"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, userMeta, players, teams, teamMembers, organisations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getCurrentUser, type Role } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { recomputeTeamStats } from "@/lib/engine/team-stats"

const ASSIGNABLE: Role[] = ["player", "captain", "org_admin", "league_admin", "super_admin"]

/** Members management is restricted to the main (super) admin. */
async function requireSuperAdmin() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Not authenticated")
  if (me.realRole !== "super_admin") throw new Error("Main admin access required")
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
  const me = await requireSuperAdmin()
  if (!ASSIGNABLE.includes(role)) return { ok: false, error: "Invalid role" }
  if (userId === me.id) return { ok: false, error: "You can't change your own role." }

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
    currentLi?: number
    province?: string
    city?: string | null
    playtomicUrl?: string | null
    preferredCategory?: string | null
    bio?: string | null
  },
) {
  const li = Number(extra?.currentLi ?? 0)
  const safeLi = Number.isFinite(li) ? li : 0
  const profileValues = {
    gender: extra?.gender === "female" ? "female" : "male",
    province: extra?.province?.trim() || "Gauteng",
    city: extra?.city?.trim() || null,
    playtomicUrl: extra?.playtomicUrl?.trim() || null,
    preferredCategory: extra?.preferredCategory?.trim() || null,
    bio: extra?.bio?.trim() || null,
  }

  const [existing] = await db.select({ id: players.id }).from(players).where(eq(players.userId, userId)).limit(1)
  if (existing) {
    // Reuse an existing profile but apply the richer details supplied here.
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
      currentLi: safeLi,
      highestLi: safeLi,
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

/** Club managers (org admin / league admin / main admin) who may add players. */
async function requireClubManager() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Not authenticated")
  const role = me.realRole
  if (role !== "org_admin" && role !== "league_admin" && role !== "super_admin") {
    throw new Error("Club admin access required")
  }
  return me
}

/**
 * Club admins (and higher) can create a player account directly with a full
 * profile. The player can optionally be assigned straight onto one of the
 * club's teams; otherwise they become a free agent (looking for a team) so they
 * immediately appear in squad and captain assignment lists.
 */
export async function createPlayerAccount(input: {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  gender?: string
  currentLi?: number
  province?: string
  city?: string | null
  playtomicUrl?: string | null
  preferredCategory?: string | null
  bio?: string | null
  assignTeamId?: number | null
  password?: string
}) {
  const me = await requireClubManager()

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName || !lastName) return { ok: false, error: "First and last name are required." }
  const li = Number(input.currentLi ?? 0)
  if (Number.isNaN(li) || li < 0 || li > 7) return { ok: false, error: "League Index must be between 0 and 7." }

  // If a team is selected, verify it belongs to a club this manager controls
  // before creating anything, so we never half-provision an account.
  let targetTeam: typeof teams.$inferSelect | null = null
  if (input.assignTeamId) {
    const [t] = await db.select().from(teams).where(eq(teams.id, input.assignTeamId)).limit(1)
    if (!t) return { ok: false, error: "Selected team not found." }
    if (me.realRole === "org_admin") {
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
    currentLi: li,
    province: input.province,
    city: input.city,
    playtomicUrl: input.playtomicUrl,
    preferredCategory: input.preferredCategory,
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
  revalidatePath("/marketplace")
  return { ok: true, password: res.password, playerId, userId: res.userId, assignedTeamName: targetTeam?.name ?? null }
}

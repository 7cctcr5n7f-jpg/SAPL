"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, userMeta, teams, teamMembers, organisations, clubs } from "@/lib/db/schema"
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

const ASSIGNABLE: Role[] = ["player", "captain", "org_admin", "super_admin"]
/** Roles only a main (super) admin may grant — prevents privilege escalation. */
const PRIVILEGED_ROLES: Role[] = ["super_admin"]

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
  phone: string | null
  role: Role
  playerName: string | null
  createdAt: string
  /** True when this member has an explicit permission override (vs role defaults). */
  hasPermissionOverride: boolean
}

export async function listMembers(): Promise<MemberRow[]> {
  await requireMemberManager()
  // LEFT JOIN userMeta so users who registered but never got a meta row still appear.
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: userMeta.phone,
      role: userMeta.role,
      permissions: userMeta.permissions,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    })
    .from(user)
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    .orderBy(user.createdAt)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    role: (r.role as Role) ?? "player",
    playerName: r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : null,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    hasPermissionOverride: r.permissions != null,
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

/** Update a member's core details: name (on the auth user row) and phone (on userMeta). */
export async function updateMemberDetails(
  userId: string,
  input: {
    name?: string
    firstName?: string
    lastName?: string
    phone?: string | null
    gender?: string | null
    city?: string | null
    province?: string | null
    currentLi?: number | null
    playtomicUrl?: string | null
    isPlayer?: boolean
  },
) {
  const { me } = await requireMemberManager()
  
  // Build user update object with player profile fields
  const userUpdate: Record<string, any> = {}
  
  if (input.name) {
    const name = input.name.trim()
    if (!name) return { ok: false, error: "Name is required." }
    userUpdate.name = name
  }
  
  if (input.firstName !== undefined) userUpdate.firstName = input.firstName?.trim() || null
  if (input.lastName !== undefined) userUpdate.lastName = input.lastName?.trim() || null
  if (input.gender !== undefined) userUpdate.gender = input.gender || null
  if (input.city !== undefined) userUpdate.city = input.city?.trim() || null
  if (input.province !== undefined) userUpdate.province = input.province || null
  if (input.currentLi !== undefined) userUpdate.currentLi = input.currentLi ?? 0
  if (input.playtomicUrl !== undefined) userUpdate.playtomicUrl = input.playtomicUrl?.trim() || null
  if (input.isPlayer !== undefined) userUpdate.isPlayer = input.isPlayer

  if (Object.keys(userUpdate).length > 0) {
    await db.update(user).set(userUpdate).where(eq(user.id, userId))
  }
  
  // Update meta (phone and related)
  const metaUpdate: Record<string, any> = {}
  if (input.phone !== undefined) metaUpdate.phone = input.phone?.trim() || null
  
  if (Object.keys(metaUpdate).length > 0) {
    await upsertMeta(userId, metaUpdate)
  }

  revalidatePath("/admin/members")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Permissions & assignments
// ---------------------------------------------------------------------------

export type MemberDetail = {
  /** Effective permissions currently in force (role defaults or stored override). */
  effectivePermissions: Permission[]
  /** True when this member has an explicit override list (vs. role defaults). */
  hasOverride: boolean
  /** The member's role default permissions (shown as the baseline). */
  roleDefaults: Permission[]
  clubAssignments: ClubAssignment[]
  teamAssignments: TeamAssignment[]
}

function getEffectiveForTarget(role: Role | undefined, override: string[] | null): Permission[] {
  const r = role ?? "player"
  if (r === "super_admin") return [...PERMISSIONS]
  if (override == null) return ROLE_DEFAULTS[r] ?? []
  return sanitizePermissions(override)
}

/** Loads the permission + assignment detail for a single member (expand panel). */
export async function getMemberDetail(userId: string): Promise<MemberDetail> {
  await requireMemberManager()

  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: userMeta.role, permissions: userMeta.permissions })
    .from(user)
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1)
  if (!target) throw new Error("Member not found")

  const role = (target.role as Role) ?? "player"
  const access = await getAccessContext({
    id: target.id,
    name: target.name,
    email: target.email,
    role,
    realRole: role,
    isSuperAdmin: role === "super_admin",
    actingRole: null,
    isPlayer: false,
    onMarketplace: false,
  })

  return {
    effectivePermissions: [...access.permissions],
    hasOverride: target.permissions != null,
    roleDefaults: ROLE_DEFAULTS[role] ?? [],
    clubAssignments: access.clubAssignments,
    teamAssignments: access.teamAssignments,
  }
}

async function upsertMeta(userId: string, patch: Partial<typeof userMeta.$inferInsert>) {
  const [existing] = await db.select({ id: userMeta.id }).from(userMeta).where(eq(userMeta.userId, userId)).limit(1)
  if (existing) {
    await db.update(userMeta).set({ ...patch, updatedAt: new Date() }).where(eq(userMeta.userId, userId))
  } else {
    await db.insert(userMeta).values({ userId, role: "player", ...patch })
  }
}

/**
 * Set a member's explicit permission override. Passing `null` reverts them to
 * their role defaults. Only the main admin may grant or revoke league_management
 * (god mode) on another member.
 */
export async function setMemberPermissions(userId: string, permissions: string[] | null) {
  const { me, isMainAdmin } = await requireMemberManager()
  if (userId === me.id) return { ok: false, error: "You can't change your own permissions." }

  let value: Permission[] | null = null
  if (permissions != null) {
    value = sanitizePermissions(permissions)
    if (!isMainAdmin && value.includes("league_management")) {
      return { ok: false, error: "Only the main admin can grant League Management." }
    }
  }

  if (!isMainAdmin) {
    const [target] = await db
      .select({ role: userMeta.role, permissions: userMeta.permissions })
      .from(userMeta)
      .where(eq(userMeta.userId, userId))
      .limit(1)
    const current = getEffectiveForTarget(target?.role as Role, target?.permissions ?? null)
    if (current.includes("league_management")) {
      return { ok: false, error: "Only the main admin can change that member." }
    }
  }

  await upsertMeta(userId, { permissions: value })
  revalidatePath("/admin/members")
  return { ok: true }
}

/** Options for the club/team assignment pickers. */
export async function getAssignmentOptions(): Promise<{
  clubs: { id: number; name: string }[]
  teams: { id: number; name: string }[]
}> {
  await requireMemberManager()
  const [clubRows, teamRows] = await Promise.all([
    db.select({ id: clubs.id, name: clubs.name }).from(clubs).orderBy(asc(clubs.name)),
    db.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name)),
  ])
  return { clubs: clubRows, teams: teamRows }
}

type OverrideShape = { add: number[]; remove: number[] }
function normalise(v: unknown): OverrideShape {
  const o = (v ?? {}) as Partial<OverrideShape>
  const ints = (a: unknown) => (Array.isArray(a) ? a.map(Number).filter(Number.isInteger) : [])
  return { add: ints(o.add), remove: ints(o.remove) }
}

/**
 * Add or remove a manual club assignment for a member. Email-matched (auto)
 * clubs are toggled via the remove-set; everything else via the add-set.
 */
export async function setMemberClubAssignment(userId: string, clubId: number, assigned: boolean) {
  await requireMemberManager()
  if (!Number.isInteger(clubId)) return { ok: false as const, error: "Invalid club." }
  const [meta] = await db
    .select({ clubOverrides: userMeta.clubOverrides })
    .from(userMeta)
    .where(eq(userMeta.userId, userId))
    .limit(1)
  const ov = normalise(meta?.clubOverrides)

  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
  const email = target?.email?.trim().toLowerCase() ?? ""
  const [club] = await db.select({ contactEmail: clubs.contactEmail }).from(clubs).where(eq(clubs.id, clubId)).limit(1)
  const isAuto = !!email && (club?.contactEmail ?? "").trim().toLowerCase() === email

  if (isAuto) {
    ov.remove = assigned ? ov.remove.filter((id) => id !== clubId) : [...new Set([...ov.remove, clubId])]
  } else {
    ov.add = assigned ? [...new Set([...ov.add, clubId])] : ov.add.filter((id) => id !== clubId)
  }

  await upsertMeta(userId, { clubOverrides: ov })
  revalidatePath("/admin/members")
  return { ok: true }
}

/** Add or remove a manual team assignment for a member (owner/captain teams are auto). */
export async function setMemberTeamAssignment(userId: string, teamId: number, assigned: boolean) {
  await requireMemberManager()
  if (!Number.isInteger(teamId)) return { ok: false as const, error: "Invalid team." }
  const [meta] = await db
    .select({ teamOverrides: userMeta.teamOverrides })
    .from(userMeta)
    .where(eq(userMeta.userId, userId))
    .limit(1)
  const ov = normalise(meta?.teamOverrides)

  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
  const email = target?.email?.trim().toLowerCase() ?? ""
  const [team] = await db
    .select({ ownerEmail: teams.ownerEmail, captainUserId: teams.captainUserId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  const isAuto =
    (!!email && (team?.ownerEmail ?? "").trim().toLowerCase() === email) || team?.captainUserId === userId

  if (isAuto) {
    ov.remove = assigned ? ov.remove.filter((id) => id !== teamId) : [...new Set([...ov.remove, teamId])]
  } else {
    ov.add = assigned ? [...new Set([...ov.add, teamId])] : ov.add.filter((id) => id !== teamId)
  }

  await upsertMeta(userId, { teamOverrides: ov })
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

  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1)
  if (existing) {
    // Reuse an existing profile but apply the details supplied here.
    await db
      .update(user)
      .set({ firstName: firstName || "New", lastName: lastName || "Player", isPlayer: true, ...profileValues, updatedAt: new Date() })
      .where(eq(user.id, existing.id))
    return existing.id
  }
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
  return { ok: true, password: res.password, userId: res.userId }
}

/** Roles allowed to add players: captains, org admins, super admins. */
async function requirePlayerManager() {
  const me = await getCurrentUser()
  if (!me) throw new Error("Not authenticated")
  const role = me.realRole
  if (role !== "captain" && role !== "org_admin" && role !== "super_admin") {
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
    const [t] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, input.assignTeamId)).limit(1)
    if (!t) return { ok: false, error: "Selected team not found." }
    if (me.realRole === "captain") {
      if (t.captainUserId !== me.id) return { ok: false, error: "You can only add players to your own teams." }
    } else if (me.realRole === "org_admin") {
      const [org] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.id, t.organisationId ?? 0)).limit(1)
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
    await db.update(user).set({ availability: "on_team", lookingForTeam: false, onMarketplace: false }).where(eq(user.id, playerId))
    await recomputeTeamStats(targetTeam.id)
  }

  revalidatePath("/dashboard/org")
  revalidatePath("/dashboard/captain")
  revalidatePath("/marketplace")
  return { ok: true, password: res.password, playerId, userId: res.userId, assignedTeamName: targetTeam?.name ?? null }
}

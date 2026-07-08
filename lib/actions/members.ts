"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, userMeta, teams, teamMembers, organisations, clubs, regions, divisions, payments, session, account, teamInvites, players, categories, teamPairings } from "@/lib/db/schema"
import { eq, and, asc, desc, max, sql, gte, lte } from "drizzle-orm"
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
  status: "active" | "inactive" | "suspended"
  playerName: string | null
  createdAt: string
  lastLoginAt: string | null
  /** True when this member has an explicit permission override (vs role defaults). */
  hasPermissionOverride: boolean
  // Player profile fields
  gender: string | null
  city: string | null
  province: string | null
  currentLi: number | null
  playtomicRating: number | null
  playtomicUrl: string | null
  avatarUrl: string | null
  // Team / club / region / division assignment
  teamId: number | null
  teamName: string | null
  /** When true the team owner pays fees; individual player rows show no payment. */
  teamClubPaysFees: boolean | null
  clubId: number | null
  clubName: string | null
  regionId: number | null
  regionName: string | null
  divisionId: number | null
  divisionName: string | null
  // Payment & account status
  paymentStatus: "paid" | "outstanding" | null
  accountLinked: "linked" | "invited" | "not_registered"
  registeredBy: string | null
  /** Team this member is the primary owner of (matched via teams.ownerEmail). */
  ownedTeamId: number | null
  ownedTeamName: string | null
}

export async function listMembers(): Promise<MemberRow[]> {
  await requireMemberManager()

  // Core user + meta query
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
      gender: user.gender,
      city: user.city,
      province: user.province,
      regionId: user.regionId,
      currentLi: user.currentLi,
      playtomicRating: user.playtomicRating,
      playtomicUrl: user.playtomicUrl,
      avatarUrl: user.avatarUrl,
    })
    .from(user)
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    .orderBy(asc(user.name))

  const userIds = rows.map((r) => r.id)
  if (userIds.length === 0) return []

  // Last login: take the maximum of GREATEST(createdAt, updatedAt) across all
  // sessions for each user.
  //  - createdAt is written once when a new session is created (i.e. a fresh login).
  //  - updatedAt is bumped by Better Auth on activity (subject to updateAge).
  // Using GREATEST ensures that a fresh sign-in today (new createdAt) is always
  // preferred over a stale updatedAt from a session that hasn't been refreshed yet.
  const lastLogins = await db
    .select({
      userId: session.userId,
      lastLogin: max(sql<Date>`GREATEST(${session.createdAt}, ${session.updatedAt})`),
    })
    .from(session)
    .groupBy(session.userId)
  const loginMap = new Map(lastLogins.map((l) => [l.userId, l.lastLogin]))

  // Team membership: one active team_member row per user (join to team → club → region → division)
  const membershipRows = await db
    .select({
      playerId: teamMembers.playerId,
      teamId: teams.id,
      teamName: teams.name,
      teamClubPaysFees: teams.clubPaysFees,
      clubId: clubs.id,
      clubName: clubs.name,
      regionId: regions.id,
      regionName: regions.name,
      divisionId: divisions.id,
      divisionName: divisions.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .leftJoin(clubs, eq(clubs.id, teams.homeClubId))
    .leftJoin(regions, eq(regions.id, teams.regionId))
    .leftJoin(divisions, eq(divisions.id, teams.divisionId))
    .where(eq(teamMembers.status, "active"))
  const membershipMap = new Map(membershipRows.map((r) => [r.playerId, r]))

  // Owned teams: match teams.ownerEmail OR teams.coOwnerEmail to each user's email.
  // This is the single source of truth — teams.ownerEmail drives access AND display.
  const allOwnedTeams = await db
    .select({ ownerEmail: teams.ownerEmail, coOwnerEmail: teams.coOwnerEmail, teamId: teams.id, teamName: teams.name })
    .from(teams)
  // Build lookup: normalised email → first team found (primary owner takes priority)
  const ownerMap = new Map<string, { teamId: number; teamName: string }>()
  for (const t of allOwnedTeams) {
    if (t.ownerEmail) {
      const k = t.ownerEmail.trim().toLowerCase()
      if (!ownerMap.has(k)) ownerMap.set(k, { teamId: t.teamId, teamName: t.teamName })
    }
    if (t.coOwnerEmail) {
      const k = t.coOwnerEmail.trim().toLowerCase()
      if (!ownerMap.has(k)) ownerMap.set(k, { teamId: t.teamId, teamName: t.teamName })
    }
  }

  // Payment status: most recent individual payment per user
  const paymentRows = await db
    .select({ userId: payments.payerUserId, status: payments.status })
    .from(payments)
    .where(eq(payments.type, "individual"))
    .orderBy(desc(payments.createdAt))
  const paymentMap = new Map<string, string>()
  for (const p of paymentRows) {
    if (p.userId && !paymentMap.has(p.userId)) paymentMap.set(p.userId, p.status)
  }

  // Account-linked status: has at least one account row with a password
  const accountRows = await db
    .select({ userId: account.userId, hasPassword: sql<boolean>`(${account.password} is not null)` })
    .from(account)
  const accountMap = new Map(accountRows.map((a) => [a.userId, a.hasPassword]))

  function toPaymentStatus(s: string | undefined): MemberRow["paymentStatus"] {
    if (s === "paid") return "paid"
    if (s === "pending" || s === "failed" || s === "overdue" || s === "outstanding") return "outstanding"
    return null
  }

  return rows.map((r) => {
    const ms = membershipMap.get(r.id)
    const rawLogin = loginMap.get(r.id)
    const hasAccount = accountMap.get(r.id)
    const payStatus = toPaymentStatus(paymentMap.get(r.id))

    let accountLinked: MemberRow["accountLinked"] = "not_registered"
    if (hasAccount) accountLinked = "linked"
    else if (accountMap.has(r.id)) accountLinked = "invited"

    // Status is always active for now — schema doesn't have a banned col in Drizzle
    const memberStatus: MemberRow["status"] = "active"

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone ?? null,
      role: (r.role as Role) ?? "player",
      status: memberStatus,
      playerName: r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : null,
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
      lastLoginAt: rawLogin ? (rawLogin instanceof Date ? rawLogin : new Date(rawLogin)).toISOString() : null,
      hasPermissionOverride: r.permissions != null,
      gender: r.gender ?? null,
      city: r.city ?? null,
      province: r.province ?? null,
      currentLi: r.currentLi ?? null,
      playtomicRating: r.playtomicRating ?? null,
      playtomicUrl: r.playtomicUrl ?? null,
      avatarUrl: r.avatarUrl ?? null,
      teamId: ms?.teamId ?? null,
      teamName: ms?.teamName ?? null,
      teamClubPaysFees: ms?.teamClubPaysFees ?? null,
      clubId: ms?.clubId ?? null,
      clubName: ms?.clubName ?? null,
      regionId: ms?.regionId ?? null,
      regionName: ms?.regionName ?? null,
      divisionId: ms?.divisionId ?? null,
      divisionName: ms?.divisionName ?? null,
      paymentStatus: payStatus,
      accountLinked,
      registeredBy: null,
      ownedTeamId: ownerMap.get(r.email.trim().toLowerCase())?.teamId ?? null,
      ownedTeamName: ownerMap.get(r.email.trim().toLowerCase())?.teamName ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Unregistered contacts — club contacts / team owner emails with no account
// ---------------------------------------------------------------------------

export type UnregisteredContact = {
  key: string
  name: string | null
  email: string
  phone: string | null
  source: "club_contact" | "club_contact2" | "team_owner"
  clubId: number | null
  clubName: string | null
  ownedTeamId: number | null
  ownedTeamName: string | null
}

export async function listUnregisteredContacts(): Promise<UnregisteredContact[]> {
  await requireMemberManager()

  const existingUsers = await db.select({ email: user.email }).from(user)
  const knownEmails = new Set(existingUsers.map((u) => u.email.trim().toLowerCase()))

  const clubRows = await db
    .select({ id: clubs.id, name: clubs.name, contactName: clubs.contactName, contactEmail: clubs.contactEmail, contactEmail2: clubs.contactEmail2, contactPhone: clubs.contactPhone })
    .from(clubs)

  // Include ALL teams regardless of status — a pending/inactive team's
  // ownerEmail is still a real person who needs to show up in Members.
  const teamRows = await db
    .select({ id: teams.id, name: teams.name, ownerEmail: teams.ownerEmail, ownerName: teams.ownerName, ownerPhone: teams.ownerPhone })
    .from(teams)

  const contacts: UnregisteredContact[] = []
  const seen = new Set<string>()

  function push(c: UnregisteredContact) {
    const norm = c.email.trim().toLowerCase()
    if (!norm || knownEmails.has(norm) || seen.has(norm)) return
    seen.add(norm)
    contacts.push({ ...c, email: norm })
  }

  for (const club of clubRows) {
    if (club.contactEmail) {
      push({ key: `club-${club.id}-1`, name: club.contactName ?? null, email: club.contactEmail, phone: club.contactPhone ?? null, source: "club_contact", clubId: club.id, clubName: club.name, ownedTeamId: null, ownedTeamName: null })
    }
    if (club.contactEmail2) {
      push({ key: `club-${club.id}-2`, name: null, email: club.contactEmail2, phone: null, source: "club_contact2", clubId: club.id, clubName: club.name, ownedTeamId: null, ownedTeamName: null })
    }
  }

  for (const team of teamRows) {
    if (team.ownerEmail) {
      // Use ownerName only if it's a real name (not an email address — guards bad data).
      // Fall back to "Owner of <team name>" so the entry is identifiable even when
      // no real name has been recorded yet.
      const realName = team.ownerName && !team.ownerName.includes("@") ? team.ownerName.trim() : null
      const displayName = realName || `Owner of ${team.name}`
      push({ key: `team-${team.id}-1`, name: displayName, email: team.ownerEmail, phone: team.ownerPhone ?? null, source: "team_owner", clubId: null, clubName: null, ownedTeamId: team.id, ownedTeamName: team.name })
    }
  }

  return contacts.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
}

export async function createAccountForContact(input: {
  name: string
  email: string
  phone?: string | null
  role?: Role
}): Promise<{ ok: boolean; error?: string; password?: string }> {
  await requireMemberManager()

  const res = await provisionUser({ name: input.name.trim(), email: input.email, role: input.role ?? "org_admin", password: undefined })
  if (!res.ok) return res

  const phone = input.phone?.trim() || null
  if (phone) {
    const [existing] = await db.select({ id: userMeta.id }).from(userMeta).where(eq(userMeta.userId, res.userId)).limit(1)
    if (existing) {
      await db.update(userMeta).set({ phone, updatedAt: new Date() }).where(eq(userMeta.userId, res.userId))
    } else {
      await db.insert(userMeta).values({ userId: res.userId, role: input.role ?? "org_admin", phone })
    }
  }

  revalidatePath("/admin/members")
  revalidatePath("/admin/teams")
  return { ok: true, password: res.password }
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
    playtomicRating?: number | null
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
  if (input.playtomicRating !== undefined) userUpdate.playtomicRating = input.playtomicRating
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

/** Inline-edit: update a member's Playtomic rating and recalculate their team's avg. */
export async function updateMemberRating(userId: string, rating: number | null) {
  await requireMemberManager()
  const val = rating != null ? Math.max(0, Math.min(7, rating)) : null
  // Write to both tables: ppl_players is the canonical source for team stats;
  // user.playtomicRating is kept in sync as a convenience mirror.
  await Promise.all([
    db.update(user).set({ playtomicRating: val, updatedAt: new Date() }).where(eq(user.id, userId)),
    db.update(players).set({ playtomicRating: val, updatedAt: new Date() }).where(eq(players.userId, userId)),
  ])
  // Recalculate any team they're on
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.playerId, userId), eq(teamMembers.status, "active")))
    .limit(1)
  if (membership) await recomputeTeamStats(membership.teamId)
  revalidatePath("/admin/members")
  return { ok: true }
}

/** Inline-edit: move a player to a different team (or remove from team). */
export async function updateMemberTeam(userId: string, newTeamId: number | null) {
  await requireMemberManager()

  // Find and deactivate current membership
  const [current] = await db
    .select({ id: teamMembers.id, teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.playerId, userId), eq(teamMembers.status, "active")))
    .limit(1)

  if (current) {
    await db.update(teamMembers).set({ status: "inactive", updatedAt: new Date() }).where(eq(teamMembers.id, current.id))
    // Clear any pairing slots this player occupied on their old team
    await db.update(teamPairings).set({ playerId: null, updatedAt: new Date() })
      .where(and(eq(teamPairings.teamId, current.teamId), eq(teamPairings.playerId, userId)))
    await recomputeTeamStats(current.teamId)
  }

  if (newTeamId) {
    // Re-activate existing inactive row or insert fresh
    const [existing] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, newTeamId), eq(teamMembers.playerId, userId)))
      .limit(1)
    if (existing) {
      await db.update(teamMembers).set({ status: "active", updatedAt: new Date() }).where(eq(teamMembers.id, existing.id))
    } else {
      await db.insert(teamMembers).values({ teamId: newTeamId, playerId: userId, role: "member", status: "active", initiatedBy: "admin" })
    }
    await recomputeTeamStats(newTeamId)
    await db.update(user).set({ availability: "on_team", lookingForTeam: false, onMarketplace: false }).where(eq(user.id, userId))

    // Auto-assign to the best available squad category slot based on rating + gender.
    await autoAssignPairingSlot(userId, newTeamId)
  } else {
    // Removed from all teams — mark as looking
    await db.update(user).set({ lookingForTeam: true, availability: "available" }).where(eq(user.id, userId))
  }

  revalidatePath("/admin/members")
  revalidatePath("/admin/teams")
  return { ok: true }
}

/**
 * Places a player into the highest available pairing slot they qualify for.
 *
 * Category matching rules:
 *   - Gender derived from the player's gender field (male → men's categories,
 *     female → ladies categories). Gender is matched by category.gender in DB,
 *     but we also fall back to name-based matching for bad DB data.
 *   - Rating eligibility: player's playtomicRating must be >= category.playerMinLi.
 *   - "Highest" = highest playerMinLi threshold the player clears (most competitive).
 *   - Within that category, fills the first empty slot (pairIndex 1 slot 1 → 1/2 → 2/1 → 2/2).
 *   - If already assigned to a slot in this team, no-op.
 */
async function autoAssignPairingSlot(userId: string, teamId: number) {
  // Fetch player details
  const [playerRow] = await db
    .select({ gender: user.gender, playtomicRating: user.playtomicRating })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!playerRow) return

  const rating = playerRow.playtomicRating ?? 0
  const gender = (playerRow.gender ?? "male").toLowerCase() // "male" | "female"
  const dbGender = gender === "female" ? "female" : "male"

  // Check if already in a slot for this team
  const [alreadySlotted] = await db
    .select({ id: teamPairings.id })
    .from(teamPairings)
    .where(and(eq(teamPairings.teamId, teamId), eq(teamPairings.playerId, userId)))
    .limit(1)
  if (alreadySlotted) return // already placed, don't move

  // Fetch all categories matching the player's gender, sorted best-fit first.
  // Primary list: categories where playerMinLi <= rating (player meets the minimum),
  // ordered by playerMinLi DESC so the most competitive eligible category is tried first.
  // Fallback: if the player's rating is below every category's minimum (e.g. a 2.28
  // female with only a "Ladies Open" min 2.5 category), use the category with the
  // lowest playerMinLi for that gender — the most accessible one available.
  const allGenderCats = await db
    .select({ name: categories.name, playerMinLi: categories.playerMinLi })
    .from(categories)
    .where(eq(categories.gender, dbGender))
    .orderBy(desc(categories.playerMinLi))

  const eligibleCats = allGenderCats.filter((c) => c.playerMinLi <= rating)

  // If no category meets the minimum threshold, fall back to the lowest-threshold
  // gender category so the player is still placed somewhere sensible.
  const catsToTry = eligibleCats.length > 0
    ? eligibleCats
    : [...allGenderCats].sort((a, b) => a.playerMinLi - b.playerMinLi).slice(0, 1)

  if (catsToTry.length === 0) return // no categories exist for this gender at all

  // Fetch existing pairing rows for this team to find occupied slots
  const existingSlots = await db
    .select({ category: teamPairings.category, pairIndex: teamPairings.pairIndex, slotIndex: teamPairings.slotIndex, playerId: teamPairings.playerId })
    .from(teamPairings)
    .where(eq(teamPairings.teamId, teamId))

  // Try each category (most competitive first, fallback to most accessible) until we find a free slot
  for (const cat of catsToTry) {
    // All possible slots: pair 1 slot 1, pair 1 slot 2, pair 2 slot 1, pair 2 slot 2
    const slotCombos = [{ pairIndex: 1, slotIndex: 1 }, { pairIndex: 1, slotIndex: 2 }, { pairIndex: 2, slotIndex: 1 }, { pairIndex: 2, slotIndex: 2 }]
    for (const { pairIndex, slotIndex } of slotCombos) {
      const existing = existingSlots.find(
        (s) => s.category === cat.name && s.pairIndex === pairIndex && s.slotIndex === slotIndex
      )
      if (!existing) {
        // Slot row doesn't exist yet — insert it
        await db.insert(teamPairings).values({ teamId, category: cat.name, pairIndex, slotIndex, playerId: userId })
        return
      }
      if (existing.playerId === null) {
        // Slot exists but is empty — claim it
        await db.update(teamPairings).set({ playerId: userId, updatedAt: new Date() })
          .where(and(eq(teamPairings.teamId, teamId), eq(teamPairings.category, cat.name), eq(teamPairings.pairIndex, pairIndex), eq(teamPairings.slotIndex, slotIndex)))
        return
      }
    }
    // All 4 slots in this category are occupied — try the next eligible one
  }
  // No slot found in any eligible category — player is still on the team but unslotted
}

/** Inline-edit: update a member's account status (stored as a meta note for now). */
export async function updateMemberStatus(userId: string, status: "active" | "inactive" | "suspended") {
  await requireMemberManager()
  // The Drizzle user schema does not define a banned/status column.
  // Persist the status intent in userMeta permissions field as a marker until
  // the schema is extended with a dedicated status column.
  // For now just revalidate so the UI refreshes correctly.
  void status // acknowledged — no-op persist until schema extended
  revalidatePath("/admin/members")
  return { ok: true }
}

/** Fetch all active teams for the team-assignment dropdown. */
export async function listTeamsForAssignment(): Promise<{ id: number; name: string }[]> {
  await requireMemberManager()
  // Include all teams regardless of status — pending/inactive teams still
  // have real members and a real owner who needs to be assignable.
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .orderBy(asc(teams.name))
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

/**
 * Assign a registered member as the owner of a team (or clear the owner).
 * This is the single write path: it updates teams.ownerEmail + teams.ownerName
 * so that the Teams admin page, the My Team view, and the access layer all
 * read from the same source of truth. If teamId is null the member's current
 * team ownership is cleared and permissions are revoked if no other team
 * still depends on them.
 */
export async function setMemberAsTeamOwner(userId: string, teamId: number | null) {
  await requireMemberManager()

  // Fetch the member's current email + name.
  const [member] = await db
    .select({ email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!member) return { ok: false as const, error: "Member not found." }

  const memberEmail = member.email.trim().toLowerCase()
  const memberName =
    (member.firstName ? `${member.firstName} ${member.lastName ?? ""}`.trim() : null) ||
    member.name?.trim() ||
    member.email

  // Clear owner from any team that currently lists this member as owner
  // (enforces one primary-owner assignment per member at a time).
  await db
    .update(teams)
    .set({ ownerEmail: null, ownerName: null, updatedAt: new Date() })
    .where(sql`lower(${teams.ownerEmail}) = ${memberEmail}`)

  if (teamId !== null) {
    // Stamp the new team.
    await db
      .update(teams)
      .set({ ownerEmail: memberEmail, ownerName: memberName, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
  }
  // Access is derived live from teams.ownerEmail by getAccessContext on every
  // request — no separate permission-grant call is needed. Clearing ownerEmail
  // above is sufficient to revoke access for the previous assignment.

  revalidatePath("/admin/members")
  revalidatePath("/admin/teams")
  return { ok: true as const }
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

/** Resend a pending team invite email to the player (by their userId). */
export async function resendInviteEmail(userId: string) {
  await requireSuperAdmin()
  const [u] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  if (!u) return { ok: false, error: "User not found" }

  // Find the most recent pending invite for this email
  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(and(eq(teamInvites.email, u.email.trim().toLowerCase()), eq(teamInvites.status, "pending")))
    .orderBy(desc(teamInvites.createdAt))
    .limit(1)

  if (!invite) return { ok: false, error: "No pending invite found for this member." }

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, invite.teamId)).limit(1)
  const [invitingUser] = invite.invitedByUserId
    ? await db.select({ name: user.name }).from(user).where(eq(user.id, invite.invitedByUserId)).limit(1)
    : [{ name: "Your captain" }]

  const { sendEmail, teamInviteEmail, appBaseUrl } = await import("@/lib/email")
  const base = appBaseUrl()
  const acceptUrl = `${base}/invite/${invite.token}`
  const declineUrl = `${base}/invite/${invite.token}/decline`
  const { subject, html, text } = teamInviteEmail({
    teamName: team?.name ?? "your team",
    captainName: invitingUser?.name ?? "Your captain",
    acceptUrl,
    declineUrl,
  })

  const { sent } = await sendEmail({ to: u.email, subject, html, text })
  if (!sent) return { ok: false, error: "Could not send invite email." }

  revalidatePath("/admin/members")
  return { ok: true }
}

/** Update a member's email address. */
export async function updateMemberEmail(userId: string, email: string) {
  const { me } = await requireMemberManager()
  if (userId === me.id) return { ok: false, error: "Use the account settings to change your own email." }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes("@")) return { ok: false, error: "Enter a valid email address." }

  const [dupe] = await db.select({ id: user.id }).from(user).where(eq(user.email, trimmed)).limit(1)
  if (dupe && dupe.id !== userId) return { ok: false, error: "That email is already in use." }

  await db.update(user).set({ email: trimmed, updatedAt: new Date() }).where(eq(user.id, userId))
  revalidatePath("/admin/members")
  return { ok: true }
}

/** Toggle a member's paid status by inserting or updating their individual payment record. */
export async function updateMemberPaid(userId: string, paid: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireMemberManager()

  // Find the most recent individual payment row
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.payerUserId, userId), eq(payments.type, "individual")))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  const newStatus = paid ? "paid" : "outstanding"

  if (existing) {
    await db.update(payments).set({ status: newStatus }).where(eq(payments.id, existing.id))
  } else {
    // Find team membership to link the payment
    const [membership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.playerId, userId), eq(teamMembers.status, "active")))
      .limit(1)

    await db.insert(payments).values({
      payerUserId: userId,
      teamId: membership?.teamId ?? null,
      type: "individual",
      status: newStatus,
      amount: 0,
    })
  }

  revalidatePath("/admin/members")
  return { ok: true }
}

/** Permanently delete a member's account and all associated data. */
export async function deleteMember(userId: string) {
  const { me, isMainAdmin } = await requireMemberManager()
  if (!isMainAdmin) return { ok: false, error: "Only the main admin can delete accounts." }
  if (userId === me.id) return { ok: false, error: "You cannot delete your own account." }

  // Deactivate team memberships and recompute affected teams
  const activeMemberships = await db
    .select({ id: teamMembers.id, teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.playerId, userId), eq(teamMembers.status, "active")))

  for (const m of activeMemberships) {
    await db.update(teamMembers).set({ status: "inactive" }).where(eq(teamMembers.id, m.id))
    await recomputeTeamStats(m.teamId)
  }

  // Cancel pending invites
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
  if (u) {
    await db
      .update(teamInvites)
      .set({ status: "cancelled" })
      .where(and(eq(teamInvites.email, u.email), eq(teamInvites.status, "pending")))
  }

  // Delete auth account — Better Auth cascades sessions/accounts
  try {
    await auth.api.deleteUser({ body: { userId } } as any)
  } catch {
    // Fallback: manually delete from tables if the API call fails
    await db.delete(user).where(eq(user.id, userId))
  }

  revalidatePath("/admin/members")
  revalidatePath("/admin/teams")
  return { ok: true }
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
    const [t] = await db
      .select({ id: teams.id, name: teams.name, captainUserId: teams.captainUserId, organisationId: teams.organisationId })
      .from(teams)
      .where(eq(teams.id, input.assignTeamId))
      .limit(1)
    if (!t) return { ok: false, error: "Selected team not found." }
    if (me.realRole === "captain") {
      if (t.captainUserId !== me.id) return { ok: false, error: "You can only add players to your own teams." }
    } else if (me.realRole === "org_admin") {
      const [org] = await db.select({ id: organisations.id, ownerUserId: organisations.ownerUserId }).from(organisations).where(eq(organisations.id, t.organisationId ?? 0)).limit(1)
      if (!org || org.ownerUserId !== me.id) return { ok: false, error: "You cannot add players to that team." }
    }
    targetTeam = t as typeof teams.$inferSelect
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

  const playerId = (await ensurePlayerProfile(res.userId, firstName, lastName, {
    gender: input.gender,
    playtomicUrl: input.playtomicUrl,
    bio: input.bio,
  })) ?? res.userId

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

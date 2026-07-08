import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userMeta, user } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { cookies, headers } from "next/headers"

export type Role = "player" | "captain" | "org_admin" | "super_admin"

export const ACTING_ROLE_COOKIE = "sapl_acting_role"

// Roles a super admin is allowed to impersonate (everything except themselves).
export const IMPERSONATABLE_ROLES: Role[] = ["org_admin", "captain", "player"]

export type CurrentUser = {
  id: string
  name: string
  email: string
  /** Effective role used for display / page rendering (may be impersonated). */
  role: Role
  /** The user's actual role stored in the database. */
  realRole: Role
  /** True when the real role is super_admin (god mode + role switcher). */
  isSuperAdmin: boolean
  /** The role currently being previewed, or null when viewing as themselves. */
  actingRole: Role | null
  isPlayer: boolean
  onMarketplace: boolean
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getOptionalSession() {
  try {
    return await getSession()
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession()
  if (!session?.user) return null

  // Fire-and-forget: stamp the exact moment this user touched the system.
  // Never awaited so it never delays the request. This is the single source of
  // truth for the "Last Login" column in the admin members table.
  db.update(user)
    .set({ lastActiveAt: sql`now()` })
    .where(eq(user.id, session.user.id))
    .execute()
    .catch(() => {})

  const [meta] = await db
    .select({ id: userMeta.id, role: userMeta.role, phone: userMeta.phone })
    .from(userMeta)
    .where(eq(userMeta.userId, session.user.id))
    .limit(1)

  // Try to fetch player status, but gracefully handle missing columns during migration
  let isPlayer = false
  let onMarketplace = false
  try {
    const [userData] = await db
      .select({ isPlayer: user.isPlayer, onMarketplace: user.onMarketplace })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
    isPlayer = userData?.isPlayer ?? false
    onMarketplace = userData?.onMarketplace ?? false
  } catch {
    // Columns may not exist yet if migration hasn't run — silently default to false
  }

  const realRole = (meta?.role as Role) ?? "player"
  const isSuperAdmin = realRole === "super_admin"

  // Only super admins may impersonate, and only into one of the previewable roles.
  let actingRole: Role | null = null
  if (isSuperAdmin) {
    const cookieRole = (await cookies()).get(ACTING_ROLE_COOKIE)?.value as Role | undefined
    if (cookieRole && IMPERSONATABLE_ROLES.includes(cookieRole)) {
      actingRole = cookieRole
    }
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: actingRole ?? realRole,
    realRole,
    isSuperAdmin,
    actingRole,
    isPlayer,
    onMarketplace,
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  return user
}

export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser()
  // Super admins always pass (impersonation is a view-only aid, not a power limit).
  if (user.realRole === "super_admin") return user
  if (!roles.includes(user.role)) throw new Error("Forbidden")
  return user
}

export function roleRank(role: Role): number {
  return { player: 1, captain: 2, org_admin: 3, super_admin: 4 }[role]
}

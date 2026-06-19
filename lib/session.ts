import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userMeta, players } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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
  playerId: number | null
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

  const [meta] = await db.select().from(userMeta).where(eq(userMeta.userId, session.user.id)).limit(1)
  const [player] = await db.select().from(players).where(eq(players.userId, session.user.id)).limit(1)

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
    playerId: player?.id ?? null,
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

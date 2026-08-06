"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { userMeta, user, teams, clubs } from "@/lib/db/schema"
import { getCurrentUser, ACTING_ROLE_COOKIE, ACTING_USER_COOKIE, IMPERSONATABLE_ROLES, type Role } from "@/lib/session"
import { eq, and, or, sql } from "drizzle-orm"

/**
 * Sets (or clears) the role a super admin is previewing.
 * Pass "self" / "super_admin" to stop impersonating and return to full admin.
 */
export async function setActingRole(role: Role | "self") {
  const me = await getCurrentUser()
  if (!me?.isSuperAdmin) throw new Error("Forbidden")

  const jar = await cookies()
  if (role === "self" || role === "super_admin" || !IMPERSONATABLE_ROLES.includes(role)) {
    jar.delete(ACTING_ROLE_COOKIE)
    jar.delete(ACTING_USER_COOKIE)
  } else {
    jar.set(ACTING_ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    })
  }

  revalidatePath("/", "layout")
  return { ok: true }
}

export type ViewAsMemberOption = {
  userId: string
  label: string
  role: Role
  hint: string
}

export async function listViewAsMembers(): Promise<ViewAsMemberOption[]> {
  const me = await getCurrentUser()
  if (!me?.isSuperAdmin) throw new Error("Forbidden")

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: userMeta.role,
      ownsTeam: sql<boolean>`exists(select 1 from ${teams} t where lower(t."ownerEmail") = lower(${user.email}) or lower(t."ownerEmail2") = lower(${user.email}))`,
      ownsClub: sql<boolean>`exists(select 1 from ${clubs} c where lower(c."contactEmail") = lower(${user.email}) or lower(c."contactEmail2") = lower(${user.email}))`,
    })
    .from(user)
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    .where(and(sql`lower(${user.email}) != lower(${me.email})`, or(eq(userMeta.role, "player"), eq(userMeta.role, "captain"), eq(userMeta.role, "org_admin"), eq(userMeta.role, "super_admin"))))
    .orderBy(sql`lower(${user.name})`, sql`lower(${user.email})`)

  return rows.map((row) => {
    const role = (row.role as Role | null) ?? "player"
    const badges = [
      row.ownsTeam ? "team owner" : null,
      row.ownsClub ? "venue owner" : null,
    ].filter(Boolean)

    return {
      userId: row.userId,
      label: `${row.name}${badges.length ? ` (${badges.join(", ")})` : ""}`,
      role,
      hint: row.email,
    }
  })
}

export async function setActingMember(userId: string | "self") {
  const me = await getCurrentUser()
  if (!me?.isSuperAdmin) throw new Error("Forbidden")

  const jar = await cookies()
  if (userId === "self") {
    jar.delete(ACTING_USER_COOKIE)
    jar.delete(ACTING_ROLE_COOKIE)
    revalidatePath("/", "layout")
    return { ok: true }
  }

  const [member] = await db
    .select({ id: user.id, role: userMeta.role })
    .from(user)
    .leftJoin(userMeta, eq(userMeta.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1)

  if (!member || member.id === me.id) {
    jar.delete(ACTING_USER_COOKIE)
    jar.delete(ACTING_ROLE_COOKIE)
    revalidatePath("/", "layout")
    return { ok: true }
  }

  const role = ((member.role as Role | null) ?? "player")
  const actingRole = role === "super_admin" ? "player" : role

  jar.set(ACTING_USER_COOKIE, member.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  })
  jar.delete(ACTING_ROLE_COOKIE)

  revalidatePath("/", "layout")
  return { ok: true }
}

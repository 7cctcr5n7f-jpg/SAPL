"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { getCurrentUser, ACTING_ROLE_COOKIE, IMPERSONATABLE_ROLES, type Role } from "@/lib/session"

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

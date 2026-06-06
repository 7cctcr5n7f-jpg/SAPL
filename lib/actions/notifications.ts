"use server"

import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { eq, and, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function markAllRead() {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)))
  revalidatePath("/dashboard/notifications")
  revalidatePath("/dashboard")
  return { success: "All caught up." }
}

export async function markRead(id: number) {
  const me = await getCurrentUser()
  if (!me) return { error: "Not authorised" }
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, me.id)))
  revalidatePath("/dashboard/notifications")
  return { success: "Marked read." }
}

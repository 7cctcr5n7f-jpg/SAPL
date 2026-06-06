import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { notificationProvider, type NotificationChannel } from "@/lib/providers"

export type NotifyInput = {
  userId?: string | null
  scope?: "broadcast" | "team" | "club" | "division" | "direct" | "user"
  scopeId?: number | null
  type: string
  title: string
  body: string
  channel?: NotificationChannel
  to?: string
}

/**
 * Persists an in-app notification and dispatches it through the configured
 * provider (WhatsApp/email). The provider currently queues + logs until real
 * credentials are wired in — swap the provider implementation to go live.
 */
export async function notify(input: NotifyInput) {
  const channel = input.channel ?? "in_app"
  const dispatch = await notificationProvider.send({
    channel,
    to: input.to,
    title: input.title,
    body: input.body,
  })

  await db.insert(notifications).values({
    userId: input.userId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    channel,
    status: dispatch.status,
    scope: input.scope === "user" ? "direct" : (input.scope ?? null),
    scopeId: input.scopeId ?? null,
    sentAt: dispatch.status === "sent" ? new Date() : null,
  })

  return dispatch
}

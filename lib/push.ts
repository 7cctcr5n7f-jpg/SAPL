import "server-only"
import webpush from "web-push"
import { db } from "@/lib/db"
import { pushSubscriptions } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"

/**
 * Web Push helper. Push is only active once VAPID keys are configured via env:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT (mailto: or https: contact, optional)
 *
 * Generate a key pair once with:  npx web-push generate-vapid-keys
 *
 * Until keys are present every helper is a safe no-op, so the rest of the app
 * keeps working and we can flip push on later without code changes.
 */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@sapl.co.za"

export function isPushConfigured() {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY)
}

let configured = false
function ensureConfigured() {
  if (configured || !isPushConfigured()) return
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!)
  configured = true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

type SubRow = { id: number; endpoint: string; p256dh: string; auth: string }

async function deliver(rows: SubRow[], payload: PushPayload) {
  ensureConfigured()
  if (!isPushConfigured() || rows.length === 0) return { sent: 0, failed: 0 }

  const data = JSON.stringify(payload)
  const staleIds: number[] = []
  let sent = 0
  let failed = 0

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          data,
        )
        sent++
      } catch (err) {
        failed++
        const statusCode = (err as { statusCode?: number })?.statusCode
        // 404/410 mean the subscription is gone — prune it.
        if (statusCode === 404 || statusCode === 410) staleIds.push(row.id)
      }
    }),
  )

  if (staleIds.length) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, staleIds))
  }
  return { sent, failed }
}

/** Send a push to every subscriber (e.g. league-wide announcements). */
export async function sendPushToAll(payload: PushPayload) {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
  return deliver(rows, payload)
}

/** Send a push to a specific user's devices (fixture/match reminders, etc.). */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
  return deliver(rows, payload)
}

/** Send to a set of users at once. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, failed: 0 }
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))
  return deliver(rows, payload)
}

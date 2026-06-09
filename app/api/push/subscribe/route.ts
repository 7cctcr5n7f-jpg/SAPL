import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { pushSubscriptions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/session"
import { isPushConfigured } from "@/lib/push"

export const runtime = "nodejs"

// GET → expose whether push is enabled + the public VAPID key for the client.
export async function GET() {
  return NextResponse.json({
    enabled: isPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  })
}

// POST → store (or refresh) a subscription.
export async function POST(req: Request) {
  try {
    const sub = await req.json()
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
    }

    const [user, hdrs] = await Promise.all([getCurrentUser(), headers()])
    const userAgent = hdrs.get("user-agent") ?? null

    await db
      .insert(pushSubscriptions)
      .values({
        userId: user?.id ?? null,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: user?.id ?? null,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent,
        },
      })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 })
  }
}

// DELETE → remove a subscription by endpoint.
export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 })
  }
}

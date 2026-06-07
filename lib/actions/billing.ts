"use server"

import { db } from "@/lib/db"
import { feeNotes } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { fmtZAR } from "@/lib/format"
import { BRAND } from "@/lib/constants"

async function requireLeagueAdmin() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  if (user.realRole !== "league_admin" && user.realRole !== "super_admin") {
    throw new Error("League admin access required")
  }
  return user
}

type FeeKey = { kind: "player" | "team"; teamId: number; playerId: number }

async function upsertNote(key: FeeKey, patch: Partial<typeof feeNotes.$inferInsert>, userId: string) {
  const [existing] = await db
    .select()
    .from(feeNotes)
    .where(and(eq(feeNotes.kind, key.kind), eq(feeNotes.teamId, key.teamId), eq(feeNotes.playerId, key.playerId)))
    .limit(1)

  if (existing) {
    await db
      .update(feeNotes)
      .set({ ...patch, updatedByUserId: userId, updatedAt: new Date() })
      .where(eq(feeNotes.id, existing.id))
    return existing
  }
  await db.insert(feeNotes).values({
    kind: key.kind,
    teamId: key.teamId,
    playerId: key.playerId,
    updatedByUserId: userId,
    ...patch,
  })
  return null
}

/** Save (or clear) the admin note on an outstanding-fee line item. */
export async function saveFeeNote(key: FeeKey, note: string) {
  const me = await requireLeagueAdmin()
  await upsertNote(key, { note: note.trim() || null }, me.id)
  revalidatePath("/admin/billing")
  return { ok: true }
}

/**
 * Email a "fees outstanding" reminder for a single line item and record that a
 * reminder was sent (timestamp + count) so admins can track follow-ups.
 */
export async function sendFeeReminder(input: {
  key: FeeKey
  email: string | null
  payerName: string
  teamName: string
  amount: number
}) {
  const me = await requireLeagueAdmin()
  if (!input.email) return { ok: false, error: "No email on file for this payer." }

  const subject = `${BRAND.short} league fee outstanding`
  const html = `
  <div style="background:#0a0a0a;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;border-bottom:1px solid #262626;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:2px;">${BRAND.short}</span>
        <span style="color:#E10600;font-size:20px;font-weight:800;"> ●</span>
      </div>
      <div style="padding:32px;">
        <h1 style="color:#ffffff;font-size:22px;margin:0 0 12px;">Outstanding league fee</h1>
        <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Hi ${input.payerName}, our records show an outstanding ${BRAND.name} fee of
          <strong style="color:#ffffff;">${fmtZAR(input.amount)}</strong> for <strong style="color:#ffffff;">${input.teamName}</strong>.
        </p>
        <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 8px;">
          Please settle this as soon as possible so your league participation isn't affected. If you've already paid, you can ignore this message.
        </p>
        <p style="color:#737373;font-size:12px;line-height:1.6;margin:24px 0 0;">
          Questions? Just reply to this email and the league office will help.
        </p>
      </div>
    </div>
  </div>`
  const text = `Hi ${input.payerName}, our records show an outstanding ${BRAND.name} fee of ${fmtZAR(input.amount)} for ${input.teamName}. Please settle this as soon as possible.`

  const { sent } = await sendEmail({ to: input.email, subject, html, text })

  const [existing] = await db
    .select()
    .from(feeNotes)
    .where(
      and(
        eq(feeNotes.kind, input.key.kind),
        eq(feeNotes.teamId, input.key.teamId),
        eq(feeNotes.playerId, input.key.playerId),
      ),
    )
    .limit(1)
  await upsertNote(
    input.key,
    { lastReminderAt: new Date(), reminderCount: (existing?.reminderCount ?? 0) + 1 },
    me.id,
  )

  revalidatePath("/admin/billing")
  return { ok: true, sent }
}

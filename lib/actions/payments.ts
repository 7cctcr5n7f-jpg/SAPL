"use server"

import { db } from "@/lib/db"
import { payments, teams, user as userTable } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { buildPayFastUrl } from "@/lib/payfast"
import { splitVatInclusive, DEFAULT_LEAGUE_JOIN_FEE, TEAM_SQUAD_SIZE } from "@/lib/constants"
import { and, eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

/** Derive the app's base URL for PayFast return/cancel/notify URLs. */
async function getBaseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get("host") ?? "localhost:3000"
  const proto = host.startsWith("localhost") ? "http" : "https"
  return `${proto}://${host}`
}

/**
 * Create (or reuse an existing pending) individual player payment and return
 * a signed PayFast redirect URL. Called when a player (clubPaysFees=false)
 * clicks "Pay Now".
 */
export async function createPlayerPayment(teamId: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: "Not authenticated" }

  const [team] = await db
    .select({ id: teams.id, name: teams.name, seasonId: teams.seasonId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return { ok: false, error: "Team not found" }

  // Check for an existing pending payment — reuse if it exists.
  const [existing] = await db
    .select({ id: payments.id, reference: payments.reference })
    .from(payments)
    .where(
      and(
        eq(payments.teamId, teamId),
        eq(payments.playerId, me.id),
        eq(payments.type, "individual"),
        eq(payments.status, "pending"),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1)

  let paymentId: number
  let reference: string

  if (existing) {
    paymentId = existing.id
    reference = existing.reference ?? `SAPL-IND-${existing.id}`
  } else {
    const fee = DEFAULT_LEAGUE_JOIN_FEE
    const { amount, vatAmount } = splitVatInclusive(fee)
    const [inserted] = await db
      .insert(payments)
      .values({
        type: "individual",
        payerUserId: me.id,
        playerId: me.id,
        teamId,
        seasonId: team.seasonId,
        amount,
        vatAmount,
        currency: "ZAR",
        status: "pending",
        provider: "payfast",
        description: `SAPL league fee — ${team.name}`,
      })
      .returning({ id: payments.id })
    paymentId = inserted.id
    reference = `SAPL-IND-${paymentId}`
    await db.update(payments).set({ reference }).where(eq(payments.id, paymentId))
  }

  const base = await getBaseUrl()
  const [firstName, ...rest] = (me.name ?? "").trim().split(/\s+/)

  const url = buildPayFastUrl({
    amount: DEFAULT_LEAGUE_JOIN_FEE, // R500 VAT inclusive
    itemName: `SAPL League Fee — ${team.name}`,
    mPaymentId: reference,
    nameFirst: firstName,
    nameLast: rest.join(" "),
    emailAddress: me.email,
    returnUrl: `${base}/dashboard?payment=success`,
    cancelUrl: `${base}/dashboard?payment=cancelled`,
    notifyUrl: `${base}/api/payfast/notify`,
  })

  return { ok: true, url }
}

/**
 * Create (or reuse an existing pending) team payment for a team owner and
 * return a signed PayFast redirect URL. Called when a captain/owner on a
 * clubPaysFees=true team clicks "Pay Now". Amount is R4000 (8 × R500).
 */
export async function createTeamPayment(teamId: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: "Not authenticated" }

  const [team] = await db
    .select({ id: teams.id, name: teams.name, seasonId: teams.seasonId, clubPaysFees: teams.clubPaysFees })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return { ok: false, error: "Team not found" }
  if (!team.clubPaysFees) return { ok: false, error: "Team is not on club-pays-fees model" }

  // Check for an existing pending team payment.
  const [existing] = await db
    .select({ id: payments.id, reference: payments.reference })
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.type, "team"), eq(payments.status, "pending")))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  let paymentId: number
  let reference: string

  const totalFee = DEFAULT_LEAGUE_JOIN_FEE * TEAM_SQUAD_SIZE // 500 × 8 = 4000
  const { amount, vatAmount } = splitVatInclusive(totalFee)

  if (existing) {
    paymentId = existing.id
    reference = existing.reference ?? `SAPL-TEAM-${existing.id}`
  } else {
    const [inserted] = await db
      .insert(payments)
      .values({
        type: "team",
        payerUserId: me.id,
        playerId: me.id,
        teamId,
        seasonId: team.seasonId,
        amount,
        vatAmount,
        currency: "ZAR",
        status: "pending",
        provider: "payfast",
        description: `SAPL team league fee — ${team.name} (full squad)`,
      })
      .returning({ id: payments.id })
    paymentId = inserted.id
    reference = `SAPL-TEAM-${paymentId}`
    await db.update(payments).set({ reference }).where(eq(payments.id, paymentId))
  }

  const base = await getBaseUrl()
  const [firstName, ...rest] = (me.name ?? "").trim().split(/\s+/)

  const url = buildPayFastUrl({
    amount: totalFee, // R4000 VAT inclusive
    itemName: `SAPL Team League Fee — ${team.name}`,
    mPaymentId: reference,
    nameFirst: firstName,
    nameLast: rest.join(" "),
    emailAddress: me.email,
    returnUrl: `${base}/dashboard?payment=success`,
    cancelUrl: `${base}/dashboard?payment=cancelled`,
    notifyUrl: `${base}/api/payfast/notify`,
  })

  return { ok: true, url }
}

/**
 * Admin-only: manually mark an individual or team payment as paid.
 * Creates a new `paid` payment record if none exists, or updates an existing
 * one. Useful for EFT / cash payments that bypass PayFast.
 */
export async function markPaymentPaid(input: {
  type: "individual" | "team"
  teamId: number
  playerId: string
}): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser()
  if (!me || me.realRole !== "super_admin") {
    return { ok: false, error: "Super admin access required" }
  }

  const [team] = await db
    .select({ id: teams.id, seasonId: teams.seasonId })
    .from(teams)
    .where(eq(teams.id, input.teamId))
    .limit(1)
  if (!team) return { ok: false, error: "Team not found" }

  // Find the most recent payment of this type for this team+player.
  const [existing] = await db
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(
      and(
        eq(payments.teamId, input.teamId),
        eq(payments.playerId, input.playerId),
        eq(payments.type, input.type),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1)

  if (existing) {
    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payments.id, existing.id))
  } else {
    // No payment row yet — create a paid one directly.
    const totalFee = input.type === "team"
      ? DEFAULT_LEAGUE_JOIN_FEE * TEAM_SQUAD_SIZE
      : DEFAULT_LEAGUE_JOIN_FEE
    const { amount, vatAmount } = splitVatInclusive(totalFee)
    await db.insert(payments).values({
      type: input.type,
      payerUserId: input.playerId,
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: team.seasonId,
      amount,
      vatAmount,
      currency: "ZAR",
      status: "paid",
      provider: "payfast",
      description: `Manually marked as paid by admin`,
      paidAt: new Date(),
    })
  }

  revalidatePath("/admin/billing")
  revalidatePath("/dashboard")
  return { ok: true }
}

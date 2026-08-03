"use server"

import crypto from "crypto"
import { db } from "@/lib/db"
import { payments, teamMembers, teams } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"
import { buildPayFastUrl } from "@/lib/payfast"
import { splitVatInclusive, TEAM_SQUAD_SIZE } from "@/lib/constants"
import { getPlayerFee } from "@/lib/queries"
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function getNotifyBaseUrl(baseUrl: string): string {
  const isLocalHost = /:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl)
  if (!isLocalHost) return baseUrl

  const configured = (
    process.env.PAYFAST_NOTIFY_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).trim()

  return configured ? trimTrailingSlash(configured) : baseUrl
}

function makePaymentReference(kind: "IND" | "TEAM") {
  return `SAPL-${kind}-${crypto.randomUUID()}`
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
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
    .select({ id: teams.id, name: teams.name, seasonId: teams.seasonId, clubPaysFees: teams.clubPaysFees })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return { ok: false, error: "Team not found" }
  if (team.clubPaysFees) return { ok: false, error: "This team's fees are paid by the team owner" }

  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerId, me.id), eq(teamMembers.status, "active")))
    .limit(1)
  if (!membership) return { ok: false, error: "You are not an active player on this team" }

  const [alreadyPaid] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.teamId, teamId),
        eq(payments.playerId, me.id),
        eq(payments.type, "individual"),
        eq(payments.status, "paid"),
      ),
    )
    .orderBy(desc(payments.paidAt), desc(payments.createdAt))
    .limit(1)
  if (alreadyPaid) {
    return { ok: false, error: "Your league fee for this team is already paid" }
  }

  const [latest] = await db
    .select({ id: payments.id, reference: payments.reference, status: payments.status })
    .from(payments)
    .where(
      and(
        eq(payments.teamId, teamId),
        eq(payments.playerId, me.id),
        eq(payments.type, "individual"),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1)

  let reference = latest?.reference ?? ""

  if (latest?.status === "pending") {
    if (!reference) {
      reference = makePaymentReference("IND")
      await db.update(payments).set({ reference }).where(eq(payments.id, latest.id))
    }
  } else {
    const fee = await getPlayerFee(team.seasonId)
    const { amount, vatAmount } = splitVatInclusive(fee)
    reference = makePaymentReference("IND")
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
        reference,
        description: `SAPL league fee — ${team.name}`,
      })
      .returning({ id: payments.id })
    if (!inserted?.id) return { ok: false, error: "Could not create payment link" }
  }

  const base = await getBaseUrl()
  const notifyBase = getNotifyBaseUrl(base)
  const [firstName, ...rest] = (me.name ?? "").trim().split(/\s+/)
  const fee = await getPlayerFee(team.seasonId)

  const url = buildPayFastUrl({
    amount: fee,
    itemName: `SAPL League Fee — ${team.name}`,
    mPaymentId: reference,
    nameFirst: firstName,
    nameLast: rest.join(" "),
    emailAddress: me.email,
    returnUrl: `${base}/dashboard?payment=submitted`,
    cancelUrl: `${base}/dashboard?payment=cancelled`,
    notifyUrl: `${notifyBase}/api/payfast/notify`,
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
    .select({
      id: teams.id,
      name: teams.name,
      seasonId: teams.seasonId,
      clubPaysFees: teams.clubPaysFees,
      captainUserId: teams.captainUserId,
      managerUserId: teams.managerUserId,
      ownerEmail: teams.ownerEmail,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) return { ok: false, error: "Team not found" }
  if (!team.clubPaysFees) return { ok: false, error: "Team is not on club-pays-fees model" }
  const ownerEmail = normalizeEmail(team.ownerEmail)
  const isAllowedOwner =
    team.captainUserId === me.id ||
    team.managerUserId === me.id ||
    (ownerEmail !== "" && ownerEmail === normalizeEmail(me.email))
  if (!isAllowedOwner) return { ok: false, error: "Only the team owner or captain can pay this team fee" }

  const [alreadyPaid] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.type, "team"), eq(payments.status, "paid")))
    .orderBy(desc(payments.paidAt), desc(payments.createdAt))
    .limit(1)
  if (alreadyPaid) {
    return { ok: false, error: "This team fee is already paid" }
  }

  const [latest] = await db
    .select({ id: payments.id, reference: payments.reference, status: payments.status })
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.type, "team")))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  let reference = latest?.reference ?? ""
  const totalFee = (await getPlayerFee(team.seasonId)) * TEAM_SQUAD_SIZE
  const { amount, vatAmount } = splitVatInclusive(totalFee)

  if (latest?.status === "pending") {
    if (!reference) {
      reference = makePaymentReference("TEAM")
      await db.update(payments).set({ reference }).where(eq(payments.id, latest.id))
    }
  } else {
    reference = makePaymentReference("TEAM")
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
        reference,
        description: `SAPL team league fee — ${team.name} (full squad)`,
      })
      .returning({ id: payments.id })
    if (!inserted?.id) return { ok: false, error: "Could not create payment link" }
  }

  const base = await getBaseUrl()
  const notifyBase = getNotifyBaseUrl(base)
  const [firstName, ...rest] = (me.name ?? "").trim().split(/\s+/)

  const url = buildPayFastUrl({
    amount: totalFee, // R4000 VAT inclusive
    itemName: `SAPL Team League Fee — ${team.name}`,
    mPaymentId: reference,
    nameFirst: firstName,
    nameLast: rest.join(" "),
    emailAddress: me.email,
    returnUrl: `${base}/dashboard?payment=submitted`,
    cancelUrl: `${base}/dashboard?payment=cancelled`,
    notifyUrl: `${notifyBase}/api/payfast/notify`,
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
  const [existing] =
    input.type === "team"
      ? team.seasonId == null
        ? await db
            .select({ id: payments.id, status: payments.status })
            .from(payments)
            .where(and(eq(payments.teamId, input.teamId), eq(payments.type, "team")))
            .orderBy(desc(payments.createdAt))
            .limit(1)
        : await db
            .select({ id: payments.id, status: payments.status })
            .from(payments)
            .where(and(eq(payments.teamId, input.teamId), eq(payments.seasonId, team.seasonId), eq(payments.type, "team")))
            .orderBy(desc(payments.createdAt))
            .limit(1)
      : team.seasonId == null
        ? await db
            .select({ id: payments.id, status: payments.status })
            .from(payments)
            .where(
              and(
                eq(payments.teamId, input.teamId),
                eq(payments.playerId, input.playerId),
                eq(payments.type, "individual"),
              ),
            )
            .orderBy(desc(payments.createdAt))
            .limit(1)
        : await db
            .select({ id: payments.id, status: payments.status })
            .from(payments)
            .where(
              and(
                eq(payments.teamId, input.teamId),
                eq(payments.seasonId, team.seasonId),
                eq(payments.playerId, input.playerId),
                eq(payments.type, "individual"),
              ),
            )
            .orderBy(desc(payments.createdAt))
            .limit(1)

  if (existing) {
    if (existing.status === "paid") {
      revalidatePath("/admin/billing")
      revalidatePath("/dashboard")
      return { ok: true }
    }
    await db
      .update(payments)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payments.id, existing.id))
  } else {
    // No payment row yet — create a paid one directly.
    const totalFee = input.type === "team"
      ? (await getPlayerFee(team.seasonId)) * TEAM_SQUAD_SIZE
      : await getPlayerFee(team.seasonId)
    const { amount, vatAmount } = splitVatInclusive(totalFee)
    await db.insert(payments).values({
      type: input.type,
      payerUserId: input.type === "team" ? null : input.playerId,
      playerId: input.type === "team" ? null : input.playerId,
      teamId: input.teamId,
      seasonId: team.seasonId,
      amount,
      vatAmount,
      currency: "ZAR",
      status: "paid",
      provider: null,
      reference: makePaymentReference(input.type === "team" ? "TEAM" : "IND"),
      description: `Manually marked as paid by admin`,
      paidAt: new Date(),
    })
  }

  revalidatePath("/admin/billing")
  revalidatePath("/dashboard")
  return { ok: true }
}

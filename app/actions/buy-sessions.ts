'use server'

import { db } from '@/lib/db'
import { sessionPurchases } from '@/lib/db/schema'
import { resolveSessionPack } from '@/lib/content-queries'
import { buildPayfastFields, isPayfastConfigured, PAYFAST_PROCESS_URL } from '@/lib/payfast'

export type BuyState = {
  ok: boolean
  error?: string
  // When ok, the client auto-submits these fields to PayFast.
  payfast?: { url: string; fields: Record<string, string> }
}

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? '').trim()
}
function bool(fd: FormData, key: string) {
  const v = fd.get(key)
  return v === 'true' || v === 'on'
}

export async function startSessionPurchase(_prev: BuyState, formData: FormData): Promise<BuyState> {
  if (!isPayfastConfigured()) {
    return { ok: false, error: 'Online payments are not configured yet. Please contact us to buy sessions.' }
  }

  // ── Pack (price + bonus resolved server-side; never trust the client) ──
  const quantity = Number(str(formData, 'packQuantity')) || 0
  const pack = await resolveSessionPack(quantity)
  if (!pack) {
    return { ok: false, error: 'That session pack is no longer available. Please choose another.' }
  }

  // ── Member details ──
  const firstName = str(formData, 'firstName')
  const surname = str(formData, 'surname')
  const email = str(formData, 'email')
  const contactNumber = str(formData, 'contactNumber')
  const idNumber = str(formData, 'idNumber')
  const emergencyContactName = str(formData, 'emergencyContactName')
  const emergencyContactNumber = str(formData, 'emergencyContactNumber')

  // ── Agreements + signature ──
  const agreeTerms = bool(formData, 'agreeTerms')
  const agreeCancellation = bool(formData, 'agreeCancellation')
  const agreeHealth = bool(formData, 'agreeHealth')
  const agreePrivacy = bool(formData, 'agreePrivacy')
  const signature = str(formData, 'signature')

  // ── Server-side validation ──
  if (!firstName || !surname || !email || !contactNumber || !idNumber || !emergencyContactName || !emergencyContactNumber) {
    return { ok: false, error: 'Please complete all member detail fields.' }
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }
  if (!agreeTerms || !agreeCancellation || !agreeHealth || !agreePrivacy) {
    return { ok: false, error: 'All agreements must be accepted.' }
  }
  if (!signature) {
    return { ok: false, error: 'Please add your digital signature.' }
  }

  const record = {
    packQuantity: pack.quantity,
    bonusSessions: pack.bonusSessions,
    totalSessions: pack.totalSessions,
    unitLabel: pack.unitLabel,
    baseAmount: pack.baseAmount,
    amount: pack.amount,
    specialId: pack.special?.id ?? null,
    specialTitle: pack.special?.title ?? '',
    firstName,
    surname,
    email,
    contactNumber,
    idNumber,
    emergencyContactName,
    emergencyContactNumber,
    agreeTerms,
    agreeCancellation,
    agreeHealth,
    agreePrivacy,
    signature,
    paymentStatus: 'Pending',
    status: 'New',
  }

  let insertedId: number
  try {
    const [row] = await db.insert(sessionPurchases).values(record).returning({ id: sessionPurchases.id })
    insertedId = row.id
  } catch (err) {
    console.error('[v0] Failed to save session purchase:', err)
    return { ok: false, error: 'Something went wrong starting your purchase. Please try again.' }
  }

  const fields = buildPayfastFields({
    paymentId: insertedId,
    amount: pack.amount,
    itemName: `TENROUNDS ${pack.unitLabel}`,
    itemDescription:
      pack.bonusSessions > 0
        ? `${pack.packQuantity} + ${pack.bonusSessions} free = ${pack.totalSessions} sessions`
        : `${pack.packQuantity} session${pack.packQuantity === 1 ? '' : 's'}`,
    nameFirst: firstName,
    nameLast: surname,
    email,
  })

  return { ok: true, payfast: { url: PAYFAST_PROCESS_URL, fields } }
}

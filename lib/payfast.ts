import 'server-only'

import crypto from 'node:crypto'
import { business } from '@/lib/business'

// ── PayFast configuration ────────────────────────────────────────────────
// Live by default. Set PAYFAST_SANDBOX=true to use the sandbox endpoint.
const SANDBOX = process.env.PAYFAST_SANDBOX === 'true'

export const PAYFAST_PROCESS_URL = SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process'

const PAYFAST_VALIDATE_URL = SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/query/validate'
  : 'https://www.payfast.co.za/eng/query/validate'

const VALID_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
]

function merchantId() {
  return process.env.PAYFAST_MERCHANT_ID ?? ''
}
function merchantKey() {
  return process.env.PAYFAST_MERCHANT_KEY ?? ''
}
function passphrase() {
  return process.env.PAYFAST_PASSPHRASE ?? ''
}

export function isPayfastConfigured() {
  return Boolean(merchantId() && merchantKey())
}

// The public base URL used for PayFast return/cancel/notify callbacks.
export function siteBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`
  return business.url.replace(/\/$/, '')
}

// PayFast urlencodes spaces as "+" and uppercases the %HH hex digits.
function pfEncode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, '+').replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase())
}

// Build the MD5 signature from an ordered list of [key, value] pairs.
function buildSignature(pairs: [string, string][]) {
  let paramString = pairs
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`)
    .join('&')
  const pass = passphrase()
  if (pass) paramString += `&passphrase=${pfEncode(pass.trim())}`
  return crypto.createHash('md5').update(paramString).digest('hex')
}

export type PayfastCheckout = {
  paymentId: number
  amount: number // Rand
  itemName: string
  itemDescription?: string
  nameFirst: string
  nameLast: string
  email: string
}

// Build the full set of fields (incl. signature) to POST to PayFast.
export function buildPayfastFields(c: PayfastCheckout): Record<string, string> {
  const base = siteBaseUrl()
  // Order matters — PayFast signs the fields in this exact sequence.
  const ordered: [string, string][] = [
    ['merchant_id', merchantId()],
    ['merchant_key', merchantKey()],
    ['return_url', `${base}/buy-sessions/success?ref=${c.paymentId}`],
    ['cancel_url', `${base}/buy-sessions/cancelled?ref=${c.paymentId}`],
    ['notify_url', `${base}/api/payfast/notify`],
    ['name_first', c.nameFirst],
    ['name_last', c.nameLast],
    ['email_address', c.email],
    ['m_payment_id', String(c.paymentId)],
    ['amount', c.amount.toFixed(2)],
    ['item_name', c.itemName],
    ['item_description', c.itemDescription ?? ''],
  ]
  const signature = buildSignature(ordered)
  const fields: Record<string, string> = {}
  for (const [k, v] of ordered) fields[k] = v
  fields.signature = signature
  return fields
}

// ── ITN (Instant Transaction Notification) verification ────────────────────

// 1. Recompute the signature from the posted data (in the order received).
function verifyItnSignature(pairs: [string, string][], suppliedSignature: string) {
  const filtered = pairs.filter(([k]) => k !== 'signature')
  const expected = buildSignature(filtered)
  return expected === suppliedSignature
}

// 2. Confirm the request came from a valid PayFast host.
async function validSourceHost(host: string | null) {
  if (!host) return false
  return VALID_HOSTS.some((h) => host.includes(h))
}

// 3. Post the data back to PayFast to confirm it is genuine.
async function serverConfirm(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    })
    const text = (await res.text()).trim()
    return text === 'VALID'
  } catch (err) {
    console.error('[v0] PayFast server confirmation failed:', err)
    return false
  }
}

export type ItnResult = {
  valid: boolean
  paymentId: number | null
  paymentStatus: string
  pfPaymentId: string
  amountGross: number
}

// Verify an incoming ITN. `pairs` preserves the posted field order; `rawBody`
// is the original urlencoded body used for the PayFast server confirmation.
export async function verifyItn(
  pairs: [string, string][],
  rawBody: string,
  sourceHost?: string | null,
): Promise<ItnResult> {
  const data = Object.fromEntries(pairs)
  const result: ItnResult = {
    valid: false,
    paymentId: data.m_payment_id ? Number(data.m_payment_id) : null,
    paymentStatus: data.payment_status ?? '',
    pfPaymentId: data.pf_payment_id ?? '',
    amountGross: data.amount_gross ? Number(data.amount_gross) : 0,
  }

  const signatureOk = verifyItnSignature(pairs, data.signature ?? '')
  if (!signatureOk) {
    console.error('[v0] PayFast ITN signature mismatch')
    return result
  }

  // Host check is best-effort (header may be absent in some runtimes).
  if (sourceHost !== undefined) {
    const hostOk = await validSourceHost(sourceHost)
    if (!hostOk) console.warn('[v0] PayFast ITN from unexpected host:', sourceHost)
  }

  const confirmed = await serverConfirm(rawBody)
  if (!confirmed) {
    console.error('[v0] PayFast ITN server confirmation returned non-VALID')
    return result
  }

  result.valid = true
  return result
}

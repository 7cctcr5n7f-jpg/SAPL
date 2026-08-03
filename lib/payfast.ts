import crypto from "crypto"

const PAYFAST_URL = "https://www.payfast.co.za/eng/process"
const MERCHANT_ID = "36052667"

/**
 * Encode a PayFast parameter value to match PHP's urlencode() output exactly.
 * The key differences vs encodeURIComponent: spaces become "+", and the chars
 * !, ', (, ), ~ are also percent-encoded (encodeURIComponent leaves them raw).
 */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")  // spaces → +  (PHP urlencode behaviour)
    .replace(/!/g,   "%21")
    .replace(/'/g,   "%27")
    .replace(/\(/g,  "%28")
    .replace(/\)/g,  "%29")
    .replace(/~/g,   "%7E")
}

/**
 * Build the ordered param string that PayFast uses for MD5 signature generation.
 * Empty values are omitted. The field order follows PayFast's documented spec.
 */
function buildParamString(fields: [string, string][]): string {
  return fields
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${pfEncode(v)}`)
    .join("&")
}

export interface PayFastPaymentParams {
  amount: number
  itemName: string
  /** Our internal payment reference — stored in m_payment_id so the ITN can look it up */
  mPaymentId: string
  nameFirst?: string
  nameLast?: string
  emailAddress?: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
}

/**
 * Build a signed PayFast redirect URL. The merchant key is read from
 * process.env.Key (the SAPL Vercel env var). No passphrase is used.
 */
export function buildPayFastUrl(p: PayFastPaymentParams): string {
  const merchantKey = (process.env.Key ?? "").trim()

  // PayFast requires fields in this exact order for correct signature generation.
  const ordered: [string, string][] = [
    ["merchant_id", MERCHANT_ID],
    ["merchant_key", merchantKey],
    ["return_url", p.returnUrl],
    ["cancel_url", p.cancelUrl],
    ["notify_url", p.notifyUrl],
    ["name_first", p.nameFirst ?? ""],
    ["name_last", p.nameLast ?? ""],
    ["email_address", p.emailAddress ?? ""],
    ["m_payment_id", p.mPaymentId],
    ["amount", p.amount.toFixed(2)],
    ["item_name", p.itemName],
  ]

  const nonEmpty = ordered.filter(([, v]) => v !== "")
  const paramStr = buildParamString(nonEmpty)
  console.log("[v0] PayFast param string:", paramStr)
  const signature = crypto.createHash("md5").update(paramStr).digest("hex")
  console.log("[v0] PayFast signature:", signature)

  // Build final URL preserving field order (URLSearchParams sorts keys, so we
  // construct the query string manually to keep the signature at the end).
  const query = nonEmpty.map(([k, v]) => `${k}=${pfEncode(v)}`).join("&")
  return `${PAYFAST_URL}?${query}&signature=${signature}`
}

/**
 * Verify the MD5 signature on an incoming PayFast ITN (Instant Transaction
 * Notification) payload. The `signature` field must be present in `data`.
 * All other fields (in the order PayFast sends them) are hashed and compared.
 */
export function verifyPayFastSignature(data: Record<string, string>): boolean {
  const { signature, ...rest } = data
  if (!signature) return false

  // Rebuild the param string from what PayFast sent (preserve incoming order).
  const paramStr = Object.entries(rest)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${pfEncode(v)}`)
    .join("&")

  const expected = crypto.createHash("md5").update(paramStr).digest("hex")
  return expected === signature
}

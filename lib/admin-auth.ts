import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'tr_admin'

// The admin passcode for the Content Manager lives in an environment variable,
// never in source. Set ADMIN_PASSWORD in your project settings (ADMIN_PASSCODE
// is still accepted as a fallback for backwards compatibility). Returns null
// when unconfigured so callers can fail closed instead of crashing.
function getPasscode(): string | null {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSCODE || null
}

// Deterministic token derived from the passcode. Stored in an httpOnly cookie
// so the raw passcode never lives in the browser.
function expectedToken(passcode: string): string {
  return createHmac('sha256', passcode).update('tenrounds-admin-v1').digest('hex')
}

export function verifyPasscode(input: string): boolean {
  const passcode = getPasscode()
  if (!passcode) {
    console.warn('[v0] ADMIN_PASSWORD is not set — admin login is disabled.')
    return false
  }
  const a = Buffer.from(input)
  const b = Buffer.from(passcode)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function isAdminAuthed(): Promise<boolean> {
  const passcode = getPasscode()
  if (!passcode) return false
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return false
  const expected = expectedToken(passcode)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function setAdminCookie() {
  const passcode = getPasscode()
  if (!passcode) throw new Error('ADMIN_PASSWORD is not set — cannot create an admin session.')
  ;(await cookies()).set(COOKIE_NAME, expectedToken(passcode), {
    httpOnly: true, // not readable from client-side JS (mitigates XSS theft)
    secure: true, // only sent over HTTPS
    // 'none' is required so the session cookie is sent with server-action
    // requests made from the cross-origin v0 preview iframe. Without it the
    // browser drops the cookie on those subrequests and every save fails with
    // "session expired" even immediately after logging in. Paired with
    // secure + httpOnly this remains safe, and it also works fine in
    // production where the dashboard is same-origin.
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export async function clearAdminCookie() {
  ;(await cookies()).delete(COOKIE_NAME)
}

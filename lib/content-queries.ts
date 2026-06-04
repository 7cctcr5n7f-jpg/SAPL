import 'server-only'
import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessionPacks } from '@/lib/memberships'
import {
  chowWinners,
  membershipSignups,
  sessionMilestones,
  settings,
  specials,
  type ChowWinner,
  type MembershipSignup,
  type SessionMilestone,
  type Special,
} from '@/lib/db/schema'

const now = () => new Date()

// Active specials whose schedule window (if any) is currently open.
async function getActiveSpecials(): Promise<Special[]> {
  const ts = now()
  return db
    .select()
    .from(specials)
    .where(
      and(
        eq(specials.active, true),
        or(isNull(specials.startsAt), lte(specials.startsAt, ts)),
        or(isNull(specials.endsAt), gt(specials.endsAt, ts)),
      ),
    )
    .orderBy(asc(specials.sortOrder), asc(specials.id))
}

export async function getPopupSpecials(): Promise<Special[]> {
  return (await getActiveSpecials()).filter((s) => s.showPopup && s.kind !== 'sessions')
}

export async function getInlineSpecials(): Promise<Special[]> {
  return (await getActiveSpecials()).filter((s) => s.showInline && s.kind !== 'sessions')
}

export async function getBarSpecials(): Promise<Special[]> {
  return (await getActiveSpecials()).filter((s) => s.showBar && s.kind !== 'sessions')
}

// Active session-pack specials (shown above the pay-as-you-go session prices).
export async function getSessionSpecials(): Promise<Special[]> {
  return (await getActiveSpecials()).filter((s) => s.kind === 'sessions')
}

// Compute a discounted session-pack price for a given special.
function sessionPackSpecialPrice(price: number, s: Special): number {
  const v = s.sessionDiscountValue
  if (v <= 0) return price
  const discounted =
    s.sessionDiscountType === 'amount' ? price - v : Math.round(price * (1 - v / 100))
  return Math.max(0, discounted)
}

// Map of session-pack quantity -> best (lowest) discounted price across active session specials.
export async function getSessionPackDiscounts(): Promise<Record<number, number>> {
  const list = await getSessionSpecials()
  const map: Record<number, number> = {}
  for (const s of list) {
    if (s.sessionDiscountValue <= 0) continue
    const qtys = (s.sessionPackQuantities || '')
      .split(',')
      .map((q) => Number(q.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    for (const pack of sessionPacks) {
      if (!qtys.includes(pack.quantity)) continue
      const discounted = sessionPackSpecialPrice(pack.price, s)
      if (discounted >= pack.price) continue
      map[pack.quantity] =
        map[pack.quantity] != null ? Math.min(map[pack.quantity], discounted) : discounted
    }
  }
  return map
}

// Map of membershipId -> best (highest) active discount percent.
export async function getMembershipDiscounts(): Promise<Record<string, number>> {
  const active = await getActiveSpecials()
  const map: Record<string, number> = {}
  for (const s of active) {
    if (s.discountPercent <= 0 || !s.discountMembershipIds) continue
    for (const raw of s.discountMembershipIds.split(',')) {
      const id = raw.trim()
      if (!id) continue
      map[id] = Math.max(map[id] ?? 0, s.discountPercent)
    }
  }
  return map
}

export async function getActiveChowWinners(): Promise<ChowWinner[]> {
  return db
    .select()
    .from(chowWinners)
    .where(eq(chowWinners.active, true))
    .orderBy(asc(chowWinners.sortOrder), asc(chowWinners.id))
}

// All membership signups, newest first (admin only).
export async function getMembershipSignups(): Promise<MembershipSignup[]> {
  return db.select().from(membershipSignups).orderBy(desc(membershipSignups.createdAt))
}

export async function getMembershipSignup(id: number): Promise<MembershipSignup | null> {
  const rows = await db.select().from(membershipSignups).where(eq(membershipSignups.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getSetting(key: string): Promise<string> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  return rows[0]?.value ?? ''
}

// The single most-recent active session milestone (or null).
export async function getActiveSessionMilestone(): Promise<SessionMilestone | null> {
  const rows = await db
    .select()
    .from(sessionMilestones)
    .where(eq(sessionMilestones.active, true))
    .orderBy(desc(sessionMilestones.createdAt))
    .limit(1)
  return rows[0] ?? null
}

// All active session milestones, newest first (members page).
export async function getActiveSessionMilestones(): Promise<SessionMilestone[]> {
  return db
    .select()
    .from(sessionMilestones)
    .where(eq(sessionMilestones.active, true))
    .orderBy(desc(sessionMilestones.createdAt))
}

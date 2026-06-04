import 'server-only'
import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessionPacks } from '@/lib/memberships'
import {
  chowWinners,
  membershipSignups,
  sessionMilestones,
  sessionPurchases,
  settings,
  specials,
  type ChowWinner,
  type MembershipSignup,
  type SessionMilestone,
  type SessionPurchase,
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

// Map of session-pack quantity -> total bonus sessions across active session specials.
export async function getSessionPackBonuses(): Promise<Record<number, number>> {
  const list = await getSessionSpecials()
  const map: Record<number, number> = {}
  for (const s of list) {
    for (const pair of (s.sessionPackBonuses || '').split(',')) {
      const [q, b] = pair.split(':').map((x) => Number(x.trim()))
      if (!Number.isFinite(q) || !Number.isFinite(b) || q <= 0 || b <= 0) continue
      map[q] = (map[q] ?? 0) + b
    }
  }
  return map
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

// Resolve the authoritative price + bonus for a session pack, applying any
// currently-active session special. Used server-side at checkout so the amount
// charged can never be tampered with from the client.
export type ResolvedSessionPack = {
  quantity: number
  unitLabel: string
  baseAmount: number
  amount: number
  bonusSessions: number
  totalSessions: number
  special: Special | null
}

export async function resolveSessionPack(
  quantity: number,
): Promise<ResolvedSessionPack | null> {
  const pack = sessionPacks.find((p) => p.quantity === quantity)
  if (!pack) return null

  const [discounts, bonuses, sessionSpecials] = await Promise.all([
    getSessionPackDiscounts(),
    getSessionPackBonuses(),
    getSessionSpecials(),
  ])

  const discounted = discounts[pack.quantity]
  const amount = discounted != null && discounted < pack.price ? discounted : pack.price
  const bonusSessions = bonuses[pack.quantity] ?? 0

  // Identify which special applies (for the receipt/record), if any.
  let special: Special | null = null
  for (const s of sessionSpecials) {
    const qtys = (s.sessionPackQuantities || '')
      .split(',')
      .map((q) => Number(q.trim()))
    const bonusQtys = (s.sessionPackBonuses || '')
      .split(',')
      .map((pair) => Number(pair.split(':')[0]?.trim()))
    if (qtys.includes(pack.quantity) || bonusQtys.includes(pack.quantity)) {
      special = s
      break
    }
  }

  return {
    quantity: pack.quantity,
    unitLabel: pack.quantity === 1 ? 'Single Session' : `${pack.quantity} Pack`,
    baseAmount: pack.price,
    amount,
    bonusSessions,
    totalSessions: pack.quantity + bonusSessions,
    special,
  }
}

// All online session purchases, newest first (admin only).
export async function getSessionPurchases(): Promise<SessionPurchase[]> {
  return db.select().from(sessionPurchases).orderBy(desc(sessionPurchases.createdAt))
}

export async function getSessionPurchase(id: number): Promise<SessionPurchase | null> {
  const rows = await db.select().from(sessionPurchases).where(eq(sessionPurchases.id, id)).limit(1)
  return rows[0] ?? null
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

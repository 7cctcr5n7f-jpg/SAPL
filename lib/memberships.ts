export type ContractLength = 3 | 6 | 12

export type Membership = {
  id: string
  name: string
  blurb: string
  // monthly price keyed by contract length
  prices: Record<ContractLength, number>
}

export type AccessTier = {
  id: 'anytime' | 'off-peak' | 'pair-up'
  name: string
  tagline: string
  // lucide icon name resolved in the component
  icon: 'infinity' | 'sun' | 'users'
  perMember?: boolean
  memberships: Membership[]
}

export const accessTiers: AccessTier[] = [
  {
    id: 'anytime',
    name: 'Anytime Access',
    tagline: 'Train whenever it suits you — full all-hours access.',
    icon: 'infinity',
    memberships: [
      {
        id: 'anytime-unlimited',
        name: 'Unlimited',
        blurb: 'Unlimited 30-minute sessions, any hour we are open.',
        prices: { 3: 1750, 6: 1450, 12: 1250 },
      },
      {
        id: 'anytime-twice',
        name: 'Twice Per Week',
        blurb: 'Two coached sessions every week at any hour.',
        prices: { 3: 1400, 6: 1100, 12: 900 },
      },
    ],
  },
  {
    id: 'off-peak',
    name: 'Off-Peak Access',
    tagline: 'Train smart during quieter hours and save more.',
    icon: 'sun',
    memberships: [
      {
        id: 'offpeak-unlimited',
        name: 'Unlimited',
        blurb: 'Unlimited 30-minute sessions during off-peak hours.',
        prices: { 3: 1500, 6: 1200, 12: 1000 },
      },
      {
        id: 'offpeak-twice',
        name: 'Twice Per Week',
        blurb: 'Two coached sessions every week, off-peak.',
        prices: { 3: 1200, 6: 950, 12: 750 },
      },
      {
        id: 'offpeak-youngster',
        name: 'Youngster',
        blurb: 'For under-18s building healthy habits early.',
        prices: { 3: 1000, 6: 800, 12: 650 },
      },
      {
        id: 'offpeak-student',
        name: 'Student',
        blurb: 'Full-time students train for less, off-peak.',
        prices: { 3: 850, 6: 750, 12: 650 },
      },
    ],
  },
  {
    id: 'pair-up',
    name: 'Pair-Up Membership',
    tagline: 'Train together, stay accountable, save together.',
    icon: 'users',
    perMember: true,
    memberships: [
      {
        id: 'pairup-anytime',
        name: 'Anytime Unlimited',
        blurb: 'Two members, unlimited all-hours access.',
        prices: { 3: 1500, 6: 1200, 12: 1000 },
      },
      {
        id: 'pairup-offpeak',
        name: 'Off-Peak Unlimited',
        blurb: 'Two members, unlimited off-peak access.',
        prices: { 3: 1200, 6: 1000, 12: 800 },
      },
    ],
  },
]

export const contractLengths: { value: ContractLength; label: string; badge?: string }[] = [
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months', badge: 'Most Popular' },
  { value: 12, label: '12 Months', badge: 'Best Value' },
]

export const trustPoints = [
  'No Class Times',
  'Coach-Supported Workouts',
  'Heart Rate Tracking',
  'All Fitness Levels Welcome',
  'Structured 30-Minute Sessions',
]

export function formatRand(value: number) {
  return 'R' + value.toLocaleString('en-ZA')
}

// Free boxing gloves are included on any 6 or 12-month plan,
// except Off-Peak access (standalone Off-Peak tier or the Pair-Up off-peak option).
export function includesGloves(
  tier: AccessTier,
  membership: Membership,
  length: ContractLength,
) {
  const isOffPeak = tier.id === 'off-peak' || membership.id.includes('offpeak')
  return length >= 6 && !isOffPeak
}

// Pay-as-you-go sessions, purchased at the club. No monthly commitment.
export type SessionPack = {
  quantity: number
  price: number
  popular?: boolean
}

export const sessionPacks: SessionPack[] = [
  { quantity: 1, price: 180 },
  { quantity: 10, price: 1600 },
  { quantity: 20, price: 3000, popular: true },
  { quantity: 30, price: 4200 },
]

export function sessionPrice(pack: SessionPack) {
  return Math.round(pack.price / pack.quantity)
}

export function getMembership(tierId: string, membershipId: string) {
  const tier = accessTiers.find((t) => t.id === tierId)
  const membership = tier?.memberships.find((m) => m.id === membershipId)
  return { tier, membership }
}

// Savings comparison vs the 3-month monthly price.
// `discountPercent` (0-100) optionally applies a special promo discount on top.
export function computePricing(
  membership: Membership,
  length: ContractLength,
  discountPercent = 0,
) {
  const listMonthly = membership.prices[length]
  const pct = Math.min(Math.max(discountPercent, 0), 100)
  const discounted = pct > 0 ? Math.round(listMonthly * (1 - pct / 100)) : listMonthly
  const monthly = discounted
  const base = membership.prices[3]
  const monthlySaving = base - monthly
  const annualSaving = monthlySaving * 12
  const totalContract = monthly * length
  return {
    monthly,
    base,
    monthlySaving,
    annualSaving,
    totalContract,
    // promo-specific fields
    listMonthly,
    discountPercent: pct,
    hasDiscount: pct > 0 && discounted < listMonthly,
    listTotalContract: listMonthly * length,
  }
}

// Flat list of every membership (for the admin discount selector).
export const allMembershipsFlat: { id: string; label: string }[] = accessTiers.flatMap((tier) =>
  tier.memberships.map((m) => ({ id: m.id, label: `${tier.name} — ${m.name}` })),
)

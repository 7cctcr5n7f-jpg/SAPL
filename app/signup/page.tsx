import type { Metadata } from 'next'
import { PageHero } from '@/components/page-hero'
import { MembershipSignupForm, type Selection } from '@/components/forms/membership-signup-form'
import { getMembership, accessTiers, type ContractLength } from '@/lib/memberships'
import { getMembershipDiscounts } from '@/lib/content-queries'
import { computePricing } from '@/lib/memberships'

export const metadata: Metadata = {
  title: 'Join TENROUNDS — Membership Signup',
  description:
    "You're one step away from joining Pretoria East's most effective 30-minute fitness experience. Complete your TENROUNDS membership signup.",
  alternates: { canonical: '/signup' },
  robots: { index: false, follow: false },
}

function tierIdFor(membershipId: string): string {
  if (membershipId.startsWith('anytime')) return 'anytime'
  if (membershipId.startsWith('pairup')) return 'pair-up'
  return 'off-peak'
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; len?: string; fee?: string }>
}) {
  const params = await searchParams
  const discounts = await getMembershipDiscounts()

  // Default to a sensible plan when the visitor arrives without a selection.
  const membershipId = params.m && getMembership(tierIdFor(params.m), params.m).membership ? params.m : 'anytime-twice'
  const lengthRaw = Number(params.len)
  const contractLength: ContractLength = [3, 6, 12].includes(lengthRaw) ? (lengthRaw as ContractLength) : 12

  const { tier, membership } = getMembership(tierIdFor(membershipId), membershipId)
  const resolvedTier = tier ?? accessTiers[0]
  const resolvedMembership = membership ?? resolvedTier.memberships[0]

  // Use the posted fee (carries any active special discount) when valid,
  // otherwise recompute from the canonical price list.
  const discountPercent = discounts[resolvedMembership.id] ?? 0
  const pricing = computePricing(resolvedMembership, contractLength, discountPercent)
  const postedFee = Number(params.fee)
  const monthlyFee = Number.isFinite(postedFee) && postedFee > 0 ? Math.round(postedFee) : pricing.monthly
  const totalContractValue = monthlyFee * contractLength

  // Savings, all measured against the entry-level 3-month rate.
  const baselineMonthly = pricing.base // 3-month rate
  const commitmentSaving = Math.max(0, baselineMonthly - pricing.listMonthly)
  const discountSaving = Math.max(0, pricing.listMonthly - monthlyFee)
  const monthlySaving = Math.max(0, baselineMonthly - monthlyFee)
  const totalSaving = monthlySaving * contractLength

  const selection: Selection = {
    membershipId: resolvedMembership.id,
    membershipType: resolvedTier.name,
    accessType: resolvedMembership.name,
    contractLength,
    monthlyFee,
    totalContractValue,
    perMember: !!resolvedTier.perMember,
    baselineMonthly,
    commitmentSaving,
    discountSaving,
    monthlySaving,
    totalSaving,
    discountPercent: pricing.discountPercent,
  }

  return (
    <main>
      <PageHero
        eyebrow="Membership Signup"
        title="Welcome To TENROUNDS"
        description="You're one step away from joining Pretoria East's most effective 30-minute fitness experience."
        image="/strength-training.png"
        imageAlt="Athlete training at TENROUNDS"
      />

      <section className="bg-background pb-20 pt-12 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <MembershipSignupForm selection={selection} />
        </div>
      </section>
    </main>
  )
}

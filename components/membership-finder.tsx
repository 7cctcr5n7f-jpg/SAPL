'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Infinity as InfinityIcon, Sun, Users, Check, ArrowRight, Sparkles, Lock, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  accessTiers,
  contractLengths,
  trustPoints,
  formatRand,
  computePricing,
  includesGloves,
  OFF_PEAK_HOURS,
  type AccessTier,
  type ContractLength,
} from '@/lib/memberships'

const iconMap = {
  infinity: InfinityIcon,
  sun: Sun,
  users: Users,
}

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-3 lg:mb-5">
      <span className="flex size-6 items-center justify-center rounded-full bg-cobalt font-display text-sm font-bold text-accent-foreground lg:size-7">
        {n}
      </span>
      <span className="font-display text-sm font-bold uppercase tracking-widest text-light-grey">
        {label}
      </span>
    </div>
  )
}

export function MembershipFinder({
  discounts = {},
}: {
  discounts?: Record<string, number>
}) {
  const [tierId, setTierId] = useState<AccessTier['id']>('anytime')
  const [membershipId, setMembershipId] = useState<string>('anytime-twice')
  const [length, setLength] = useState<ContractLength>(12)

  const tier = useMemo(() => accessTiers.find((t) => t.id === tierId)!, [tierId])
  const membership = useMemo(
    () => tier.memberships.find((m) => m.id === membershipId) ?? tier.memberships[0],
    [tier, membershipId],
  )

  function selectTier(next: AccessTier) {
    setTierId(next.id)
    setMembershipId(next.memberships[0].id)
  }

  const discountPercent = discounts[membership.id] ?? 0
  const pricing = computePricing(membership, length, discountPercent)
  const perMember = tier.perMember
  const gloves = includesGloves(tier, membership, length)
  const isOffPeak = tier.id === 'off-peak' || membership.id.includes('offpeak')

  // Carry the live selection (incl. any special discount) to the signup page.
  const joinHref = `/signup?${new URLSearchParams({
    m: membership.id,
    len: String(length),
    fee: String(pricing.monthly),
  }).toString()}`

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        {/* LEFT: configurator */}
        <div className="space-y-4 lg:space-y-10">
          {/* STEP 1 */}
          <div>
            <StepBadge n={1} label="Select Access Type" />
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {accessTiers.map((t) => {
                const Icon = iconMap[t.icon]
                const active = t.id === tierId
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTier(t)}
                    className={cn(
                      'group flex flex-col rounded-xl border p-2.5 text-center transition-all duration-200 sm:p-4 sm:text-left',
                      active
                        ? 'border-neon-blue bg-cobalt/10 blue-glow'
                        : 'border-steel bg-card hover:border-neon-blue/60',
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2.5">
                      <Icon
                        className={cn(
                          'size-5 shrink-0 transition-colors sm:size-6',
                          active ? 'text-neon-blue' : 'text-light-grey group-hover:text-neon-blue',
                        )}
                      />
                      <span className="font-display text-xs font-bold uppercase leading-tight tracking-tight text-foreground sm:text-base">
                        {t.name}
                      </span>
                    </span>
                    <span className="mt-2 hidden text-xs leading-relaxed text-light-grey sm:block">
                      {t.tagline}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* STEP 2 */}
          <div>
            <StepBadge n={2} label="Select Frequency" />
            <div
              className="grid gap-2 sm:gap-3"
              style={{ gridTemplateColumns: `repeat(${tier.memberships.length}, minmax(0, 1fr))` }}
            >
              {tier.memberships.map((m) => {
                const active = m.id === membership.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMembershipId(m.id)}
                    className={cn(
                      'group flex flex-col rounded-xl border p-2.5 text-center transition-all duration-200 sm:p-4 sm:text-left',
                      active
                        ? 'border-neon-blue bg-cobalt/10 blue-glow'
                        : 'border-steel bg-card hover:border-neon-blue/60',
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2.5">
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          active ? 'border-neon-blue bg-neon-blue' : 'border-steel',
                        )}
                      >
                        {active && <Check className="size-3 text-background" />}
                      </span>
                      <span className="font-display text-xs font-bold uppercase leading-tight tracking-tight text-foreground sm:text-base sm:normal-case sm:font-semibold sm:tracking-normal">
                        {m.name}
                      </span>
                    </span>
                    <span className="mt-2 hidden text-xs leading-relaxed text-light-grey sm:block">
                      {m.blurb}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* STEP 3 */}
          <div>
            <StepBadge n={3} label="Select Contract Length" />
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-steel bg-card p-1.5">
              {contractLengths.map((c) => {
                const active = c.value === length
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setLength(c.value)}
                    className={cn(
                      'relative rounded-lg py-2.5 text-center transition-all duration-200 sm:py-3',
                      active ? 'bg-cobalt text-accent-foreground' : 'text-light-grey hover:text-foreground',
                    )}
                    aria-pressed={active}
                  >
                    <span className="block font-display text-base font-bold uppercase">{c.label}</span>
                    {c.badge && (
                      <span
                        className={cn(
                          'mt-0.5 block text-[10px] font-semibold uppercase tracking-wide',
                          active ? 'text-accent-foreground/80' : 'text-neon-blue',
                        )}
                      >
                        {c.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: result card */}
        <div className="lg:sticky lg:top-24">
          <div className="glass overflow-hidden rounded-2xl">
            {/* badges */}
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-steel/60 bg-cobalt/10 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6 sm:py-4">
              {length === 6 && (
                <Badge icon={<Sparkles className="size-3.5" />}>Most Popular</Badge>
              )}
              {length === 12 && (
                <Badge icon={<Sparkles className="size-3.5" />}>Best Value</Badge>
              )}
              {perMember && <Badge>Train Together &amp; Save</Badge>}
              {pricing.hasDiscount && (
                <Badge highlight icon={<Sparkles className="size-3.5" />}>
                  {pricing.discountPercent}% Off Special
                </Badge>
              )}
              {pricing.monthlySaving > 0 && (
                <Badge highlight>Save {formatRand(pricing.annualSaving)} / year</Badge>
              )}
            </div>

            <div className="px-6 py-6">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-neon-blue">
                {tier.name}
              </p>
              <h3 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight text-foreground">
                {membership.name}
              </h3>
              <p className="mt-1 text-sm text-light-grey">{length} Month Contract</p>

              {/* price */}
              <div className="mt-6">
                {pricing.hasDiscount && (
                  <p className="mb-1 flex items-center gap-2">
                    <span className="font-display text-2xl font-bold tracking-tight text-light-grey line-through">
                      {formatRand(pricing.listMonthly)}
                    </span>
                    <span className="rounded-full bg-neon-green px-2 py-0.5 font-display text-[11px] font-black uppercase tracking-wide text-background">
                      Save {pricing.discountPercent}%
                    </span>
                  </p>
                )}
                <p className="flex items-end gap-2">
                  <span
                    className={cn(
                      'font-display text-5xl font-black tracking-tight text-glow',
                      pricing.hasDiscount ? 'text-neon-green' : 'text-foreground',
                    )}
                  >
                    {formatRand(pricing.monthly)}
                  </span>
                  <span className="pb-1.5 text-sm text-light-grey">
                    / month{perMember ? ' · per member' : ''}
                  </span>
                </p>
                {pricing.monthlySaving > 0 ? (
                  <p className="mt-2 text-sm font-medium text-neon-blue">
                    Save {formatRand(pricing.monthlySaving)}/month vs the 3-month plan
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-light-grey">Flexible short-term commitment</p>
                )}
                {perMember && (
                  <p className="mt-1 text-xs text-light-grey">
                    Total for two members: {formatRand(pricing.monthly * 2)} / month
                  </p>
                )}
                <p className="mt-1 text-xs text-light-grey">
                  {formatRand(pricing.totalContract)} total over {length} months
                </p>
              </div>

              {/* off-peak hours notice */}
              {isOffPeak && (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-neon-blue/40 bg-cobalt/10 p-3">
                  <Clock className="size-5 shrink-0 text-neon-blue" />
                  <p className="text-xs leading-relaxed text-light-grey">
                    Off-Peak sessions can only be used between{' '}
                    <span className="font-semibold text-foreground">{OFF_PEAK_HOURS}</span> (off-peak
                    hours).
                  </p>
                </div>
              )}

              {/* free gloves perk */}
              {gloves ? (
                <div className="green-glow relative mt-6 flex items-center gap-4 overflow-hidden rounded-xl border-2 border-neon-green/70 bg-neon-green/10 p-3">
                  <span className="absolute right-0 top-0 rounded-bl-lg bg-neon-green px-2.5 py-1 font-display text-[10px] font-black uppercase tracking-widest text-background">
                    Free Gift
                  </span>
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-background ring-1 ring-neon-green/50">
                    <Image
                      src="/boxing-gloves-perk.png"
                      alt="Free TENROUNDS boxing gloves"
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 pr-12">
                    <p className="flex items-center gap-1.5 font-display text-sm font-extrabold uppercase tracking-wide text-neon-green">
                      <Sparkles className="size-3.5" /> Free Boxing Gloves
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-light-grey">
                      Included free with this {length}-month plan — yours to keep.
                    </p>
                  </div>
                </div>
              ) : isOffPeak ? (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-steel bg-background/60 p-3">
                  <Lock className="size-5 shrink-0 text-light-grey" />
                  <p className="text-xs leading-relaxed text-light-grey">
                    Free boxing gloves are included on 6 &amp; 12-month{' '}
                    <span className="text-foreground">Anytime</span> and{' '}
                    <span className="text-foreground">Pair-Up</span> plans — not available on
                    Off-Peak access.
                  </p>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-neon-green/50 bg-neon-green/5 p-3">
                  <Sparkles className="size-5 shrink-0 text-neon-green" />
                  <p className="text-xs leading-relaxed text-light-grey">
                    Choose a <span className="text-foreground">6 or 12-month</span> contract to
                    unlock <span className="font-semibold text-neon-green">free boxing gloves</span>.
                  </p>
                </div>
              )}

              {/* trust points */}
              <ul className="mt-6 space-y-2 border-t border-steel/60 pt-5">
                {isOffPeak && (
                  <li className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Clock className="size-4 shrink-0 text-neon-blue" />
                    Sessions usable {OFF_PEAK_HOURS} (off-peak hours)
                  </li>
                )}
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-light-grey">
                    <Check className="size-4 shrink-0 text-neon-blue" />
                    {point}
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              <div className="mt-6 space-y-3">
                <Link
                  href={joinHref}
                  className="flex items-center justify-center gap-2 rounded-lg bg-cobalt px-5 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
                >
                  Join TENROUNDS <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/free-trial"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-steel px-5 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-neon-blue hover:text-neon-blue"
                >
                  Try A Free Trial First
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({
  children,
  icon,
  highlight,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:gap-1.5 sm:text-xs',
        highlight
          ? 'bg-neon-blue text-background'
          : 'border border-neon-blue/40 text-neon-blue',
      )}
    >
      {icon}
      {children}
    </span>
  )
}

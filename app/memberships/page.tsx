import type { Metadata } from 'next'
import { Users, Timer, HeartPulse, Dumbbell, Check, CheckCircle2 } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { MembershipFinder } from '@/components/membership-finder'
import { SessionPacks } from '@/components/session-packs'
import { FaqSection } from '@/components/faq-section'
import { TestimonialsSection } from '@/components/testimonials-section'
import { CtaBanner } from '@/components/cta-banner'
import { JsonLd } from '@/components/json-ld'
import { faqSchema, breadcrumbSchema } from '@/lib/seo'
import { pricingFaqs } from '@/lib/content'
import { SpecialInline } from '@/components/specials/special-inline'
import { getInlineSpecials, getMembershipDiscounts } from '@/lib/content-queries'

export const metadata: Metadata = {
  title: 'Pricing & Memberships',
  description:
    'Build your TENROUNDS membership in seconds. Anytime, Off-Peak and Pair-Up access with 3, 6 and 12 month options. Boutique 30-minute HIIT training in Garsfontein, Pretoria East.',
  alternates: { canonical: '/memberships' },
  openGraph: {
    title: 'Pricing & Memberships | TENROUNDS',
    description:
      'Anytime, Off-Peak and Pair-Up memberships with transparent pricing. Find your plan in 15 seconds.',
  },
}

const benefits = [
  {
    icon: Users,
    title: 'Trainer Support',
    desc: 'Qualified coaches on the floor guiding and motivating you through every round.',
  },
  {
    icon: Timer,
    title: '30-Minute Sessions',
    desc: 'Structured, time-efficient workouts that fit around your busy schedule.',
  },
  {
    icon: HeartPulse,
    title: 'Heart-Rate Guided',
    desc: 'Live intensity tracking so every session pushes you to the right effort zone.',
  },
  {
    icon: Dumbbell,
    title: 'All Stations',
    desc: 'Full access to boxing, functional strength and conditioning equipment.',
  },
]

export default async function MembershipsPage() {
  const [inlineSpecials, discounts] = await Promise.all([
    getInlineSpecials(),
    getMembershipDiscounts(),
  ])
  return (
    <main>
      <JsonLd data={[faqSchema(pricingFaqs), breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Pricing', path: '/memberships' },
      ])]} />

      <PageHero
        eyebrow="Membership Finder"
        title="Build Your Membership"
        description="Pick your access, your membership and your contract length. Your price updates instantly — find the right plan in under 15 seconds."
        image="/strength-training.png"
        imageAlt="Athlete strength training at TENROUNDS"
      />

      {/* current specials (managed from /admin) — shown just above the pricing finder */}
      <SpecialInline specials={inlineSpecials} />

      {/* finder */}
      <section className="bg-background pb-20 pt-12 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <MembershipFinder discounts={discounts} />
        </div>
      </section>

      {/* pay-as-you-go sessions */}
      <section className="bg-charcoal py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SessionPacks />
        </div>
      </section>

      {/* benefits */}
      <section className="bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="What You Get"
            title="Every Membership Includes"
            description="No tiers on the essentials — every TENROUNDS member trains with the full experience from day one."
            className="mx-auto"
          />
          <Reveal className="mx-auto mt-14 max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl border border-neon-blue/30 bg-card blue-glow">
              {/* accent bar + header strip */}
              <div className="flex items-center justify-center gap-3 bg-neon-green/10 px-4 py-4 ring-1 ring-inset ring-neon-green/40">
                <CheckCircle2 className="size-5 shrink-0 text-neon-green" />
                <p className="font-display text-sm font-extrabold uppercase tracking-wide text-neon-green">
                  All-In, No Upsells — Included From Day One
                </p>
              </div>

              {/* fun tick-mark checklist */}
              <ul className="divide-y divide-steel/50 px-6 py-2 sm:px-10">
                {benefits.map((b) => (
                  <li key={b.title} className="group flex items-center gap-4 py-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neon-green/15 text-neon-green ring-1 ring-neon-green/50 transition-all duration-300 group-hover:scale-110 group-hover:bg-neon-green group-hover:text-background group-hover:green-glow">
                      <Check className="size-5" strokeWidth={3.5} />
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                      <span className="font-display text-lg font-extrabold uppercase tracking-tight text-foreground transition-colors group-hover:text-neon-blue">
                        {b.title}
                      </span>
                      <span className="text-sm leading-relaxed text-light-grey">
                        {b.desc}
                      </span>
                    </div>
                    <b.icon className="ml-auto hidden size-5 shrink-0 text-steel transition-colors group-hover:text-neon-blue sm:block" />
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <TestimonialsSection dark />

      <FaqSection
        faqs={pricingFaqs}
        eyebrow="Pricing FAQ"
        title="Membership & Pricing Questions"
        subtitle="Everything you need to know about plans, perks and pay-as-you-go sessions."
      />

      <CtaBanner
        headline="Start Training Today"
        subheadline="Join TENROUNDS and experience a smarter way to train. Your first session is on us."
        buttonLabel="Start Free Trial"
      />
    </main>
  )
}

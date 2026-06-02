import type { Metadata } from 'next'
import { MessageCircle } from 'lucide-react'
import { TrialBookingForm } from '@/components/forms/trial-booking-form'
import { TrialBenefits } from '@/components/landing/trial-benefits'
import { TrialAtAGlance } from '@/components/landing/trial-at-a-glance'
import { TrialExperience } from '@/components/landing/trial-experience'
import { DriveTimes } from '@/components/landing/drive-times'
import { TrialFinalCta } from '@/components/landing/trial-final-cta'
import { LocationSection } from '@/components/location-section'
import { TestimonialsSection } from '@/components/testimonials-section'
import { business, whatsappHref, fullAddress } from '@/lib/business'
import { db } from '@/lib/db'
import { blockedDays as blockedDaysTable } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Free Trial | Your First 30-Minute Session Is On Us',
  description:
    'Claim your free TENROUNDS trial in Garsfontein, Pretoria East. Experience a coach-supported 30-minute HIIT boxing workout with real-time heart rate tracking — no experience and no payment required.',
  alternates: { canonical: '/free-trial' },
  openGraph: {
    title: 'Free Trial | TENROUNDS',
    description:
      "Your first coach-supported 30-minute HIIT session in Garsfontein is on us. No experience required. No class times. No pressure to join.",
  },
}

const heroPoints = ['No experience required', 'No class times', 'No pressure to join']

export default async function FreeTrialPage() {
  const blocked = await db.select({ day: blockedDaysTable.day }).from(blockedDaysTable)
  const blockedList = blocked.map((b) => b.day)

  return (
    <main>
      {/* HERO + BOOKING FORM */}
      <section className="relative overflow-hidden pb-20 pt-40">
        <div className="animate-pulse-glow pointer-events-none absolute -right-20 top-20 size-96 rounded-full bg-cobalt/25 blur-[130px]" />
        <div className="animate-pulse-glow pointer-events-none absolute -left-20 bottom-0 size-80 rounded-full bg-neon-blue/20 blur-[120px]" />

        <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-5 lg:grid-cols-2 lg:px-8">
          {/* copy */}
          <div>
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue">
              <span className="h-px w-8 bg-neon-blue" />
              Free Trial
            </span>
            <h1 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] tracking-tight text-balance md:text-6xl">
              Your First Session Is <span className="text-neon-blue text-glow">On Us</span>
            </h1>
            <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-light-grey">
              Experience the workout that&apos;s changing fitness in Pretoria East. Discover why busy
              professionals, parents and fitness enthusiasts are choosing coach-led 30-minute HIIT
              boxing workouts that fit into real life.
            </p>

            <ul className="mt-8 flex flex-wrap gap-3">
              {heroPoints.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-steel bg-card px-4 py-2 text-sm font-semibold text-foreground"
                >
                  {p}
                </li>
              ))}
            </ul>

            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.02]"
            >
              <MessageCircle className="size-5" /> Got A Question? Ask Before Booking
            </a>
          </div>

          {/* form */}
          <div id="book" className="scroll-mt-28 lg:sticky lg:top-28">
            <TrialBookingForm blockedDays={blockedList} />
          </div>
        </div>
      </section>

      {/* BENEFIT CARDS */}
      <TrialBenefits />

      {/* TRIAL AT A GLANCE */}
      <TrialAtAGlance />

      {/* YOUR FIRST TENROUNDS EXPERIENCE */}
      <TrialExperience />

      {/* LOCATION */}
      <LocationSection />

      {/* DRIVE TIMES */}
      <DriveTimes />

      {/* GOOGLE REVIEWS + TESTIMONIALS */}
      <TestimonialsSection
        eyebrow="Google Reviews"
        title="Loved By Pretoria East"
        subtitle="Real reviews from real members who started exactly where you are now."
      />

      {/* FINAL CTA */}
      <TrialFinalCta />
    </main>
  )
}

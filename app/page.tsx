import { Hero } from '@/components/home/hero'
import { WhyTenrounds } from '@/components/home/why-tenrounds'
import { HowItWorks } from '@/components/home/how-it-works'
import { HeartRate } from '@/components/home/heart-rate'
import { CoachesGrid } from '@/components/coaches-grid'
import { Results } from '@/components/home/results'
import { IntensityBand } from '@/components/home/intensity-band'
import { MembershipPreview } from '@/components/home/membership-preview'
import { CorporatePreview } from '@/components/home/corporate-preview'
import { TestimonialsSection } from '@/components/testimonials-section'
import { LocationSection } from '@/components/location-section'
import { FaqSection } from '@/components/faq-section'
import { CtaBanner } from '@/components/cta-banner'
import { JsonLd } from '@/components/json-ld'
import { faqSchema } from '@/lib/seo'
import { generalFaqs } from '@/lib/content'

export default function HomePage() {
  return (
    <main>
      <JsonLd data={faqSchema(generalFaqs)} />
      <Hero />
      <WhyTenrounds />
      <HowItWorks />
      <HeartRate />
      <CoachesGrid
        align="center"
        background="background"
        eyebrow="The Team"
        title="Coaches In Your Corner"
        description="Qualified, motivating and genuinely invested in your progress — a real coach supporting you through every round."
        cta={{ label: 'Meet The Full Team', href: '/meet-the-team' }}
      />
      <Results />
      <IntensityBand />
      <MembershipPreview />
      <TestimonialsSection dark />
      <CorporatePreview />
      <LocationSection dark />
      <FaqSection faqs={generalFaqs} />
      <CtaBanner />
    </main>
  )
}

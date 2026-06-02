import { SectionHeading } from '@/components/section-heading'
import { MembershipFinder } from '@/components/membership-finder'

export function MembershipPreview() {
  return (
    <section id="pricing" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Membership Finder"
          title="Find Your Plan In 15 Seconds"
          description="Pick your access, your membership and your contract length. Your price updates instantly — no sales calls, no fine print."
          className="mx-auto"
        />
        <div className="mt-14">
          <MembershipFinder />
        </div>
      </div>
    </section>
  )
}

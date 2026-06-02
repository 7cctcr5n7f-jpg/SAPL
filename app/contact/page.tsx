import type { Metadata } from 'next'
import { MapPin, Phone, Mail, MessageCircle, Clock, Instagram, Facebook } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { ContactForm } from '@/components/forms/contact-form'
import { JsonLd } from '@/components/json-ld'
import { breadcrumbSchema } from '@/lib/seo'
import { business, whatsappHref, fullAddress } from '@/lib/business'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Visit or contact TENROUNDS at 649 Borzoi Street, Garsfontein, Pretoria East. Operating hours, WhatsApp, phone, email and directions to our boutique HIIT gym.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact | TENROUNDS',
    description: 'Visit TENROUNDS in Garsfontein, Pretoria East. Hours, directions and WhatsApp.',
  },
}

export default function ContactPage() {
  return (
    <main>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />

      <PageHero
        eyebrow="Contact"
        title="Come Train With Us"
        description="Questions, directions or ready to start? Reach out and our team will get you moving."
        image="/gym-exterior-night.jpg"
        imageAlt="TENROUNDS gym exterior lit up at night with blue neon glowing through the windows"
      />

      <section className="bg-background py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-5 lg:grid-cols-2 lg:px-8">
          {/* details */}
          <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ContactCard icon={MapPin} title="Location">
                <a href={business.mapsLink} target="_blank" rel="noopener noreferrer" className="hover:text-neon-blue">
                  {fullAddress}
                </a>
              </ContactCard>
              <ContactCard icon={Phone} title="Call Us">
                <a href={`tel:${business.phoneE164}`} className="hover:text-neon-blue">
                  {business.phoneDisplay}
                </a>
              </ContactCard>
              <ContactCard icon={Mail} title="Email">
                <a href={`mailto:${business.email}`} className="hover:text-neon-blue">
                  {business.email}
                </a>
              </ContactCard>
              <ContactCard icon={MessageCircle} title="WhatsApp">
                <a
                  href={whatsappHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-blue transition-colors hover:text-foreground"
                >
                  Chat with us
                </a>
              </ContactCard>
            </div>

            {/* hours */}
            <div className="rounded-2xl border border-steel bg-card p-6">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-tight">
                <Clock className="size-5 text-neon-blue" /> Operating Hours
              </h3>
              <ul className="mt-4 divide-y divide-steel">
                {business.hoursDisplay.map((h) => (
                  <li key={h.days} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-light-grey">{h.days}</span>
                    <span className="text-right font-semibold text-foreground">{h.time}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* socials */}
            <div className="flex items-center gap-3">
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex size-11 items-center justify-center rounded-md border border-steel text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
              >
                <MessageCircle className="size-5" />
              </a>
              <a
                href={business.socials.instagram}
                aria-label="Instagram"
                className="flex size-11 items-center justify-center rounded-md border border-steel text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
              >
                <Instagram className="size-5" />
              </a>
              <a
                href={business.socials.facebook}
                aria-label="Facebook"
                className="flex size-11 items-center justify-center rounded-md border border-steel text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
              >
                <Facebook className="size-5" />
              </a>
            </div>
          </div>

          {/* form */}
          <ContactForm />
        </div>

        {/* map */}
        <div className="mx-auto mt-12 max-w-7xl px-5 sm:mt-16 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-steel">
            <iframe
              title={`Map showing ${business.name} in Garsfontein, Pretoria East`}
              src={business.mapsEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-72 w-full grayscale sm:h-[420px]"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function ContactCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="h-full rounded-2xl border border-steel bg-card p-4 sm:p-6">
      <span className="flex size-9 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue sm:size-11">
        <Icon className="size-4 sm:size-5" />
      </span>
      <h3 className="mt-3 font-display text-sm font-bold uppercase tracking-wider sm:mt-4">{title}</h3>
      <p className="mt-1 break-words text-xs text-light-grey sm:text-sm">{children}</p>
    </div>
  )
}

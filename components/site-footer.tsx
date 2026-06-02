import Link from 'next/link'
import { Instagram, Facebook, MessageCircle, MapPin, Mail, Phone, Clock } from 'lucide-react'
import { Logo } from '@/components/logo'
import { SignupFormButton } from '@/components/forms/signup-form-button'
import { business, whatsappHref, fullAddress } from '@/lib/business'

const linkGroups = [
  {
    title: 'Train',
    links: [
      { href: '/memberships', label: 'Pricing' },
      { href: '/free-trial', label: 'Free Trial' },
      { href: '#signup', label: 'Join Now', signup: true },
      { href: '/members', label: 'Members' },
      { href: '/about', label: 'About Us' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Programs',
    links: [
      { href: '/hiit-gym-garsfontein', label: 'HIIT Gym Garsfontein' },
      { href: '/weight-loss-gym-pretoria-east', label: 'Weight Loss Gym' },
      { href: '/boxing-gym-pretoria-east', label: 'Boxing Gym' },
      { href: '/kickboxing-classes-pretoria-east', label: 'Kickboxing Classes' },
      { href: '/group-fitness-classes-pretoria-east', label: 'Group Fitness Classes' },
      { href: '/30-minute-workout-pretoria-east', label: '30 Minute Workout' },
    ],
  },
  {
    title: 'Find Us',
    links: [
      { href: '/gym-near-moreleta-park', label: 'Gym Near Moreleta Park' },
      { href: '/gym-near-woodhill', label: 'Gym Near Woodhill' },
      { href: '/gym-near-faerie-glen', label: 'Gym Near Faerie Glen' },
      { href: '/boxing-fitness-pretoria-east', label: 'Boxing Fitness Pretoria East' },
      { href: '/gym-for-busy-professionals-pretoria-east', label: 'Gym For Busy Professionals' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-steel bg-charcoal">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Logo className="h-10" />
          <p className="mt-4 max-w-sm text-pretty text-sm leading-relaxed text-light-grey">
            Coach-supported 30-minute HIIT workouts in Garsfontein, Pretoria East.
            No class times. No waiting. Just real results on your schedule.
          </p>

          <address className="mt-6 space-y-2 text-sm not-italic text-light-grey">
            <a
              href={business.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 transition-colors hover:text-neon-blue"
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-neon-blue" /> {fullAddress}
            </a>
            <a
              href={`tel:${business.phoneE164}`}
              className="flex items-center gap-2 transition-colors hover:text-neon-blue"
            >
              <Phone className="size-4 shrink-0 text-neon-blue" /> {business.phoneDisplay}
            </a>
            <a
              href={`mailto:${business.email}`}
              className="flex items-center gap-2 transition-colors hover:text-neon-blue"
            >
              <Mail className="size-4 shrink-0 text-neon-blue" /> {business.email}
            </a>
          </address>

          <div className="mt-5 space-y-1 text-sm text-light-grey">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Clock className="size-4 text-neon-blue" /> Opening Hours
            </p>
            {business.hoursDisplay.map((h) => (
              <p key={h.days} className="pl-6">
                <span className="text-foreground">{h.days}:</span> {h.time}
              </p>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex size-10 items-center justify-center rounded-md border border-steel text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
            >
              <MessageCircle className="size-5" />
            </a>
            <a
              href={business.socials.instagram}
              aria-label="Instagram"
              className="flex size-10 items-center justify-center rounded-md border border-steel text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
            >
              <Instagram className="size-5" />
            </a>
            <a
              href={business.socials.facebook}
              aria-label="Facebook"
              className="flex size-10 items-center justify-center rounded-md border border-steel text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
            >
              <Facebook className="size-5" />
            </a>
          </div>
        </div>

        {linkGroups.map((group) => (
          <div key={group.title}>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
              {group.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  {'signup' in link && link.signup ? (
                    <SignupFormButton className="text-sm text-light-grey transition-colors hover:text-neon-blue">
                      {link.label}
                    </SignupFormButton>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-light-grey transition-colors hover:text-neon-blue"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-steel">
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          <p className="text-xs leading-relaxed text-mid-grey">
            <span className="text-light-grey">Areas we serve:</span>{' '}
            {business.areasServed.join(' · ')} — and surrounding Pretoria East suburbs.
          </p>
          <p className="mt-4 text-sm text-light-grey">
            &copy; {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

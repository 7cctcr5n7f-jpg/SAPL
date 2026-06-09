import type { Metadata } from "next"
import { SectionTitle } from "@/components/brand/bits"
import { ContactForm } from "@/components/site/contact-form"
import { Mail, MapPin, MessageCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the South African Padel League — support, partnerships, club onboarding and media.",
}

const CHANNELS = [
  {
    icon: Mail,
    title: "General & Support",
    detail: "Questions about your account, fixtures, rankings or results.",
    value: "support@sapl.co.za",
    href: "mailto:support@sapl.co.za",
  },
  {
    icon: MessageCircle,
    title: "Partnerships & Sponsors",
    detail: "Sponsorship tiers, marketplace listings and brand collaborations.",
    value: "partners@sapl.co.za",
    href: "mailto:partners@sapl.co.za",
  },
  {
    icon: MapPin,
    title: "Based in",
    detail: "Serving clubs across the region and beyond.",
    value: "Tshwane, Gauteng, South Africa",
  },
]

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <SectionTitle eyebrow="Get In Touch" title="Contact SAPL" />
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Whether you&apos;re a player with a question, a club ready to join, or a brand looking to partner with South
        Africa&apos;s premier padel league, we&apos;d love to hear from you.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon
            const body = (
              <div className="flex gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="heading text-base">{c.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">{c.value}</p>
                </div>
              </div>
            )
            return c.href ? (
              <a key={c.title} href={c.href} className="block">
                {body}
              </a>
            ) : (
              <div key={c.title}>{body}</div>
            )
          })}
        </div>

        <div className="lg:col-span-3">
          <ContactForm />
        </div>
      </div>
    </div>
  )
}

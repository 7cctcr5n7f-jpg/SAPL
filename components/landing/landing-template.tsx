import Image from 'next/image'
import Link from 'next/link'
import {
  Check,
  X,
  ArrowRight,
  MessageCircle,
  MapPin,
  Clock,
  Heart,
  Zap,
  Users,
  Timer,
  Target,
  Dumbbell,
  TrendingUp,
} from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { SignupFormButton } from '@/components/forms/signup-form-button'
import { Reveal } from '@/components/reveal'
import { FaqSection } from '@/components/faq-section'
import { TestimonialsSection } from '@/components/testimonials-section'
import { LocationSection } from '@/components/location-section'
import { CtaBanner } from '@/components/cta-banner'
import { JsonLd } from '@/components/json-ld'
import { faqSchema, breadcrumbSchema } from '@/lib/seo'
import { business, whatsappHref } from '@/lib/business'
import type { Faq, Testimonial } from '@/lib/content'

const iconMap = {
  heart: Heart,
  zap: Zap,
  users: Users,
  timer: Timer,
  target: Target,
  dumbbell: Dumbbell,
  trending: TrendingUp,
  clock: Clock,
} as const

type IconKey = keyof typeof iconMap

export type LandingBlock =
  | {
      type: 'features'
      eyebrow: string
      title: string
      description?: string
      dark?: boolean
      items: { icon?: IconKey; title: string; desc: string }[]
    }
  | {
      type: 'split'
      eyebrow: string
      title: string
      body: string[]
      image: string
      imageAlt: string
      reverse?: boolean
      bullets?: string[]
      dark?: boolean
    }
  | {
      type: 'compare'
      eyebrow: string
      title: string
      failTitle: string
      winTitle: string
      fail: string[]
      win: string[]
      dark?: boolean
    }
  | {
      type: 'checklist'
      eyebrow: string
      title: string
      description?: string
      items: string[]
      dark?: boolean
    }

export type LandingConfig = {
  slug: string
  breadcrumb: string
  heroEyebrow: string
  heroTitle: string
  heroHighlight?: string
  heroSubtitle: string
  heroImage: string
  heroImageAlt: string
  intro?: string
  blocks: LandingBlock[]
  faqs: Faq[]
  testimonials?: Testimonial[]
  showMap?: boolean
  ctaHeadline: string
  ctaSub: string
}

function sectionBg(dark?: boolean) {
  return dark ? 'bg-charcoal' : 'bg-background'
}

export function LandingTemplate({ config }: { config: LandingConfig }) {
  return (
    <main>
      <JsonLd
        data={[
          faqSchema(config.faqs),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: config.breadcrumb, path: `/${config.slug}` },
          ]),
        ]}
      />

      {/* HERO */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={config.heroImage}
            alt={config.heroImageAlt}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-5 pt-32 pb-16 lg:px-8">
          <div className="max-w-2xl">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue">
              <span className="h-px w-8 bg-neon-blue" /> {config.heroEyebrow}
            </span>
            <h1 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] tracking-tight text-balance md:text-6xl lg:text-7xl">
              {config.heroTitle}{' '}
              {config.heroHighlight && (
                <span className="text-neon-blue text-glow">{config.heroHighlight}</span>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-light-grey">
              {config.heroSubtitle}
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-light-grey">
              <MapPin className="size-4 text-neon-blue" /> Garsfontein, Pretoria East · South
              Africa
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/free-trial"
                className="group inline-flex items-center justify-center gap-2 rounded-md bg-cobalt px-8 py-4 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
              >
                Start Your Free Trial
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-8 py-4 font-display text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.02]"
              >
                <MessageCircle className="size-5" /> WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO */}
      {config.intro && (
        <section className="border-b border-steel bg-background py-14">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <p className="text-pretty text-xl leading-relaxed text-light-grey">{config.intro}</p>
          </div>
        </section>
      )}

      {/* BLOCKS */}
      {config.blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}

      {/* AREAS WE SERVE */}
      <AreasServed />

      {/* TESTIMONIALS */}
      <TestimonialsSection testimonials={config.testimonials} dark />

      {/* MAP */}
      {config.showMap && <LocationSection />}

      {/* INTERNAL LINKS */}
      <InternalLinks />

      {/* FAQ */}
      <FaqSection faqs={config.faqs} />

      {/* CTA */}
      <CtaBanner
        headline={config.ctaHeadline}
        subheadline={config.ctaSub}
        buttonLabel="Start Your Free Trial"
      />
    </main>
  )
}

function BlockRenderer({ block }: { block: LandingBlock }) {
  if (block.type === 'features') {
    return (
      <section className={`${sectionBg(block.dark)} py-20 lg:py-28`}>
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow={block.eyebrow}
            title={block.title}
            description={block.description}
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {block.items.map((item, i) => {
              const Icon = item.icon ? iconMap[item.icon] : Check
              return (
                <Reveal key={item.title} delay={i * 70}>
                  <div className="h-full rounded-2xl border border-steel bg-card p-6">
                    <span className="flex size-12 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue">
                      <Icon className="size-6" />
                    </span>
                    <h3 className="mt-5 font-display text-lg font-bold uppercase tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-light-grey">{item.desc}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  if (block.type === 'split') {
    return (
      <section className={`${sectionBg(block.dark)} py-20 lg:py-28`}>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
          <div className={block.reverse ? 'lg:order-2' : ''}>
            <SectionHeading eyebrow={block.eyebrow} title={block.title} />
            <div className="mt-5 space-y-4">
              {block.body.map((p) => (
                <p key={p} className="text-pretty leading-relaxed text-light-grey">
                  {p}
                </p>
              ))}
            </div>
            {block.bullets && (
              <ul className="mt-6 space-y-3">
                {block.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-light-grey">
                    <Check className="mt-0.5 size-4 shrink-0 text-neon-blue" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl border border-steel ${block.reverse ? 'lg:order-1' : ''}`}>
            <Image src={block.image} alt={block.imageAlt} fill className="object-cover" />
          </div>
        </div>
      </section>
    )
  }

  if (block.type === 'compare') {
    return (
      <section className={`${sectionBg(block.dark)} py-20 lg:py-28`}>
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading align="center" eyebrow={block.eyebrow} title={block.title} className="mx-auto" />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-steel bg-card p-8">
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-light-grey">
                {block.failTitle}
              </h3>
              <ul className="mt-6 space-y-4">
                {block.fail.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-light-grey">
                    <X className="mt-0.5 size-5 shrink-0 text-destructive" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-neon-blue/50 bg-cobalt/10 p-8 blue-glow">
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
                {block.winTitle}
              </h3>
              <ul className="mt-6 space-y-4">
                {block.win.map((w) => (
                  <li key={w} className="flex items-start gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 size-5 shrink-0 text-neon-blue" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // checklist
  return (
    <section className={`${sectionBg(block.dark)} py-20 lg:py-28`}>
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <SectionHeading eyebrow={block.eyebrow} title={block.title} description={block.description} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-lg border border-steel bg-card p-4 text-sm text-light-grey"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-neon-blue" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function AreasServed() {
  return (
    <section className="bg-charcoal py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Areas We Serve"
          title="Proudly Training Pretoria East"
          description="Conveniently located in Garsfontein and trusted by members across the surrounding suburbs."
          className="mx-auto"
        />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {business.areasServed.map((area) => (
            <span
              key={area}
              className="inline-flex items-center gap-2 rounded-full border border-steel bg-background px-4 py-2 text-sm text-light-grey"
            >
              <MapPin className="size-4 text-neon-blue" />
              {area}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function InternalLinks() {
  const links = [
    { href: '/memberships', label: 'View Pricing', desc: 'Build your membership in 15 seconds.' },
    { href: '/free-trial', label: 'Free Trial', desc: 'Your first session is on us.' },
    { href: '#signup', label: 'Join Now', desc: 'Sign up online in minutes.', signup: true },
    { href: '/contact', label: 'Visit Us', desc: 'Hours, directions and contact.' },
  ]
  return (
    <section className="bg-background py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((l) =>
            'signup' in l && l.signup ? (
              <SignupFormButton
                key={l.href}
                className="group block w-full rounded-2xl border border-steel bg-card p-6 text-left transition-all hover:border-neon-blue/60"
              >
                <span className="flex items-center justify-between font-display text-base font-bold uppercase tracking-tight text-foreground">
                  {l.label}
                  <ArrowRight className="size-4 text-neon-blue transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-2 block text-sm text-light-grey">{l.desc}</span>
              </SignupFormButton>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="group rounded-2xl border border-steel bg-card p-6 transition-all hover:border-neon-blue/60"
              >
                <p className="flex items-center justify-between font-display text-base font-bold uppercase tracking-tight text-foreground">
                  {l.label}
                  <ArrowRight className="size-4 text-neon-blue transition-transform group-hover:translate-x-1" />
                </p>
                <p className="mt-2 text-sm text-light-grey">{l.desc}</p>
              </Link>
            ),
          )}
        </div>
      </div>
    </section>
  )
}

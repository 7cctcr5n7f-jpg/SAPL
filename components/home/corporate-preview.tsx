import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Building2, Users, Trophy } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const points = [
  { icon: Building2, label: 'Corporate memberships' },
  { icon: Users, label: 'Team fitness challenges' },
  { icon: Trophy, label: 'Workplace health initiatives' },
]

export function CorporatePreview() {
  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
        <Reveal className="relative order-2 overflow-hidden rounded-2xl border border-steel lg:order-1">
          <Image
            src="/community-members.png"
            alt="Group of TENROUNDS members smiling together after a boxing workout"
            width={800}
            height={600}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/70 to-transparent" />
        </Reveal>

        <div className="order-1 lg:order-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue">
            <span className="h-px w-8 bg-neon-blue" />
            Corporate Wellness
          </span>
          <h2 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight md:text-5xl">
            Healthier Teams. Better Performance.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-light-grey">
            Invest in your people with employee wellness programs that boost
            energy, focus and retention. Bring the TENROUNDS performance culture
            into your organisation.
          </p>

          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p.label} className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue">
                  <p.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-foreground">{p.label}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/corporate-wellness"
            className="group mt-10 inline-flex items-center gap-2 rounded-md bg-cobalt px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
          >
            Partner With TENROUNDS
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}

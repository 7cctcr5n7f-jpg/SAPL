import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CtaBanner({
  headline = 'Ready To Experience TENROUNDS?',
  subheadline = 'Claim your free trial and discover why more people are choosing smarter, faster, more effective workouts.',
  buttonLabel = 'Claim Your Free Trial',
  href = '/free-trial',
}: {
  headline?: string
  subheadline?: string
  buttonLabel?: string
  href?: string
}) {
  return (
    <section className="relative overflow-hidden bg-black py-24 lg:py-32">
      <div className="animate-pulse-glow pointer-events-none absolute left-1/4 top-0 size-96 -translate-x-1/2 rounded-full bg-cobalt/30 blur-[130px]" />
      <div className="animate-pulse-glow pointer-events-none absolute right-1/4 bottom-0 size-96 translate-x-1/2 rounded-full bg-neon-blue/25 blur-[130px]" />

      <div className="relative mx-auto max-w-4xl px-5 text-center lg:px-8">
        <h2 className="font-display text-balance text-5xl font-black uppercase leading-[0.9] tracking-tight md:text-6xl lg:text-7xl">
          {headline}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-light-grey">
          {subheadline}
        </p>
        <Link
          href={href}
          className="group mt-10 inline-flex items-center gap-2 rounded-md bg-cobalt px-10 py-5 text-base font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
        >
          {buttonLabel}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  )
}

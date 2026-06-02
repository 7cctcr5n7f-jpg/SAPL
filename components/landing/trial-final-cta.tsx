import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function TrialFinalCta() {
  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="animate-pulse-glow pointer-events-none absolute left-1/2 top-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt/15 blur-[140px]" />
      <div className="relative mx-auto max-w-3xl px-5 text-center lg:px-8">
        <h2 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-balance md:text-5xl">
          Ready To Experience <span className="text-neon-blue text-glow">TENROUNDS</span> For Yourself?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-light-grey">
          Join hundreds of Pretoria East residents who have discovered a smarter, more enjoyable way
          to train.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#book"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-cobalt px-8 py-4 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow sm:w-auto"
          >
            Book My Free Trial <ArrowRight className="size-4" />
          </a>
          <Link
            href="/memberships"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-steel px-8 py-4 font-display text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-neon-blue hover:text-neon-blue sm:w-auto"
          >
            View Membership Options
          </Link>
        </div>
      </div>
    </section>
  )
}

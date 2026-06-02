import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Clock } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col justify-between overflow-hidden">
      {/* background image */}
      <div className="absolute inset-0">
        <Image
          src="/hero-home.png"
          alt="Smiling member throwing a punch during a coach-supported boxing workout at TENROUNDS"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[75%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      </div>

      {/* blue glow accents */}
      <div className="animate-pulse-glow pointer-events-none absolute -left-32 top-1/3 size-96 rounded-full bg-cobalt/30 blur-[120px]" />
      <div className="animate-pulse-glow pointer-events-none absolute right-0 top-1/4 size-72 rounded-full bg-neon-blue/20 blur-[120px]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-12 pt-32 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-steel bg-black/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-neon-blue backdrop-blur">
            <Clock className="size-3.5" /> No class times. Just results.
          </span>

          <h1 className="mt-6 font-display text-6xl font-black uppercase leading-[0.9] tracking-tight text-balance sm:text-7xl lg:text-8xl">
            30 Minutes.
            <br />
            <span className="text-neon-blue text-glow">Real Results.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-light-grey">
            Train when it suits you. No class times. No waiting. Just efficient,
            coach-supported workouts designed to transform your fitness.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/free-trial"
              className="group flex items-center justify-center gap-2 rounded-md bg-cobalt px-8 py-4 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
            >
              Start Your Free Trial
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/memberships"
              className="flex items-center justify-center gap-2 rounded-md border border-steel bg-black/30 px-8 py-4 text-sm font-bold uppercase tracking-wide text-foreground backdrop-blur transition-colors hover:border-neon-blue hover:text-neon-blue"
            >
              View Memberships
            </Link>
          </div>
        </div>
      </div>

      {/* bottom stat strip */}
      <div className="relative border-t border-steel/60 bg-black/50 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-steel/60 px-5 lg:px-8">
          {[
            { value: '30 min', label: 'Per session' },
            { value: '500', label: 'Calories' },
            { value: '100%', label: 'Coach supported' },
          ].map((s) => (
            <div key={s.label} className="px-2 py-5 text-center sm:py-6">
              <p className="font-display text-2xl font-extrabold uppercase text-foreground sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wider text-light-grey">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

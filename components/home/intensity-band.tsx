import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function IntensityBand() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative h-[420px] w-full sm:h-[480px] lg:h-[560px]">
        <Image
          src="/intensity-ball.webp"
          alt="TENROUNDS athlete driving through a medicine-ball slam in a blue-lit training floor"
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* readability overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto flex w-full max-w-7xl px-5 lg:px-8">
            <div className="max-w-xl">
              <span className="inline-flex items-center rounded-full border border-neon-blue/50 bg-black/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-neon-blue backdrop-blur">
                Earn Every Round
              </span>
              <h2 className="mt-5 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Leave It All
                <br />
                <span className="text-neon-blue text-glow">On The Floor</span>
              </h2>
              <p className="mt-5 max-w-md text-pretty leading-relaxed text-light-grey">
                Ten rounds. Thirty minutes. Full effort, fully coached. Every session is
                built to push you further than you would push yourself.
              </p>
              <Link
                href="/free-trial"
                className="group mt-8 inline-flex items-center gap-2 rounded-md bg-cobalt px-8 py-4 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
              >
                Step Into Round One
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

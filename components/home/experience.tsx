import Image from 'next/image'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const tiles = [
  { src: '/gym-stations.png', label: 'Workout Stations', span: 'lg:col-span-2 lg:row-span-2' },
  { src: '/functional-zone.png', label: 'Functional Zones', span: '' },
  { src: '/strength-training.png', label: 'Strength Equipment', span: '' },
  { src: '/coach-support.png', label: 'Coaches In Your Corner', span: 'lg:col-span-2' },
]

export function Experience() {
  return (
    <section className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Experience TENROUNDS"
          title="More Than A Gym"
          description="Step into a high-energy performance environment built around movement, coaching and community."
        />

        <div className="mt-14 grid auto-rows-[220px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <Reveal
              key={t.label}
              delay={i * 90}
              className={`group relative overflow-hidden rounded-xl border border-steel ${t.span}`}
            >
              <Image
                src={t.src || '/placeholder.svg'}
                alt={t.label}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="absolute inset-0 ring-0 ring-inset ring-neon-blue/0 transition-all duration-300 group-hover:ring-2 group-hover:ring-neon-blue/60" />
              <span className="absolute bottom-4 left-4 font-display text-sm font-bold uppercase tracking-wide text-foreground">
                {t.label}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { coaches } from '@/lib/team'

type CoachesGridProps = {
  eyebrow?: string
  title?: string
  description?: string
  align?: 'left' | 'center'
  background?: 'background' | 'charcoal'
  cta?: { label: string; href: string }
}

export function CoachesGrid({
  eyebrow = 'The Team',
  title = 'Coaches In Your Corner',
  description = 'Qualified, motivating and genuinely invested in your progress.',
  align = 'left',
  background = 'charcoal',
  cta,
}: CoachesGridProps) {
  return (
    <section
      className={
        background === 'charcoal'
          ? 'bg-charcoal py-24 lg:py-32'
          : 'bg-background py-24 lg:py-32'
      }
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          align={align}
          eyebrow={eyebrow}
          title={title}
          description={description}
          className={align === 'center' ? 'mx-auto' : undefined}
        />

        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {coaches.map((member, i) => (
            <Reveal key={member.name} delay={i * 80}>
              <article
                tabIndex={0}
                aria-label={`${member.name}, ${member.role}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-steel outline-none transition-colors hover:border-neon-blue/60 focus-visible:border-neon-blue"
              >
                <Image
                  src={member.image || '/placeholder.svg'}
                  alt={`${member.name}, ${member.role} at TENROUNDS`}
                  width={400}
                  height={500}
                  className="h-full w-full object-cover object-top grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105 group-focus:grayscale-0 group-focus:scale-105"
                />

                {/* persistent name plate — fades out on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent transition-opacity duration-500 group-hover:opacity-0 group-focus:opacity-0" />
                <div className="absolute inset-x-4 bottom-4 transition-all duration-500 group-hover:translate-y-3 group-hover:opacity-0 group-focus:translate-y-3 group-focus:opacity-0">
                  <p className="font-display text-base font-bold uppercase leading-tight tracking-tight text-balance">
                    {member.name}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase leading-snug tracking-wider text-neon-blue text-pretty">
                    {member.role}
                  </p>
                </div>

                {/* detail panel — slides up + fades in on hover/focus */}
                <div className="absolute inset-0 flex translate-y-6 flex-col justify-end bg-gradient-to-t from-black via-black/90 to-black/45 p-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">
                  <p className="font-display text-sm font-bold uppercase leading-tight tracking-tight text-balance">
                    {member.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase leading-snug tracking-wider text-neon-blue">
                    {member.role}
                  </p>
                  <p className="mt-2 line-clamp-5 text-[11px] leading-relaxed text-light-grey text-pretty">
                    {member.bio}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {member.specialties.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-steel/80 bg-charcoal/80 px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-light-grey"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {cta && (
          <div className={align === 'center' ? 'mt-12 text-center' : 'mt-12'}>
            <Link
              href={cta.href}
              className="inline-flex items-center gap-2 rounded-md border border-steel bg-background px-6 py-3 text-sm font-semibold uppercase tracking-wide text-foreground transition-all hover:border-neon-blue/50 hover:text-neon-blue"
            >
              {cta.label}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

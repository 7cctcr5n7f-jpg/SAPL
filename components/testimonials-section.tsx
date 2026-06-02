import { Star } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { GoogleReviewsBadge } from '@/components/google-reviews-badge'
import { testimonials as defaultTestimonials, type Testimonial } from '@/lib/content'

export function TestimonialsSection({
  testimonials = defaultTestimonials,
  eyebrow = 'Social Proof',
  title = 'Loved By Pretoria East',
  subtitle,
  dark = false,
}: {
  testimonials?: Testimonial[]
  eyebrow?: string
  title?: string
  subtitle?: string
  dark?: boolean
}) {
  return (
    <section className={dark ? 'bg-charcoal py-20 lg:py-28' : 'bg-background py-20 lg:py-28'}>
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading align="center" eyebrow={eyebrow} title={title} subtitle={subtitle} className="mx-auto" />
        <div className="mt-8 flex justify-center">
          <GoogleReviewsBadge />
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-6 lg:grid-cols-4">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <figure className="flex h-full flex-col rounded-2xl border border-steel bg-card p-4 sm:p-6">
                <div className="flex gap-0.5 text-neon-blue sm:gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-3 fill-current sm:size-4" />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-pretty text-xs leading-relaxed text-light-grey sm:mt-4 sm:text-sm">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 border-t border-steel/60 pt-3 sm:mt-5 sm:pt-4">
                  <p className="font-display text-xs font-bold uppercase leading-tight tracking-tight text-foreground sm:text-sm">
                    {t.name}
                  </p>
                  <p className="text-[11px] text-light-grey sm:text-xs">{t.detail}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 text-center">
          <a
            href="https://g.page/r/CeLY1IcSU2QsEAE/review"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-neon-blue px-7 py-3 font-display text-sm font-bold uppercase tracking-wide text-background transition-transform hover:scale-105"
          >
            Read &amp; write reviews on Google
          </a>
        </div>
      </div>
    </section>
  )
}

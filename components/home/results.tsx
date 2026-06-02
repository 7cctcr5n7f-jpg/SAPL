import Image from 'next/image'
import { Star } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { Counter } from '@/components/counter'
import { VideoTestimonial } from '@/components/home/video-testimonial'

const stats = [
  { to: 30, suffix: ' MIN', label: 'Average session' },
  { to: 10, suffix: ' ROUNDS', label: 'Structured rotating exercises' },
  { to: 6, suffix: ' DAYS', label: 'Train on your schedule' },
  { to: 1, suffix: ' GOAL', label: 'Become stronger, fitter and healthier' },
]

const testimonials = [
  {
    quote:
      'Words can’t fully describe the experience at 10 Rounds; it is the best gym I have ever joined. There is always a minimum of three trainers on the floor to assist you — that personal training experience for a fraction of the cost.',
    name: 'T Africa OHS Specialists',
    role: 'Google review',
  },
  {
    quote:
      'Wow wow wow, what a beautiful find 10rounds has been. Sessions are always fun, different and challenging. Trainers are ALWAYS interactive and so happy to see you when you walk through the doors.',
    name: 'Taryn Marshall',
    role: 'Local Guide · Google review',
  },
  {
    quote:
      'Love love love die work-outs en die energie. Dit voel konstant of mens ’n personal trainer het. Mens raak ook nooit bored nie omdat die oefeninge heeltyd verander. Ek sal TENROUNDS vir almal aanbeveel.',
    name: 'Mariska Grobler',
    role: 'Google review',
  },
]

export function Results() {
  return (
    <section className="relative overflow-hidden bg-charcoal py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Results"
          title="Real Members. Real Results."
          description="The numbers speak, but the people speak louder. This is what consistent, coach-supported training delivers."
        />

        {/* stats */}
        <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="rounded-xl border border-steel bg-background p-6 text-center">
                <p className="whitespace-nowrap font-display text-2xl font-black uppercase text-neon-blue text-glow sm:text-3xl lg:text-4xl">
                  <Counter to={s.to} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-xs uppercase tracking-wider text-light-grey">
                  {s.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* featured transformation: photo + video story side by side */}
        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-2">
          <Reveal className="group relative overflow-hidden rounded-2xl border border-steel">
            <Image
              src="/izelle-theron-transformation.jpg"
              alt="Izelle Theron, TENROUNDS member who lost 15kg"
              width={720}
              height={1280}
              className="h-full max-h-[520px] w-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-6">
              <span className="inline-flex items-center rounded-full bg-neon-blue px-3 py-1 font-display text-sm font-black uppercase tracking-wide text-background">
                -15kg
              </span>
              <p className="mt-3 font-display text-2xl font-extrabold uppercase">
                Izelle Theron
              </p>
              <p className="mt-1 max-w-sm text-sm text-light-grey">
                Down 15kg with consistent, coach-supported training.
              </p>
            </div>
          </Reveal>

          {/* self-hosted video testimonial — no Facebook dependency */}
          <Reveal>
            <VideoTestimonial />
          </Reveal>
        </div>

        {/* member reviews — swipeable carousel on mobile, grid on desktop */}
        <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 100} className="w-[82%] shrink-0 snap-center md:w-auto md:shrink">
              <figure className="flex h-full flex-col rounded-xl border border-steel bg-background p-6">
                <div className="flex gap-1 text-neon-blue">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="size-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-pretty text-sm leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <span className="text-light-grey"> &middot; {t.role}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-2 text-center text-xs uppercase tracking-wider text-light-grey md:hidden">
          Swipe to read more reviews
        </p>
      </div>
    </section>
  )
}

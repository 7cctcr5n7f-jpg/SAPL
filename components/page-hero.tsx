import Image from 'next/image'

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  image?: string
  imageAlt?: string
}) {
  return (
    <section className="relative flex min-h-[60vh] items-end overflow-hidden pb-16 pt-40">
      <div className="absolute inset-0">
        {image ? (
          <Image
            src={image || '/placeholder.svg'}
            alt={imageAlt}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-charcoal" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50" />
      </div>
      <div className="animate-pulse-glow pointer-events-none absolute -left-20 bottom-0 size-80 rounded-full bg-cobalt/25 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-7xl px-5 lg:px-8">
        {eyebrow && (
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue">
            <span className="h-px w-8 bg-neon-blue" />
            {eyebrow}
          </span>
        )}
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-black uppercase leading-[0.9] tracking-tight text-balance md:text-6xl lg:text-7xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-light-grey">
            {description}
          </p>
        )}
      </div>
    </section>
  )
}

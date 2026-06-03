import Image from 'next/image'

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt = '',
  compact = false,
}: {
  eyebrow?: string
  title: string
  description?: string
  image?: string
  imageAlt?: string
  compact?: boolean
}) {
  return (
    <section
      className={
        'relative flex items-end overflow-hidden ' +
        (compact
          ? 'min-h-[34vh] pb-10 pt-28 lg:min-h-[48vh] lg:pb-16 lg:pt-40'
          : 'min-h-[60vh] pb-16 pt-40')
      }
    >
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
        <h1
          className={
            'max-w-4xl font-display font-black uppercase leading-[0.9] tracking-tight text-balance ' +
            (compact
              ? 'mt-3 text-4xl md:text-6xl lg:text-7xl'
              : 'mt-4 text-5xl md:text-6xl lg:text-7xl')
          }
        >
          {title}
        </h1>
        {description && (
          <p
            className={
              'max-w-2xl text-pretty leading-relaxed text-light-grey ' +
              (compact ? 'mt-3 text-base lg:text-lg' : 'mt-5 text-lg')
            }
          >
            {description}
          </p>
        )}
      </div>
    </section>
  )
}

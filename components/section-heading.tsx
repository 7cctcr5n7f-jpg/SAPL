import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  description,
  subtitle,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}) {
  const copy = description ?? subtitle
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {eyebrow && (
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue">
          <span className="h-px w-8 bg-neon-blue" />
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-balance text-4xl font-extrabold uppercase leading-[0.95] tracking-tight md:text-5xl lg:text-6xl">
        {title}
      </h2>
      {copy && (
        <p
          className={cn(
            'text-pretty text-base leading-relaxed text-light-grey md:text-lg',
            align === 'center' ? 'max-w-2xl' : 'max-w-xl',
          )}
        >
          {copy}
        </p>
      )}
    </div>
  )
}

import { Star } from 'lucide-react'

const REVIEW_URL = 'https://g.page/r/CeLY1IcSU2QsEAE/review'
const RATING = 4.8

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  )
}

export function GoogleReviewsBadge({
  className = '',
  variant = 'full',
}: {
  className?: string
  variant?: 'full' | 'compact'
}) {
  if (variant === 'compact') {
    return (
      <a
        href={REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-3 rounded-full border border-steel bg-card px-4 py-2 transition-colors hover:border-neon-blue/60 ${className}`}
      >
        <GoogleG className="size-5 shrink-0" />
        <span className="flex items-center gap-1.5">
          <span className="font-display text-base font-bold leading-none text-foreground">
            {RATING.toFixed(1)}
          </span>
          <span className="flex text-neon-blue">
            {Array.from({ length: 5 }).map((_, s) => (
              <Star key={s} className="size-3.5 fill-current" />
            ))}
          </span>
        </span>
        <span className="text-xs font-medium text-light-grey">on Google</span>
      </a>
    )
  }

  return (
    <a
      href={REVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Rated ${RATING} out of 5 on Google — read and write reviews`}
      className={`group inline-flex items-center gap-4 rounded-2xl border border-steel bg-card px-6 py-4 transition-colors hover:border-neon-blue/60 ${className}`}
    >
      <GoogleG className="size-9 shrink-0" />
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold leading-none text-foreground">
            {RATING.toFixed(1)}
          </span>
          <span className="flex text-neon-blue">
            {Array.from({ length: 5 }).map((_, s) => (
              <Star key={s} className="size-4 fill-current" />
            ))}
          </span>
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-wider text-light-grey">
          Real Google reviews{' '}
          <span className="text-neon-blue group-hover:underline">— read them all</span>
        </span>
      </div>
    </a>
  )
}

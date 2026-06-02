import Link from 'next/link'

/**
 * Routes the visitor to the premium native membership signup experience at
 * `/signup`. Previously this opened a Jotform modal; the in-app signup flow now
 * supersedes it. Kept as a shared component so every call site (footer, landing
 * pages, corporate page, etc.) stays consistent through a single import.
 *
 * Style it entirely through `className` + `children` so it can match whatever
 * surrounds it (a CTA button, a footer link, etc.).
 */
export function SignupFormButton({
  children,
  className,
  href = '/signup',
}: {
  children: React.ReactNode
  className?: string
  href?: string
  /** Accepted for backwards-compatibility; no longer used. */
  formId?: string
  title?: string
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

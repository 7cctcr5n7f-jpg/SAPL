import { cn } from "@/lib/utils"

/**
 * Shared dense layout primitives used across League Centre, dashboard, team
 * and club pages. These keep spacing tight and consistent so screens feel like
 * a focused sports app rather than a marketing site.
 */

/** Compact section heading with an optional action on the right. */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-3", className)}>
      <h2 className="heading text-sm uppercase tracking-wide text-muted-foreground">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** A tight grid of key/value stats — replaces oversized stat blocks. */
export function StatGrid({
  stats,
  columns = 4,
  className,
}: {
  stats: { label: string; value: React.ReactNode }[]
  columns?: 2 | 3 | 4
  className?: string
}) {
  const cols =
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-lg border border-border bg-border", cols, className)}>
      {stats.map((s, i) => (
        <div key={i} className="bg-card px-3 py-2.5">
          <p className="heading text-xl leading-none tabular-nums">{s.value}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

/** A horizontal segmented control used for in-page filters/tabs on mobile. */
export function SegmentedTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

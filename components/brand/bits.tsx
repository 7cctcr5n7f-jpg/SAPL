import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export function SectionTitle({
  eyebrow,
  title,
  className,
}: {
  eyebrow?: string
  title: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
      ) : null}
      <h2 className="heading text-3xl md:text-4xl text-balance">{title}</h2>
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-primary pl-4">
      <span className="heading text-3xl md:text-4xl tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

export function TprTrend({ change }: { change: number }) {
  if (change > 0.5)
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary tabular-nums">
        <TrendingUp className="h-4 w-4" /> +{change.toFixed(0)}
      </span>
    )
  if (change < -0.5)
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground tabular-nums">
        <TrendingDown className="h-4 w-4" /> {change.toFixed(0)}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Minus className="h-4 w-4" /> 0
    </span>
  )
}

export function DivisionTag({ name }: { name: string }) {
  const map: Record<string, string> = {
    Premier: "bg-primary text-primary-foreground",
    Championship: "bg-foreground text-background",
    Shield: "bg-secondary text-secondary-foreground border border-border",
    Challenge: "bg-transparent text-muted-foreground border border-border",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
        map[name] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {name}
    </span>
  )
}

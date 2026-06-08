import { cn } from "@/lib/utils"

function initials(name: string | null | undefined) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Crest({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string | null | undefined
  logoUrl?: string | null
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const dims = size === "lg" ? "h-14 w-14 text-base" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs"
  if (logoUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary",
          dims,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || "/placeholder.svg"} alt={`${name ?? "Team"} crest`} className="h-full w-full object-cover" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-bold tracking-wide text-foreground",
        dims,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

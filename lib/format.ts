export function fmtZAR(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return "TBD"
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" }).format(d)
}

export function fmtDateTime(date: Date | string | null | undefined): string {
  if (!date) return "TBD"
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?"
}

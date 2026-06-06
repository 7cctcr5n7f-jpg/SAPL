"use client"

import { useRouter } from "next/navigation"

export function SeasonSwitcher({
  seasons,
  current,
}: {
  seasons: { id: number; name: string; isCurrent: boolean }[]
  current: number | null
}) {
  const router = useRouter()
  if (seasons.length <= 1) return null
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Season</span>
      <select
        value={current ?? ""}
        onChange={(e) => router.push(`/admin?tab=placement&season=${e.target.value}`)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  )
}

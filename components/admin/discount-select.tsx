'use client'

import { allMembershipsFlat } from '@/lib/memberships'

export function DiscountSelect({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="rounded-lg border border-steel/60 bg-background/50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-light-grey">
        Apply discount to memberships
      </p>
      <p className="mb-3 text-[11px] text-light-grey">
        Selected plans show a struck-through price with the discounted price on the pricing table.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {allMembershipsFlat.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="discountMembershipIds"
              value={m.id}
              defaultChecked={selected.includes(m.id)}
              className="size-4 accent-[var(--color-neon-blue)]"
            />
            {m.label}
          </label>
        ))}
      </div>
    </div>
  )
}

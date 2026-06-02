'use client'

import { CalendarOff, Trash2 } from 'lucide-react'
import { saveBlockedDay, deleteBlockedDay } from '@/app/actions/admin'
import type { BlockedDay } from '@/lib/db/schema'

function formatDay(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function BlockedDaysManager({ days }: { days: BlockedDay[] }) {
  // Sort soonest first.
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-5">
      {/* Add a blocked day */}
      <div className="rounded-2xl border border-steel bg-card p-5 sm:p-6">
        <form action={saveBlockedDay} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="blocked-day" className="text-xs font-semibold uppercase tracking-wide text-light-grey">
                Date to close
              </label>
              <input
                id="blocked-day"
                type="date"
                name="day"
                min={todayStr}
                required
                className="rounded-md border border-steel bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-neon-blue"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="blocked-reason" className="text-xs font-semibold uppercase tracking-wide text-light-grey">
                Reason (optional)
              </label>
              <input
                id="blocked-reason"
                type="text"
                name="reason"
                placeholder="Public holiday"
                className="rounded-md border border-steel bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-light-grey/60 focus:border-neon-blue"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-md bg-neon-blue px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-transform hover:scale-[1.02]"
            >
              Mark Day Unavailable
            </button>
          </div>
        </form>
      </div>

      {/* List of blocked days */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-steel p-10 text-center">
          <CalendarOff className="mx-auto size-7 text-light-grey" />
          <p className="mt-3 text-sm text-light-grey">
            No unavailable days set. All weekdays and Saturdays are open for trials.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((d) => {
            const past = d.day < todayStr
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-steel bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className={'font-semibold ' + (past ? 'text-light-grey' : 'text-foreground')}>
                    {formatDay(d.day)}
                    {past ? <span className="ml-2 text-xs font-normal text-light-grey">(past)</span> : null}
                  </p>
                  {d.reason ? <p className="truncate text-sm text-light-grey">{d.reason}</p> : null}
                </div>
                <form action={deleteBlockedDay}>
                  <input type="hidden" name="id" defaultValue={d.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${formatDay(d.day)}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-2 text-sm font-semibold text-light-grey transition-colors hover:border-red-500 hover:text-red-400"
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

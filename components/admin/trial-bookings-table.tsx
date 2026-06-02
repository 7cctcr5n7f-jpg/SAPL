'use client'

import { useMemo, useState } from 'react'
import { Search, Trash2, CalendarDays, Mail, Phone } from 'lucide-react'
import { deleteTrialBooking } from '@/app/actions/admin'
import { formatDateLong } from '@/lib/trial-slots'
import type { TrialBooking } from '@/lib/db/schema'

type FilterRange = 'all' | 'upcoming' | 'past'

function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function TrialBookingsTable({ bookings }: { bookings: TrialBooking[] }) {
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<FilterRange>('all')

  const today = todayStr()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter((b) => {
      const matchesQuery =
        !q ||
        b.fullName.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q)
      const matchesRange =
        range === 'all' ||
        (range === 'upcoming' && b.appointmentDate >= today) ||
        (range === 'past' && b.appointmentDate < today)
      return matchesQuery && matchesRange
    })
  }, [bookings, query, range, today])

  const filters: { key: FilterRange; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ]

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-light-grey" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone"
            className="w-full rounded-lg border border-steel bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-light-grey focus:border-neon-blue"
            aria-label="Search bookings"
          />
        </div>
        <div className="flex rounded-lg border border-steel bg-card p-1 text-xs font-semibold uppercase tracking-wide">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setRange(f.key)}
              className={
                'rounded-md px-3 py-1.5 transition-colors ' +
                (range === f.key ? 'bg-neon-blue text-accent-foreground' : 'text-light-grey hover:text-foreground')
              }
              aria-pressed={range === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs uppercase tracking-wide text-light-grey">
        {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-steel p-10 text-center text-sm text-light-grey">
          No bookings found.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-steel md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-card text-xs uppercase tracking-wide text-light-grey">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-steel/60 align-top">
                    <td className="px-4 py-3 font-semibold text-foreground">{b.fullName}</td>
                    <td className="px-4 py-3 text-light-grey">
                      <div className="flex flex-col gap-1">
                        <a href={`mailto:${b.email}`} className="hover:text-neon-blue">{b.email}</a>
                        <a href={`tel:${b.phone}`} className="hover:text-neon-blue">{b.phone}</a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <div className="font-medium">{formatDateLong(b.appointmentDate)}</div>
                      <div className="text-light-grey">{b.appointmentTime}</div>
                    </td>
                    <td className="px-4 py-3 text-light-grey">
                      <div>{new Date(b.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' })}</div>
                      <div className="text-xs">{new Date(b.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton id={b.id} name={b.fullName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-4 flex flex-col gap-3 md:hidden">
            {filtered.map((b) => (
              <div key={b.id} className="rounded-2xl border border-steel bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-bold text-foreground">{b.fullName}</p>
                  <DeleteButton id={b.id} name={b.fullName} />
                </div>
                <div className="mt-3 flex flex-col gap-2 text-sm text-light-grey">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-neon-blue" />
                    {formatDateLong(b.appointmentDate)} · {b.appointmentTime}
                  </span>
                  <a href={`mailto:${b.email}`} className="flex items-center gap-2 hover:text-neon-blue">
                    <Mail className="size-4" /> {b.email}
                  </a>
                  <a href={`tel:${b.phone}`} className="flex items-center gap-2 hover:text-neon-blue">
                    <Phone className="size-4" /> {b.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DeleteButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteTrialBooking}
      onSubmit={(e) => {
        if (!confirm(`Delete the booking for ${name}?`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" defaultValue={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-2 text-xs font-semibold text-light-grey transition-colors hover:border-red-500 hover:text-red-400"
        aria-label={`Delete booking for ${name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  )
}

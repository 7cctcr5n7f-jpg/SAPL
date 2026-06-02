'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { slotGroupsForDay, formatDateLong, slotToMinutes, parseDateString } from '@/lib/trial-slots'
import { submitTrialBooking, type BookingState } from '@/app/actions/trial'

const AGREEMENTS = [
  {
    id: 'safety',
    title: 'Safety Agreement',
    body: 'I agree to comply with all rules imposed by TENROUNDS regarding the use of the facilities and equipment. I understand and agree that TENROUNDS is not responsible for property that is lost, stolen, or damaged while in, on, or about the premises. I understand that the individuals helping me are not personal trainers and only there to motivate and support me and I will not hold any of them liable for any actions. I also understand that loud music will be played at the facility.',
  },
  {
    id: 'risk',
    title: 'Risk Agreement',
    body: 'I acknowledge and accept that participating in open gym activities involves inherent risks, including but not limited to falls, collisions, and equipment-related accidents. I agree to assume all such risks and waive any claims against the facility, its owners, instructors, or staff for any injuries or damages incurred during open gym activities.',
  },
  {
    id: 'liability',
    title: 'Liability Waiver',
    body: 'I understand and agree that I am participating in the open gym sessions at my own risk and hereby waive any claims against the facility, its owners, instructors, or staff for injuries sustained during these sessions. I release them from any liability for any injury, illness, or harm that may occur while using the facilities or equipment.',
  },
] as const

function toDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const initialState: BookingState = { ok: false }

export function TrialBookingForm({ blockedDays = [] }: { blockedDays?: string[] }) {
  const [state, formAction, pending] = useActionState(submitTrialBooking, initialState)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState<string>('')
  const [agreed, setAgreed] = useState<Record<string, boolean>>({})

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  // Blocked dates parsed into Date objects so the calendar can disable them.
  const blockedDateObjs = useMemo(
    () => blockedDays.map((d) => parseDateString(d)).filter((d): d is Date => !!d),
    [blockedDays],
  )

  // When the date changes, reset the chosen time (slots differ per day).
  useEffect(() => {
    setTime('')
  }, [date])

  // Build the slot groups for the chosen day, hiding times that have already
  // passed when the chosen day is today.
  const slotGroups = useMemo(() => {
    if (!date) return []
    const groups = slotGroupsForDay(date.getDay())
    const isToday = toDateString(date) === toDateString(new Date())
    if (!isToday) return groups
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
    return groups
      .map((g) => ({ ...g, slots: g.slots.filter((s) => slotToMinutes(s) > nowMinutes) }))
      .filter((g) => g.slots.length > 0)
  }, [date])

  const hasSlots = slotGroups.length > 0
  const allAgreed = AGREEMENTS.every((a) => agreed[a.id])

  const canSubmit =
    fullName.trim() !== '' &&
    email.trim() !== '' &&
    phone.trim() !== '' &&
    !!date &&
    time !== '' &&
    allAgreed &&
    !pending

  if (state.ok) {
    return <SuccessScreen />
  }

  return (
    <form action={formAction} className="rounded-2xl border border-steel bg-card p-6 sm:p-8">
      {/* hidden values submitted to the server action */}
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="appointmentDate" value={date ? toDateString(date) : ''} />
      <input type="hidden" name="appointmentTime" value={time} />
      <input type="hidden" name="agreementsAccepted" value={allAgreed ? 'true' : 'false'} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Book Your Free Trial
          </h3>
          <p className="mt-1 text-sm text-light-grey">
            Pick a day and time that suits you. No payment, no obligation.
          </p>
        </div>
        {/* Google Reviews Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-2xl font-black text-neon-blue">4.8</span>
            <div className="flex gap-0.5" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="size-4 fill-neon-blue" viewBox="0 0 20 20">
                  <path d="M10 1.5l2.5 7.2h7.8l-6.3 4.6 2.4 7.3-6.4-4.7-6.4 4.7 2.4-7.3-6.3-4.6h7.8z" />
                </svg>
              ))}
            </div>
          </div>
          <p className="text-xs font-semibold text-light-grey">33+ Reviews</p>
        </div>
      </div>

      {/* Details */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextInput label="Full Name" value={fullName} onChange={setFullName} placeholder="Thando Mokoena" className="sm:col-span-2" autoComplete="name" />
        <TextInput label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
        <TextInput label="Contact Number" type="tel" value={phone} onChange={setPhone} placeholder="+27 00 000 0000" autoComplete="tel" />
      </div>

      {/* Date */}
      <div className="mt-8">
        <SectionLabel icon={CalendarDays}>Choose A Date</SectionLabel>
        <div className="mt-3 flex justify-center rounded-xl border border-steel bg-background p-2 sm:p-3">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={[{ before: today }, ...blockedDateObjs]}
            className="mx-auto px-0 [--cell-size:--spacing(8)]"
          />
        </div>
      </div>

      {/* Time */}
      {date ? (
        <div className="mt-8">
          <SectionLabel icon={Clock}>
            Choose A Time
            <span className="ml-2 font-sans text-xs font-medium normal-case tracking-normal text-light-grey">
              {formatDateLong(toDateString(date))}
            </span>
          </SectionLabel>

          {hasSlots ? (
            <div className="mt-4 space-y-5">
              {slotGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-grey">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.slots.map((slot) => {
                      const active = time === slot
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => setTime(slot)}
                          aria-pressed={active}
                          className={cn(
                            'rounded-lg border px-2 py-2.5 text-sm font-semibold tabular-nums transition-all',
                            active
                              ? 'border-neon-blue bg-cobalt/15 text-foreground blue-glow'
                              : 'border-steel bg-background text-light-grey hover:border-neon-blue/60 hover:text-foreground',
                          )}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-steel bg-background px-4 py-3 text-sm text-light-grey">
              {date && date.getDay() === 0
                ? 'No sessions are available on Sundays. Please choose another day.'
                : 'No more sessions are available for this day. Please choose another day.'}
            </p>
          )}
        </div>
      ) : null}

      {/* Agreements */}
      <div className="mt-8">
        <SectionLabel icon={ShieldCheck}>Agreements</SectionLabel>
        <div className="mt-3 space-y-3">
          {AGREEMENTS.map((a) => (
            <label
              key={a.id}
              className={cn(
                'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                agreed[a.id] ? 'border-neon-blue/50 bg-cobalt/5' : 'border-steel bg-background',
              )}
            >
              <input
                type="checkbox"
                checked={!!agreed[a.id]}
                onChange={(e) => setAgreed((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                className="mt-1 size-4 shrink-0 accent-[var(--color-neon-blue)]"
                required
              />
              <span>
                <span className="block font-display text-sm font-bold uppercase tracking-wide text-foreground">
                  {a.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-light-grey">{a.body}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {state.error ? (
        <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-cobalt px-6 py-4 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cobalt disabled:hover:shadow-none"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Booking…
          </>
        ) : (
          <>
            Agree And Book
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  )
}

const UPTIVO_LINK = 'https://uptivo.page.link/XX5n'

function SuccessScreen() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-8 text-center blue-glow sm:p-10">
      <CheckCircle2 className="size-14 text-neon-blue" />
      <h3 className="mt-4 font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
        Get, Set, Go! It&apos;s Trial Time!
      </h3>
      <div className="mt-4 max-w-md space-y-4 text-sm leading-relaxed text-light-grey">
        <p>Rock up in your active gear, a bottle of water and leave the rest to us!</p>
        <p className="font-semibold text-foreground">Your trial request is now confirmed.</p>
        <p>
          Save time and click the link below to download the TENROUNDS app so that we can assign a
          heart rate monitor to your profile before your arrival.
        </p>
      </div>
      <a
        href={UPTIVO_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-cobalt px-6 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
      >
        Download The TENROUNDS App
        <ArrowRight className="size-4" />
      </a>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-steel px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-neon-blue hover:text-neon-blue"
      >
        Back To Home
      </Link>
    </div>
  )
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
      <Icon className="size-4 text-neon-blue" />
      {children}
    </div>
  )
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  className?: string
  autoComplete?: string
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-md border border-steel bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-steel focus:border-neon-blue"
      />
    </div>
  )
}

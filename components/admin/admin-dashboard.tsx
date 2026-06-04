'use client'

import { useState } from 'react'
import { Plus, Trash2, Tag, Trophy, Dumbbell, CalendarCheck, Users, CalendarOff } from 'lucide-react'
import {
  deleteSessionMilestone,
  deleteSpecial,
  logout,
  saveChowWinnerState,
  saveSessionMilestoneState,
  saveSettingState,
  saveSpecialState,
} from '@/app/actions/admin'
import { AdminForm } from '@/components/admin/admin-form'
import { CheckField, FieldGrid, TextArea, TextField } from '@/components/admin/fields'
import { ImageField } from '@/components/admin/image-field'
import { DiscountSelect } from '@/components/admin/discount-select'
import { TrialBookingsTable } from '@/components/admin/trial-bookings-table'
import { BlockedDaysManager } from '@/components/admin/blocked-days-manager'
import { SignupsTable } from '@/components/admin/signups-table'
import type { BlockedDay, ChowWinner, MembershipSignup, SessionMilestone, Special, TrialBooking } from '@/lib/db/schema'

type TabKey = 'bookings' | 'signups' | 'chow' | 'celebration' | 'specials'

function toLocalInput(d: Date | null) {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const cardCls = 'rounded-2xl border border-steel bg-card p-5 sm:p-6'
const deleteBtn =
  'inline-flex items-center gap-1.5 rounded-md border border-steel px-4 py-2.5 text-sm font-semibold text-light-grey transition-colors hover:border-red-500 hover:text-red-400'

function SpecialForm({ special }: { special?: Special }) {
  const selectedIds = (special?.discountMembershipIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <div className={cardCls}>
      <AdminForm action={saveSpecialState} submitLabel={special ? 'Save Changes' : 'Create Membership Special'}>
        <input type="hidden" name="id" defaultValue={special?.id ?? 0} />
        <input type="hidden" name="kind" value="membership" />
        <FieldGrid>
          <TextField label="Title" name="title" defaultValue={special?.title} required placeholder="First Class Free" />
          <TextField label="Badge" name="badge" defaultValue={special?.badge} placeholder="Limited Offer" />
        </FieldGrid>
        <TextArea label="Description" name="description" defaultValue={special?.description} />
        <FieldGrid>
          <TextField label="Button Label" name="ctaLabel" defaultValue={special?.ctaLabel} placeholder="Claim Now" />
          <TextField label="Button Link" name="ctaHref" defaultValue={special?.ctaHref} placeholder="/free-trial" />
        </FieldGrid>
        <ImageField label="Image (optional)" name="imageUrl" defaultValue={special?.imageUrl} />
        <div className="rounded-lg border border-steel/60 bg-background/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-light-grey">Where to show this special</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <CheckField label="Popup overlay" name="showPopup" defaultChecked={special ? special.showPopup : true} />
            <CheckField label="Inline on pricing" name="showInline" defaultChecked={special ? special.showInline : true} />
            <CheckField label="Sticky top bar" name="showBar" defaultChecked={special ? special.showBar : false} />
          </div>
        </div>

        {/* Membership discount */}
        <FieldGrid>
          <TextField
            label="Discount %"
            name="discountPercent"
            type="number"
            defaultValue={String(special?.discountPercent ?? 0)}
            placeholder="20"
          />
          <div className="flex items-end pb-1 text-xs leading-relaxed text-light-grey">
            Set a percentage (e.g. 20) and tick the memberships below to discount them.
          </div>
        </FieldGrid>
        <DiscountSelect selected={selectedIds} />

        <FieldGrid>
          <TextField label="Starts (optional)" name="startsAt" type="datetime-local" defaultValue={toLocalInput(special?.startsAt ?? null)} />
          <TextField label="Ends (optional)" name="endsAt" type="datetime-local" defaultValue={toLocalInput(special?.endsAt ?? null)} />
        </FieldGrid>
        <FieldGrid>
          <TextField label="Sort order" name="sortOrder" type="number" defaultValue={String(special?.sortOrder ?? 0)} />
          <div className="flex items-end pb-2">
            <CheckField label="Active (visible on site)" name="active" defaultChecked={special ? special.active : true} />
          </div>
        </FieldGrid>
      </AdminForm>
      {special ? (
        <form action={deleteSpecial} className="mt-3 border-t border-steel/60 pt-3">
          <input type="hidden" name="id" defaultValue={special.id} />
          <button type="submit" className={deleteBtn}>
            <Trash2 className="size-4" /> Delete
          </button>
        </form>
      ) : null}
    </div>
  )
}

const SESSION_PACKS: { value: number; label: string }[] = [
  { value: 1, label: 'Single' },
  { value: 10, label: '10 Pack' },
  { value: 20, label: '20 Pack' },
  { value: 30, label: '30 Pack' },
]

function SessionSpecialForm({ special }: { special?: Special }) {
  const selectedQtys = (special?.sessionPackQuantities ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const bonusMap: Record<string, string> = {}
  for (const pair of (special?.sessionPackBonuses ?? '').split(',')) {
    const [qty, bonus] = pair.split(':').map((s) => s.trim())
    if (qty && bonus) bonusMap[qty] = bonus
  }
  return (
    <div className={cardCls}>
      <AdminForm action={saveSpecialState} submitLabel={special ? 'Save Changes' : 'Create Sessions Special'}>
        <input type="hidden" name="id" defaultValue={special?.id ?? 0} />
        <input type="hidden" name="kind" value="sessions" />
        <FieldGrid>
          <TextField label="Title" name="title" defaultValue={special?.title} required placeholder="Summer Session Sale" />
          <TextField label="Badge" name="badge" defaultValue={special?.badge} placeholder="Sessions Special" />
        </FieldGrid>
        <TextArea label="Description" name="description" defaultValue={special?.description} />

        {/* Which packs the discount applies to */}
        <div className="rounded-lg border border-steel/60 bg-background/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-light-grey">
            Apply discount to session packs
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {SESSION_PACKS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="sessionPackQuantities"
                  value={p.value}
                  defaultChecked={selectedQtys.includes(String(p.value))}
                  className="size-4 accent-[var(--color-neon-green)]"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {/* Discount type + value */}
        <FieldGrid>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-light-grey">Discount type</span>
            <select
              name="sessionDiscountType"
              defaultValue={special?.sessionDiscountType ?? 'percent'}
              className="w-full rounded-md border border-steel bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-neon-blue"
            >
              <option value="percent">Percentage (%)</option>
              <option value="amount">Amount (R)</option>
            </select>
          </label>
          <TextField
            label="Discount value"
            name="sessionDiscountValue"
            type="number"
            defaultValue={String(special?.sessionDiscountValue ?? 0)}
            placeholder="20"
          />
        </FieldGrid>

        {/* Bonus sessions per pack (e.g. buy 30, get 6 extra = 36) */}
        <div className="rounded-lg border border-steel/60 bg-background/50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-light-grey">
            Bonus sessions (optional)
          </p>
          <p className="mb-3 text-xs leading-relaxed text-light-grey">
            Add extra free sessions to a pack — e.g. enter 6 on the 30 Pack so members get 36 sessions.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SESSION_PACKS.map((p) => (
              <TextField
                key={p.value}
                label={`${p.label} bonus`}
                name={`sessionBonus_${p.value}`}
                type="number"
                defaultValue={bonusMap[String(p.value)] ?? ''}
                placeholder="0"
              />
            ))}
          </div>
        </div>

        {/* Optional image — shows a "More info" button on the special when set */}
        <ImageField label="More-info image (optional)" name="imageUrl" defaultValue={special?.imageUrl} />

        <FieldGrid>
          <TextField label="Starts (optional)" name="startsAt" type="datetime-local" defaultValue={toLocalInput(special?.startsAt ?? null)} />
          <TextField label="Ends (optional)" name="endsAt" type="datetime-local" defaultValue={toLocalInput(special?.endsAt ?? null)} />
        </FieldGrid>
        <FieldGrid>
          <TextField label="Sort order" name="sortOrder" type="number" defaultValue={String(special?.sortOrder ?? 0)} />
          <div className="flex items-end pb-2">
            <CheckField label="Active (visible on site)" name="active" defaultChecked={special ? special.active : true} />
          </div>
        </FieldGrid>
      </AdminForm>
      {special ? (
        <form action={deleteSpecial} className="mt-3 border-t border-steel/60 pt-3">
          <input type="hidden" name="id" defaultValue={special.id} />
          <button type="submit" className={deleteBtn}>
            <Trash2 className="size-4" /> Delete
          </button>
        </form>
      ) : null}
    </div>
  )
}

function ChowForm({ winner, gender }: { winner?: ChowWinner; gender: 'Male' | 'Female' }) {
  const label = `${gender} Winner`
  const sortOrder = gender === 'Male' ? 1 : 2
  return (
    <div className={cardCls}>
      <AdminForm action={saveChowWinnerState} submitLabel={`Save ${label}`}>
        <input type="hidden" name="id" defaultValue={winner?.id ?? 0} />
        <input type="hidden" name="label" value={label} readOnly />
        <input type="hidden" name="active" value="true" readOnly />
        <input type="hidden" name="sortOrder" value={String(sortOrder)} readOnly />
        <p className="font-display text-sm font-bold uppercase tracking-widest text-neon-blue">{label}</p>
        <TextField label="Name" name="name" defaultValue={winner?.name} required placeholder={gender === 'Male' ? 'JD' : 'Nadia'} />
        <TextField label="Score" name="score" defaultValue={winner?.score} placeholder="221" />
      </AdminForm>
    </div>
  )
}

function MilestoneForm({ milestone }: { milestone?: SessionMilestone }) {
  return (
    <div className={cardCls}>
      <AdminForm action={saveSessionMilestoneState} submitLabel={milestone ? 'Save Changes' : 'Add Celebration'}>
        <input type="hidden" name="id" defaultValue={milestone?.id ?? 0} />
        <FieldGrid>
          <TextField label="Member name" name="name" defaultValue={milestone?.name} required placeholder="Sarah" />
          <TextField label="Sessions" name="sessions" type="number" defaultValue={String(milestone?.sessions ?? 100)} placeholder="100" />
        </FieldGrid>
        <ImageField label="Celebration photo" name="imageUrl" defaultValue={milestone?.imageUrl} />
        <CheckField label="Show on members page" name="active" defaultChecked={milestone ? milestone.active : true} />
      </AdminForm>
      {milestone ? (
        <form action={deleteSessionMilestone} className="mt-3 border-t border-steel/60 pt-3">
          <input type="hidden" name="id" defaultValue={milestone.id} />
          <button type="submit" className={deleteBtn}>
            <Trash2 className="size-4" /> Remove Celebration
          </button>
        </form>
      ) : null}
    </div>
  )
}

export function AdminDashboard({
  specials,
  winners,
  milestones,
  bookings,
  blockedDays,
  signups,
  chowChallenge,
  }: {
  specials: Special[]
  winners: ChowWinner[]
  milestones: SessionMilestone[]
  bookings: TrialBooking[]
  blockedDays: BlockedDay[]
  signups: MembershipSignup[]
  chowChallenge: string
  }) {
  const femaleWinner = winners.find((w) => w.label.toLowerCase().includes('female'))
  const maleWinner = winners.find((w) => !w.label.toLowerCase().includes('female'))
  const membershipSpecials = specials.filter((s) => s.kind !== 'sessions')
  const sessionSpecials = specials.filter((s) => s.kind === 'sessions')

  const [tab, setTab] = useState<TabKey>('bookings')

  const tabs: { key: TabKey; label: string; icon: typeof CalendarCheck }[] = [
    { key: 'bookings', label: 'Bookings', icon: CalendarCheck },
    { key: 'signups', label: 'Signups', icon: Users },
    { key: 'chow', label: 'CHOW', icon: Trophy },
    { key: 'celebration', label: 'Celebration', icon: Dumbbell },
    { key: 'specials', label: 'Specials', icon: Tag },
  ]

  return (
    <div className="mx-auto max-w-4xl px-5 pb-16 pt-32 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-light-grey">Manage trial bookings, signups and site content. Changes go live immediately.</p>
        </div>
        <form action={logout}>
          <button type="submit" className="rounded-md border border-steel px-4 py-2 text-sm font-semibold text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue">
            Log out
          </button>
        </form>
      </div>

      {/* Tab navigation — single row */}
      <div className="mt-8 flex gap-1 overflow-x-auto rounded-xl border border-steel bg-card p-1.5" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={
                'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors sm:text-sm ' +
                (active ? 'bg-neon-blue text-accent-foreground' : 'text-light-grey hover:bg-secondary hover:text-foreground')
              }
            >
              <Icon className="size-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1 — Trial Bookings */}
      {tab === 'bookings' && (
        <section className="mt-10" role="tabpanel">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-neon-blue" />
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">Trial Bookings</h2>
          </div>
          <p className="mt-1 text-sm text-light-grey">Every free-trial booking submitted from the site. Search, filter and delete.</p>
          <div className="mt-6">
            <TrialBookingsTable bookings={bookings} />
          </div>

          {/* Unavailable days — managed alongside bookings */}
          <div className="mt-12 border-t border-steel pt-10">
            <div className="flex items-center gap-2">
              <CalendarOff className="size-5 text-neon-blue" />
              <h3 className="font-display text-xl font-black uppercase tracking-tight">Unavailable Days</h3>
            </div>
            <p className="mt-1 text-sm text-light-grey">
              Mark public holidays or closed days. These dates are disabled on the booking calendar and show no time slots.
            </p>
            <div className="mt-6">
              <BlockedDaysManager days={blockedDays} />
            </div>
          </div>
        </section>
      )}

      {/* TAB — Membership Signups */}
      {tab === 'signups' && (
        <section className="mt-10" role="tabpanel">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-neon-blue" />
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">Membership Signups</h2>
          </div>
          <p className="mt-1 text-sm text-light-grey">
            Members who joined through the site. Expand a row for full details, update their status, or open the signed agreement PDF.
          </p>
          <div className="mt-6">
            <SignupsTable signups={signups} />
          </div>
        </section>
      )}

      {/* TAB — CHOW Winners */}
      {tab === 'chow' && (
      <div role="tabpanel">
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-neon-blue" />
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">CHOW Winners</h2>
        </div>
        <p className="mt-1 text-sm text-light-grey">
          Set this week&apos;s challenge and the two winners. They always show as one male and one female winner.
        </p>

        {/* Challenge of the week */}
        <div className={`mt-5 ${cardCls}`}>
          <AdminForm action={saveSettingState} submitLabel="Save Challenge">
            <input type="hidden" name="key" value="chow_challenge" readOnly />
            <TextField label="Challenge of the week" name="value" defaultValue={chowChallenge} placeholder="Jab - Cross - Uppercut" />
          </AdminForm>
        </div>

        {/* The two winners — side by side */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ChowForm winner={maleWinner} gender="Male" />
          <ChowForm winner={femaleWinner} gender="Female" />
        </div>
      </section>
      </div>
      )}

      {/* TAB — Session Celebration */}
      {tab === 'celebration' && (
      <div role="tabpanel">
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Dumbbell className="size-5 text-neon-green" />
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">Session Celebration</h2>
        </div>
        <p className="mt-1 text-sm text-light-grey">
          Celebrate 100 / 200 / 300 / 400 / 500 session milestones. Shows above the CHOW winners. Remove it when the week is done.
        </p>
        <div className="mt-5 flex flex-col gap-5">
          {milestones.map((m) => (
            <MilestoneForm key={m.id} milestone={m} />
          ))}
        </div>
        <details className="group mt-6">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-dashed border-neon-green/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-neon-green transition-colors hover:bg-neon-green/10">
            <Plus className="size-4" /> Add Celebration
          </summary>
          <div className="mt-4">
            <MilestoneForm />
          </div>
        </details>
      </section>
      </div>
      )}

      {/* TAB — Specials */}
      {tab === 'specials' && (
      <div role="tabpanel">
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Tag className="size-5 text-neon-blue" />
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">Specials</h2>
        </div>

        {/* Membership Specials */}
        <div className="mt-8">
          <h3 className="font-display text-lg font-black uppercase tracking-tight text-neon-green">
            Membership Specials
          </h3>
          <p className="mt-1 text-sm text-light-grey">
            Shown in the green-bordered banner above the membership finder. Can also discount selected memberships.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {membershipSpecials.length === 0 ? (
              <p className="text-sm text-light-grey">No membership specials yet. Add one below.</p>
            ) : (
              membershipSpecials.map((s) => <SpecialForm key={s.id} special={s} />)
            )}
          </div>
          <details className="group mt-6">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-dashed border-neon-blue/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-neon-blue transition-colors hover:bg-neon-blue/10">
              <Plus className="size-4" /> Add Membership Special
            </summary>
            <div className="mt-4">
              <SpecialForm />
            </div>
          </details>
        </div>

        {/* Sessions Specials */}
        <div className="mt-12 border-t border-steel pt-10">
          <h3 className="font-display text-lg font-black uppercase tracking-tight text-neon-green">
            Sessions Specials
          </h3>
          <p className="mt-1 text-sm text-light-grey">
            Shown above the pay-as-you-go session prices. Discount the Single, 10, 20 or 30 packs by a percentage or a rand amount.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {sessionSpecials.length === 0 ? (
              <p className="text-sm text-light-grey">No sessions specials yet. Add one below.</p>
            ) : (
              sessionSpecials.map((s) => <SessionSpecialForm key={s.id} special={s} />)
            )}
          </div>
          <details className="group mt-6">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-dashed border-neon-green/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-neon-green transition-colors hover:bg-neon-green/10">
              <Plus className="size-4" /> Add Sessions Special
            </summary>
            <div className="mt-4">
              <SessionSpecialForm />
            </div>
          </details>
        </div>
      </section>
      </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Trash2,
  FileText,
  Download,
  ChevronDown,
  ShoppingCart,
  User,
  CreditCard,
  Gift,
} from 'lucide-react'
import { deleteSessionPurchase, updateSessionPurchaseStatus } from '@/app/actions/admin'
import { formatRand } from '@/lib/memberships'
import type { SessionPurchase } from '@/lib/db/schema'

const STATUSES = ['New', 'Processed', 'Used', 'Cancelled'] as const

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-neon-blue/15 text-neon-blue',
  Processed: 'bg-amber-500/15 text-amber-400',
  Used: 'bg-neon-green/15 text-neon-green',
  Cancelled: 'bg-red-500/15 text-red-400',
}

const PAYMENT_STYLES: Record<string, string> = {
  Paid: 'bg-neon-green/15 text-neon-green',
  Pending: 'bg-amber-500/15 text-amber-400',
  Failed: 'bg-red-500/15 text-red-400',
  Cancelled: 'bg-steel/30 text-light-grey',
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  })
}

export function SessionPurchasesTable({ purchases }: { purchases: SessionPurchase[] }) {
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState<'all' | 'Paid' | 'Pending' | 'Failed'>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return purchases.filter((s) => {
      const matchesQuery =
        !q ||
        `${s.firstName} ${s.surname}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.contactNumber.toLowerCase().includes(q)
      const matchesPayment = payment === 'all' || s.paymentStatus === payment
      return matchesQuery && matchesPayment
    })
  }, [purchases, query, payment])

  const filters: { key: 'all' | 'Paid' | 'Pending' | 'Failed'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'Paid', label: 'Paid' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Failed', label: 'Failed' },
  ]

  const paidCount = purchases.filter((p) => p.paymentStatus === 'Paid').length
  const revenue = purchases.filter((p) => p.paymentStatus === 'Paid').reduce((sum, p) => sum + p.amount, 0)

  return (
    <div>
      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Paid Purchases" value={String(paidCount)} />
        <Stat label="Total Revenue" value={formatRand(revenue)} accent />
        <Stat label="All Records" value={String(purchases.length)} />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-light-grey" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone"
            className="w-full rounded-lg border border-steel bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-light-grey focus:border-neon-blue"
            aria-label="Search purchases"
          />
        </div>
        <div className="flex flex-wrap rounded-lg border border-steel bg-card p-1 text-xs font-semibold uppercase tracking-wide">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setPayment(f.key)}
              className={
                'rounded-md px-3 py-1.5 transition-colors ' +
                (payment === f.key ? 'bg-neon-blue text-accent-foreground' : 'text-light-grey hover:text-foreground')
              }
              aria-pressed={payment === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs uppercase tracking-wide text-light-grey">
        {filtered.length} {filtered.length === 1 ? 'purchase' : 'purchases'}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-steel p-10 text-center text-sm text-light-grey">
          No purchases found.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {filtered.map((s) => {
            const open = openId === s.id
            const name = `${s.firstName} ${s.surname}`
            return (
              <div key={s.id} className="overflow-hidden rounded-2xl border border-steel bg-card">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : s.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                    aria-expanded={open}
                  >
                    <ChevronDown
                      className={'size-4 shrink-0 text-light-grey transition-transform ' + (open ? 'rotate-180' : '')}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold text-foreground">{name}</p>
                      <p className="truncate text-xs text-light-grey">
                        {s.unitLabel} · {s.totalSessions} sessions · {formatRand(s.amount)}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <span
                      className={
                        'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ' +
                        (PAYMENT_STYLES[s.paymentStatus] ?? 'bg-steel/30 text-light-grey')
                      }
                    >
                      {s.paymentStatus}
                    </span>
                    <span
                      className={
                        'hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline ' +
                        (STATUS_STYLES[s.status] ?? 'bg-steel/30 text-light-grey')
                      }
                    >
                      {s.status}
                    </span>
                    <span className="hidden text-xs text-light-grey sm:inline">{fmtDate(s.createdAt)}</span>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-steel/60 bg-charcoal/40 p-4 sm:p-6">
                    <div className="grid gap-6 md:grid-cols-3">
                      {/* Member */}
                      <div>
                        <h4 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-blue">
                          <User className="size-3.5" /> Member
                        </h4>
                        <dl className="mt-3 space-y-1.5 text-sm">
                          <Row label="Name" value={name} />
                          <Row label="ID Number" value={s.idNumber} />
                          <RowLink label="Email" value={s.email} href={`mailto:${s.email}`} />
                          <RowLink label="Contact" value={s.contactNumber} href={`tel:${s.contactNumber}`} />
                          <Row label="Emergency" value={`${s.emergencyContactName} (${s.emergencyContactNumber})`} />
                        </dl>
                      </div>

                      {/* Purchase */}
                      <div>
                        <h4 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-blue">
                          <ShoppingCart className="size-3.5" /> Purchase
                        </h4>
                        <dl className="mt-3 space-y-1.5 text-sm">
                          <Row label="Pack" value={s.unitLabel} />
                          <Row label="Paid Sessions" value={String(s.packQuantity)} />
                          {s.bonusSessions > 0 && <Row label="Bonus" value={`+${s.bonusSessions} free`} />}
                          <Row label="Total Sessions" value={String(s.totalSessions)} />
                          {s.specialTitle && <Row label="Special" value={s.specialTitle} />}
                        </dl>
                      </div>

                      {/* Payment */}
                      <div>
                        <h4 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-blue">
                          <CreditCard className="size-3.5" /> Payment
                        </h4>
                        <dl className="mt-3 space-y-1.5 text-sm">
                          {s.baseAmount > s.amount && <Row label="Standard" value={formatRand(s.baseAmount)} />}
                          <Row label="Amount Paid" value={formatRand(s.amount)} />
                          <Row label="Status" value={s.paymentStatus} />
                          <Row label="Method" value="PayFast" />
                          {s.pfPaymentId && <Row label="PayFast ID" value={s.pfPaymentId} />}
                          {s.paidAt && <Row label="Paid On" value={fmtDate(s.paidAt)} />}
                        </dl>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex flex-col gap-3 border-t border-steel/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/admin/sessions/${s.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-cobalt px-3 py-2 text-xs font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:bg-neon-blue"
                        >
                          <FileText className="size-4" /> View Receipt
                        </a>
                        <a
                          href={`/admin/sessions/${s.id}/pdf?download=1`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-2 text-xs font-bold uppercase tracking-wide text-foreground transition-colors hover:border-neon-blue hover:text-neon-blue"
                        >
                          <Download className="size-4" /> Download PDF
                        </a>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusForm id={s.id} current={s.status} />
                        <DeleteButton id={s.id} name={name} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-steel bg-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-light-grey">{label}</p>
      <p className={'mt-1 font-display text-xl font-black ' + (accent ? 'text-neon-green' : 'text-foreground')}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-light-grey">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

function RowLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-light-grey">{label}</dt>
      <dd className="truncate text-right">
        <a href={href} className="font-medium text-foreground hover:text-neon-blue">
          {value || '—'}
        </a>
      </dd>
    </div>
  )
}

function StatusForm({ id, current }: { id: number; current: string }) {
  return (
    <form action={updateSessionPurchaseStatus} className="flex items-center">
      <input type="hidden" name="id" defaultValue={id} />
      <select
        key={current}
        name="status"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-steel bg-card px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-foreground outline-none transition-colors hover:border-neon-blue focus:border-neon-blue"
        aria-label="Update status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  )
}

function DeleteButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteSessionPurchase}
      onSubmit={(e) => {
        if (!confirm(`Delete the session purchase for ${name}? This cannot be undone.`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" defaultValue={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-2 text-xs font-semibold text-light-grey transition-colors hover:border-red-500 hover:text-red-400"
        aria-label={`Delete purchase for ${name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Trash2,
  FileText,
  Download,
  Mail,
  Phone,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  User,
} from 'lucide-react'
import { deleteSignup, updateSignupStatus } from '@/app/actions/admin'
import { formatRand } from '@/lib/memberships'
import type { MembershipSignup } from '@/lib/db/schema'

const STATUSES = ['New', 'Processed', 'Active', 'Cancelled'] as const

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-neon-blue/15 text-neon-blue',
  Processed: 'bg-amber-500/15 text-amber-400',
  Active: 'bg-neon-green/15 text-neon-green',
  Cancelled: 'bg-red-500/15 text-red-400',
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  })
}

export function SignupsTable({ signups }: { signups: MembershipSignup[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | (typeof STATUSES)[number]>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return signups.filter((s) => {
      const matchesQuery =
        !q ||
        `${s.firstName} ${s.surname}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.contactNumber.toLowerCase().includes(q)
      const matchesStatus = status === 'all' || s.status === status
      return matchesQuery && matchesStatus
    })
  }, [signups, query, status])

  const filters: { key: 'all' | (typeof STATUSES)[number]; label: string }[] = [
    { key: 'all', label: 'All' },
    ...STATUSES.map((s) => ({ key: s, label: s })),
  ]

  return (
    <div>
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
            aria-label="Search signups"
          />
        </div>
        <div className="flex flex-wrap rounded-lg border border-steel bg-card p-1 text-xs font-semibold uppercase tracking-wide">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={
                'rounded-md px-3 py-1.5 transition-colors ' +
                (status === f.key ? 'bg-neon-blue text-accent-foreground' : 'text-light-grey hover:text-foreground')
              }
              aria-pressed={status === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs uppercase tracking-wide text-light-grey">
        {filtered.length} {filtered.length === 1 ? 'signup' : 'signups'}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-steel p-10 text-center text-sm text-light-grey">
          No signups found.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {filtered.map((s) => {
            const open = openId === s.id
            const name = `${s.firstName} ${s.surname}`
            return (
              <div key={s.id} className="overflow-hidden rounded-2xl border border-steel bg-card">
                {/* Summary row */}
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
                        {s.membershipType} · {s.accessType} · {s.contractLength} mo · {formatRand(s.monthlyFee)}/mo
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <span
                      className={
                        'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ' +
                        (STATUS_STYLES[s.status] ?? 'bg-steel/30 text-light-grey')
                      }
                    >
                      {s.status}
                    </span>
                    <span className="hidden text-xs text-light-grey sm:inline">{fmtDate(s.createdAt)}</span>
                  </div>
                </div>

                {/* Expanded detail */}
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

                      {/* Membership */}
                      <div>
                        <h4 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-blue">
                          <ShieldCheck className="size-3.5" /> Membership
                        </h4>
                        <dl className="mt-3 space-y-1.5 text-sm">
                          <Row label="Tier" value={s.membershipType} />
                          <Row label="Plan" value={s.accessType} />
                          <Row label="Contract" value={`${s.contractLength} months`} />
                          <Row label="Monthly" value={`${formatRand(s.monthlyFee)}`} />
                          <Row label="Total Value" value={`${formatRand(s.totalContractValue)}`} />
                        </dl>
                      </div>

                      {/* Payment */}
                      <div>
                        <h4 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-blue">
                          <CreditCard className="size-3.5" /> Payment
                        </h4>
                        <dl className="mt-3 space-y-1.5 text-sm">
                          <Row label="Method" value={s.paymentMethod === 'cash' ? 'Cash (in advance)' : 'Debit Order'} />
                          <Row label="Payer" value={s.payerType === 'other' ? 'Other account holder' : 'Member'} />
                          {s.payerType === 'other' && (
                            <Row label="Holder" value={`${s.accountHolderName} (${s.accountHolderId})`} />
                          )}
                          {s.paymentMethod === 'debit' && (
                            <>
                              <Row label="Debit Date" value={s.debitOrderDate === 'last' ? 'Last day' : '1st'} />
                              <Row label="Bank" value={s.bankName} />
                              <Row label="Branch" value={`${s.branchName} (${s.branchCode})`} />
                              <Row label="Acc Type" value={s.bankAccountType} />
                              <Row label="Acc No." value={s.accountNumber} />
                              <Row label="Acc Holder" value={s.bankAccountHolder} />
                            </>
                          )}
                        </dl>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex flex-col gap-3 border-t border-steel/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/admin/signups/${s.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-cobalt px-3 py-2 text-xs font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:bg-neon-blue"
                        >
                          <FileText className="size-4" /> View Agreement
                        </a>
                        <a
                          href={`/admin/signups/${s.id}/pdf?download=1`}
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
    <form action={updateSignupStatus} className="flex items-center">
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
      action={deleteSignup}
      onSubmit={(e) => {
        if (!confirm(`Delete the signup for ${name}? This cannot be undone.`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" defaultValue={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-2 text-xs font-semibold text-light-grey transition-colors hover:border-red-500 hover:text-red-400"
        aria-label={`Delete signup for ${name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  )
}

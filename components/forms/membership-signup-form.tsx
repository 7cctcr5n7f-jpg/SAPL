'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import {
  User,
  CreditCard,
  FileSignature,
  ScrollText,
  PenTool,
  Loader2,
  ArrowRight,
  RefreshCw,
  Check,
  ChevronDown,
  ShieldCheck,
  Banknote,
  Download,
  Info,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRand } from '@/lib/memberships'
import {
  AGREEMENT_SECTIONS,
  REQUIRED_AGREEMENTS,
  MANDATE_TEXT,
  MANDATE_CONSENT,
  LEGAL_NOTICE,
  DEBIT_ORDER_SHORTNAME,
} from '@/lib/membership-agreement'
import { SignaturePad } from '@/components/forms/signature-pad'
import { submitMembershipSignup, type SignupState } from '@/app/actions/membership'
import { SuccessScreen } from '@/components/forms/membership-success'

export type Selection = {
  membershipId: string
  membershipType: string
  accessType: string
  contractLength: number
  monthlyFee: number
  totalContractValue: number
  perMember: boolean
  // Savings vs the entry-level 3-month rate (used to motivate, instead of
  // showing the full contract value).
  baselineMonthly: number
  commitmentSaving: number // per month, from a longer commitment
  discountSaving: number // per month, from an active promo discount
  monthlySaving: number // per month, total
  totalSaving: number // across the full contract
  discountPercent: number
}

const initialState: SignupState = { ok: false }

export function MembershipSignupForm({ selection }: { selection: Selection }) {
  const [state, formAction, pending] = useActionState(submitMembershipSignup, initialState)

  // Member details
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [emName, setEmName] = useState('')
  const [emNumber, setEmNumber] = useState('')

  // Payment
  const [payerType, setPayerType] = useState<'member' | 'other'>('member')
  const [ahName, setAhName] = useState('')
  const [ahId, setAhId] = useState('')
  const [ahContact, setAhContact] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'cash'>('debit')
  const [debitDate, setDebitDate] = useState('')
  const [accountType, setAccountType] = useState('')
  const [bankName, setBankName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  // Agreements + signature
  const [mandate, setMandate] = useState(false)
  const [agree, setAgree] = useState<Record<string, boolean>>({})
  const [signature, setSignature] = useState('')

  const formRef = useRef<HTMLFormElement>(null)
  // Tracks whether the member has attempted to submit, so we can reveal a
  // helpful checklist of what's still outstanding instead of silently blocking.
  const [attempted, setAttempted] = useState(false)
  const isDebit = paymentMethod === 'debit'
  const isOther = payerType === 'other'

  // Build a human-readable list of everything still required.
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  const missing: string[] = []
  if (!firstName.trim()) missing.push('First name')
  if (!surname.trim()) missing.push('Surname')
  if (!email.trim()) missing.push('Email address')
  else if (!emailValid) missing.push('A valid email address')
  if (!contactNumber.trim()) missing.push('Contact number')
  if (!idNumber.trim()) missing.push('ID number')
  if (!emName.trim()) missing.push('Emergency contact name')
  if (!emNumber.trim()) missing.push('Emergency contact number')
  if (isOther) {
    if (!ahName.trim()) missing.push('Account holder full name')
    if (!ahId.trim()) missing.push('Account holder ID number')
    if (!ahContact.trim()) missing.push('Account holder contact number')
  }
  if (isDebit) {
    if (!debitDate.trim()) missing.push('Debit order date')
    if (!accountType.trim()) missing.push('Type of account')
    if (!bankName.trim()) missing.push('Bank name')
    if (!accountNumber.trim()) missing.push('Account number')
    if (!bankHolder.trim()) missing.push('Account holder name')
    if (!mandate) missing.push('Accept the Debit Order Authority & Mandate')
  }
  for (const a of REQUIRED_AGREEMENTS) {
    if (!agree[a.id]) missing.push(`Accept: ${a.title}`)
  }
  if (signature === '') missing.push('Your digital signature')

  const isComplete = missing.length === 0

  const signedDate = new Date().toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  })

  if (state.ok) {
    return <SuccessScreen firstName={firstName} />
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (!isComplete) {
          e.preventDefault()
          setAttempted(true)
          // Bring the checklist into view.
          requestAnimationFrame(() => {
            document.getElementById('signup-missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
        }
      }}
      className="space-y-6"
    >
      {/* hidden selection + signature payload */}
      <input type="hidden" name="membershipId" value={selection.membershipId} />
      <input type="hidden" name="membershipType" value={selection.membershipType} />
      <input type="hidden" name="accessType" value={selection.accessType} />
      <input type="hidden" name="contractLength" value={selection.contractLength} />
      <input type="hidden" name="monthlyFee" value={selection.monthlyFee} />
      <input type="hidden" name="signature" value={signature} />
      <input type="hidden" name="payerType" value={payerType} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="debitOrderDate" value={isDebit ? debitDate : ''} />
      <input type="hidden" name="bankAccountType" value={isDebit ? accountType : ''} />
      <input type="hidden" name="mandateAccepted" value={mandate ? 'true' : 'false'} />
      {REQUIRED_AGREEMENTS.map((a) => (
        <input key={a.id} type="hidden" name={a.id} value={agree[a.id] ? 'true' : 'false'} />
      ))}

      {/* ── SUMMARY CARD ── */}
      <SummaryCard selection={selection} />

      {/* ── SECTION 1: MEMBER DETAILS ── */}
      <SectionCard n={1} icon={User} title="Member Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name" name="firstName" value={firstName} onChange={setFirstName} autoComplete="given-name" placeholder="Thando" />
          <Field label="Surname" name="surname" value={surname} onChange={setSurname} autoComplete="family-name" placeholder="Mokoena" />
          <Field label="Email Address" name="email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@email.com" />
          <Field label="Contact Number" name="contactNumber" type="tel" value={contactNumber} onChange={setContactNumber} autoComplete="tel" placeholder="+27 00 000 0000" />
          <Field label="ID Number" name="idNumber" value={idNumber} onChange={setIdNumber} placeholder="ID / passport number" />
          <div className="hidden sm:block" />
          <Field label="Emergency Contact Name" name="emergencyContactName" value={emName} onChange={setEmName} placeholder="Full name" />
          <Field label="Emergency Contact Number" name="emergencyContactNumber" type="tel" value={emNumber} onChange={setEmNumber} placeholder="+27 00 000 0000" />
        </div>
      </SectionCard>

      {/* ── SECTION 2: PAYMENT DETAILS ── */}
      <SectionCard n={2} icon={CreditCard} title="Payment Details">
        {/* Responsible party */}
        <Question label="Who is responsible for payment?">
          <ChoiceRow
            options={[
              { value: 'member', label: 'Member' },
              { value: 'other', label: 'Different Account Holder' },
            ]}
            value={payerType}
            onChange={(v) => setPayerType(v as 'member' | 'other')}
          />
        </Question>

        {isOther ? (
          <div className="mt-4 grid gap-4 rounded-xl border border-steel/70 bg-background/50 p-4 sm:grid-cols-2">
            <Field label="Account Holder Full Name" name="accountHolderName" value={ahName} onChange={setAhName} placeholder="Full name" />
            <Field label="Account Holder ID Number" name="accountHolderId" value={ahId} onChange={setAhId} placeholder="ID number" />
            <Field label="Contact Number" name="accountHolderContact" type="tel" value={ahContact} onChange={setAhContact} placeholder="+27 00 000 0000" className="sm:col-span-2" />
          </div>
        ) : null}

        {/* Payment method */}
        <Question label="Payment method" className="mt-6">
          <ChoiceRow
            options={[
              { value: 'debit', label: 'Debit Order' },
              { value: 'cash', label: 'Cash' },
            ]}
            value={paymentMethod}
            onChange={(v) => setPaymentMethod(v as 'debit' | 'cash')}
          />
        </Question>

        {!isDebit ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border-2 border-neon-green/60 bg-neon-green/10 p-4 green-glow">
            <Info className="mt-0.5 size-5 shrink-0 text-neon-green" />
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-bold text-neon-green">Cash memberships must be paid in advance for the full contract duration.</span>{' '}
              Monthly cash payments are not permitted.
            </p>
          </div>
        ) : (
          <>
            <Question label="Debit order date" className="mt-6">
              <ChoiceRow
                options={[
                  { value: '1st', label: '1st Of Month' },
                  { value: 'last', label: 'Last Day Of Month' },
                ]}
                value={debitDate}
                onChange={setDebitDate}
              />
            </Question>

            <Question label="Type of account" className="mt-6">
              <ChoiceRow
                options={[
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'savings', label: 'Savings' },
                ]}
                value={accountType}
                onChange={setAccountType}
              />
            </Question>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-light-grey">
                <Banknote className="size-4 text-neon-blue" /> Banking Details
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bank Name" name="bankName" value={bankName} onChange={setBankName} placeholder="e.g. FNB" />
                <Field label="Branch Name" name="branchName" value={branchName} onChange={setBranchName} placeholder="Branch" optional />
                <Field label="Branch Code" name="branchCode" value={branchCode} onChange={setBranchCode} placeholder="250655" optional />
                <Field label="Account Number" name="accountNumber" value={accountNumber} onChange={setAccountNumber} placeholder="Account number" />
                <Field label="Account Holder Name" name="bankAccountHolder" value={bankHolder} onChange={setBankHolder} placeholder="As per bank records" className="sm:col-span-2" />
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* ── SECTION 3: AUTHORITY & MANDATE (debit order only) ── */}
      {isDebit ? (
        <SectionCard n={3} icon={FileSignature} title="Authority & Mandate">
          <details className="group rounded-xl border border-steel bg-background/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
              <span className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
                <ScrollText className="size-4 text-neon-blue" /> Debit Order Authority &amp; Mandate
              </span>
              <ChevronDown className="size-4 shrink-0 text-light-grey transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-steel/60 px-4 py-4">
              <p className="mb-3 inline-flex rounded-md bg-cobalt/15 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide text-neon-blue">
                Short name: {DEBIT_ORDER_SHORTNAME}
              </p>
              <div className="max-h-64 overflow-y-auto whitespace-pre-line pr-2 text-xs leading-relaxed text-light-grey">
                {MANDATE_TEXT}
              </div>
            </div>
          </details>
          <label
            className={cn(
              'mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
              mandate ? 'border-neon-blue/60 bg-cobalt/5' : 'border-steel bg-background',
            )}
          >
            <input
              type="checkbox"
              checked={mandate}
              onChange={(e) => setMandate(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-neon-blue)]"
            />
            <span className="text-sm font-medium text-foreground">{MANDATE_CONSENT}</span>
          </label>
        </SectionCard>
      ) : null}

      {/* ── SECTION 4: MEMBERSHIP TERMS ── */}
      <SectionCard n={isDebit ? 4 : 3} icon={ScrollText} title="Membership Terms">
        <a
          href="/api/membership-agreement"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-xl border border-steel bg-background/50 px-4 py-3.5 transition-colors hover:border-neon-blue/60"
        >
          <span className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
            <Download className="size-4 text-neon-blue" /> View Full TENROUNDS Membership Agreement
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-neon-blue">PDF</span>
        </a>

        <details className="group mt-4 rounded-xl border border-steel bg-background/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Read Agreement Summary
            </span>
            <ChevronDown className="size-4 shrink-0 text-light-grey transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-72 space-y-4 overflow-y-auto border-t border-steel/60 px-4 py-4">
            {AGREEMENT_SECTIONS.map((s) => (
              <div key={s.heading}>
                <p className="font-display text-xs font-bold uppercase tracking-wide text-neon-blue">{s.heading}</p>
                <p className="mt-1 text-xs leading-relaxed text-light-grey">{s.body}</p>
              </div>
            ))}
          </div>
        </details>

        {/* required agreement checkboxes */}
        <div className="mt-4 space-y-3">
          {REQUIRED_AGREEMENTS.map((a) => (
            <label
              key={a.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                agree[a.id] ? 'border-neon-blue/60 bg-cobalt/5' : 'border-steel bg-background',
              )}
            >
              <input
                type="checkbox"
                checked={!!agree[a.id]}
                onChange={(e) => setAgree((p) => ({ ...p, [a.id]: e.target.checked }))}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-neon-blue)]"
              />
              <span>
                <span className="block font-display text-sm font-bold uppercase tracking-wide text-foreground">{a.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-light-grey">{a.body}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-steel/70 bg-background/40 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-light-grey" />
          <p className="text-xs leading-relaxed text-light-grey">{LEGAL_NOTICE}</p>
        </div>
      </SectionCard>

      {/* ── SECTION 5: DIGITAL SIGNATURE ── */}
      <SectionCard n={isDebit ? 5 : 4} icon={PenTool} title="Digital Signature">
        <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-grey">Member Signature</p>
            <SignaturePad onChange={setSignature} />
          </div>
          <div className="rounded-xl border border-steel bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-light-grey">Date Signed</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">{signedDate}</p>
            <p className="mt-3 text-xs leading-relaxed text-light-grey">
              Signing confirms that all the information provided is accurate and that you accept the membership agreement.
            </p>
          </div>
        </div>
      </SectionCard>

      {state.error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>
      ) : null}

      {/* Outstanding-items checklist — shown after an attempted submit */}
      {attempted && !isComplete ? (
        <div
          id="signup-missing"
          role="alert"
          className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-5"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0 text-amber-400" />
            <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Just {missing.length} {missing.length === 1 ? 'thing' : 'things'} left to finish
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {missing.map((m) => (
              <li key={m} className="flex items-start gap-2 text-sm text-light-grey">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-disabled={!isComplete}
        className="group flex w-full items-center justify-center gap-2 rounded-md bg-cobalt px-6 py-4 font-display text-base font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" /> Completing…
          </>
        ) : (
          <>
            Complete My Membership
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
      {!isComplete && !pending && !attempted ? (
        <p className="text-center text-xs text-light-grey">
          Complete all required fields, accept the agreements and sign to continue.
        </p>
      ) : null}
    </form>
  )
}

/* ── Summary card ── */
function SummaryCard({ selection }: { selection: Selection }) {
  const rows = [
    { label: 'Membership Type', value: selection.membershipType },
    { label: 'Access Type', value: selection.accessType },
    { label: 'Contract Length', value: `${selection.contractLength} Months` },
    { label: 'Monthly Fee', value: `${formatRand(selection.monthlyFee)}${selection.perMember ? ' / member' : ''}` },
  ]
  return (
    <div className="glass overflow-hidden rounded-2xl border border-neon-blue/40 blue-glow">
      <div className="flex items-center justify-between gap-3 border-b border-steel/60 bg-cobalt/10 px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-blue px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-background">
          <Check className="size-3.5" /> Selected Membership
        </span>
        <Link
          href="/memberships"
          className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
        >
          <RefreshCw className="size-3.5" /> Change Membership
        </Link>
      </div>
      <div className="grid gap-px bg-steel/30 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="bg-card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-light-grey">{r.label}</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">{r.value}</p>
          </div>
        ))}
      </div>
      {selection.totalSaving > 0 ? (
        <div className="bg-neon-green/10 px-5 py-4 ring-1 ring-inset ring-neon-green/40">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-neon-green">You&apos;re Saving</p>
            <p className="font-display text-2xl font-black tracking-tight text-foreground text-glow">
              {formatRand(selection.totalSaving)}
              {selection.perMember ? <span className="ml-1 text-sm font-semibold text-light-grey">/ member</span> : null}
            </p>
          </div>
          <p className="mt-0.5 text-right text-xs text-light-grey">
            over your {selection.contractLength}-month term — {formatRand(selection.monthlySaving)}/mo vs the{' '}
            {formatRand(selection.baselineMonthly)} 3-month rate
          </p>
          {selection.commitmentSaving > 0 && selection.discountSaving > 0 ? (
            <div className="mt-3 space-y-1.5 border-t border-neon-green/20 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-grey">Longer-commitment saving</span>
                <span className="font-semibold text-foreground">{formatRand(selection.commitmentSaving)}/mo</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-grey">
                  Member discount{selection.discountPercent ? ` (${selection.discountPercent}%)` : ''}
                </span>
                <span className="font-semibold text-foreground">{formatRand(selection.discountSaving)}/mo</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 bg-neon-green/10 px-5 py-4 ring-1 ring-inset ring-neon-green/40">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-neon-green">Your Monthly Rate</p>
          <p className="font-display text-2xl font-black tracking-tight text-foreground text-glow">
            {formatRand(selection.monthlyFee)}
            <span className="ml-1 text-sm font-semibold text-light-grey">/ mo{selection.perMember ? ' / member' : ''}</span>
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Layout + field primitives ── */
function SectionCard({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-steel bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-cobalt font-display text-sm font-bold text-accent-foreground">
          {n}
        </span>
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-tight text-foreground">
          <Icon className="size-5 text-neon-blue" />
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
  autoComplete,
  name,
  optional = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  className?: string
  autoComplete?: string
  name?: string
  optional?: boolean
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey">
        {label}
        {optional ? <span className="ml-1 normal-case text-steel">(optional)</span> : null}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-steel bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-steel focus:border-neon-blue"
      />
    </div>
  )
}

function Question({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-light-grey">{label}</p>
      {children}
    </div>
  )
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all',
              active ? 'border-neon-blue bg-cobalt/10 text-foreground blue-glow' : 'border-steel bg-background text-light-grey hover:border-neon-blue/60',
            )}
          >
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                active ? 'border-neon-blue bg-neon-blue' : 'border-steel',
              )}
            >
              {active ? <span className="size-1.5 rounded-full bg-background" /> : null}
            </span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

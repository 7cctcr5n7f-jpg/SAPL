'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  User,
  ScrollText,
  PenTool,
  Loader2,
  ArrowRight,
  Check,
  ChevronDown,
  ShieldCheck,
  Gift,
  Flame,
  Lock,
  RefreshCw,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRand } from '@/lib/memberships'
import { AGREEMENT_SECTIONS, REQUIRED_AGREEMENTS, LEGAL_NOTICE } from '@/lib/membership-agreement'
import { SignaturePad } from '@/components/forms/signature-pad'
import { startSessionPurchase, type BuyState } from '@/app/actions/buy-sessions'

export type PackSelection = {
  quantity: number
  unitLabel: string
  baseAmount: number
  amount: number
  bonusSessions: number
  totalSessions: number
  specialTitle: string
}

const initialState: BuyState = { ok: false }

export function BuySessionsForm({ pack }: { pack: PackSelection }) {
  const [state, formAction, pending] = useActionState(startSessionPurchase, initialState)

  // Member details
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [emName, setEmName] = useState('')
  const [emNumber, setEmNumber] = useState('')

  // Agreements + signature
  const [agree, setAgree] = useState<Record<string, boolean>>({})
  const [signature, setSignature] = useState('')

  const [attempted, setAttempted] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const payfastFormRef = useRef<HTMLFormElement>(null)

  // When the server returns PayFast fields, auto-submit to PayFast.
  useEffect(() => {
    if (state.ok && state.payfast && payfastFormRef.current) {
      setRedirecting(true)
      payfastFormRef.current.submit()
    }
  }, [state])

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

  if (redirecting || (state.ok && state.payfast)) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-10 text-center blue-glow">
        <Loader2 className="size-8 animate-spin text-neon-blue" />
        <h2 className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-foreground">
          Redirecting to secure checkout…
        </h2>
        <p className="mt-2 text-sm text-light-grey">
          Taking you to PayFast to complete your payment safely. Please don&apos;t close this tab.
        </p>
        {/* Hidden auto-submitting form to PayFast */}
        {state.payfast ? (
          <form ref={payfastFormRef} action={state.payfast.url} method="post" className="hidden">
            {Object.entries(state.payfast.fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>
        ) : null}
      </div>
    )
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!isComplete) {
          e.preventDefault()
          setAttempted(true)
          requestAnimationFrame(() => {
            document.getElementById('buy-missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
        }
      }}
      className="space-y-6"
    >
      {/* hidden payload */}
      <input type="hidden" name="packQuantity" value={pack.quantity} />
      <input type="hidden" name="signature" value={signature} />
      {REQUIRED_AGREEMENTS.map((a) => (
        <input key={a.id} type="hidden" name={a.id} value={agree[a.id] ? 'true' : 'false'} />
      ))}

      {/* ── SUMMARY CARD ── */}
      <PackSummary pack={pack} />

      {/* ── SECTION 1: MEMBER DETAILS ── */}
      <SectionCard n={1} icon={User} title="Your Details">
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

      {/* ── SECTION 2: TERMS ── */}
      <SectionCard n={2} icon={ScrollText} title="Terms & Conditions">
        <a
          href="/api/membership-agreement"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-xl border border-steel bg-background/50 px-4 py-3.5 transition-colors hover:border-neon-blue/60"
        >
          <span className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
            <ScrollText className="size-4 text-neon-blue" /> View Full TENROUNDS Terms
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-neon-blue">PDF</span>
        </a>

        <details className="group mt-4 rounded-xl border border-steel bg-background/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Read Terms Summary
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

      {/* ── SECTION 3: SIGNATURE ── */}
      <SectionCard n={3} icon={PenTool} title="Digital Signature">
        <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-grey">Your Signature</p>
            <SignaturePad onChange={setSignature} />
          </div>
          <div className="rounded-xl border border-steel bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-light-grey">Date Signed</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">{signedDate}</p>
            <p className="mt-3 text-xs leading-relaxed text-light-grey">
              Signing confirms that the information provided is accurate and that you accept the TENROUNDS terms.
            </p>
          </div>
        </div>
      </SectionCard>

      {state.error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>
      ) : null}

      {attempted && !isComplete ? (
        <div id="buy-missing" role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-5">
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
            <Loader2 className="size-5 animate-spin" /> Starting checkout…
          </>
        ) : (
          <>
            <Lock className="size-5" /> Pay {formatRand(pack.amount)} Securely
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
      <p className="flex items-center justify-center gap-2 text-center text-xs text-light-grey">
        <ShieldCheck className="size-3.5 text-neon-green" />
        Payments are processed securely by PayFast. We never see your card details.
      </p>
    </form>
  )
}

/* ── Pack summary card ── */
function PackSummary({ pack }: { pack: PackSelection }) {
  const hasBonus = pack.bonusSessions > 0
  const hasDiscount = pack.baseAmount > pack.amount
  return (
    <div className="glass overflow-hidden rounded-2xl border border-neon-blue/40 blue-glow">
      <div className="flex items-center justify-between gap-3 border-b border-steel/60 bg-cobalt/10 px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-blue px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-background">
          <ShoppingCart className="size-3.5" /> Your Session Pack
        </span>
        <Link
          href="/memberships#sessions"
          className="inline-flex items-center gap-1.5 rounded-md border border-steel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-light-grey transition-colors hover:border-neon-blue hover:text-neon-blue"
        >
          <RefreshCw className="size-3.5" /> Change Pack
        </Link>
      </div>
      <div className="grid gap-px bg-steel/30 sm:grid-cols-2">
        <div className="bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-light-grey">Pack</p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">{pack.unitLabel}</p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-light-grey">Sessions</p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {hasBonus ? (
              <span className="inline-flex items-center gap-1.5 text-neon-green">
                <Gift className="size-4" />
                {pack.quantity} + {pack.bonusSessions} = {pack.totalSessions}
              </span>
            ) : (
              `${pack.quantity} session${pack.quantity === 1 ? '' : 's'}`
            )}
          </p>
        </div>
      </div>
      {pack.specialTitle ? (
        <div className="flex items-center gap-2 bg-neon-green/10 px-5 py-2.5 ring-1 ring-inset ring-neon-green/30">
          <Flame className="size-4 shrink-0 text-neon-green" />
          <p className="text-xs font-semibold uppercase tracking-wide text-neon-green">{pack.specialTitle}</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 bg-neon-green/10 px-5 py-4 ring-1 ring-inset ring-neon-green/40">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-neon-green">Total To Pay</p>
        <p className="font-display text-2xl font-black tracking-tight text-foreground text-glow">
          {hasDiscount ? (
            <span className="mr-2 align-middle font-display text-base font-bold text-light-grey line-through">
              {formatRand(pack.baseAmount)}
            </span>
          ) : null}
          {formatRand(pack.amount)}
        </p>
      </div>
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  className?: string
  autoComplete?: string
  name?: string
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey">{label}</label>
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

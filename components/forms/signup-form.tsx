'use client'

import { useState } from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { accessTiers, contractLengths } from '@/lib/memberships'
import { business } from '@/lib/business'

export function SignupForm() {
  const [submitted, setSubmitted] = useState(false)
  const [tierId, setTierId] = useState(accessTiers[0].id)

  const tier = accessTiers.find((t) => t.id === tierId)!

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-10 text-center blue-glow">
        <CheckCircle2 className="size-12 text-neon-blue" />
        <h3 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight">
          Welcome To TENROUNDS.
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-light-grey">
          Thanks for signing up. Our team will confirm your membership and onboarding
          session details shortly. Get ready to train.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
      }}
      className="rounded-2xl border border-steel bg-card p-6 sm:p-8"
    >
      <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight">
        Join TENROUNDS
      </h3>
      <p className="mt-1 text-sm text-light-grey">
        Complete the form and our team will finalise your membership.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" placeholder="Thando" />
        <Field label="Last name" name="lastName" placeholder="Mokoena" />
        <Field label="Email" name="email" type="email" placeholder="you@email.com" className="sm:col-span-2" />
        <Field label="Mobile number" name="phone" type="tel" placeholder={business.phoneDisplay} className="sm:col-span-2" />

        <Select
          label="Access type"
          name="access"
          value={tierId}
          onChange={(v) => setTierId(v as typeof tierId)}
          options={accessTiers.map((t) => ({ value: t.id, label: t.name }))}
          className="sm:col-span-2"
        />
        <Select
          label="Membership"
          name="membership"
          options={tier.memberships.map((m) => ({ value: m.id, label: m.name }))}
          className="sm:col-span-2"
        />
        <Select
          label="Contract length"
          name="contract"
          options={contractLengths.map((c) => ({ value: String(c.value), label: c.label }))}
          className="sm:col-span-2"
        />
      </div>

      <button
        type="submit"
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-cobalt px-6 py-4 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
      >
        Complete Signup
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </button>
      <p className="mt-3 text-center text-xs text-mid-grey">
        Not ready to commit? Start with a free trial first.
      </p>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  className = '',
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        className="w-full rounded-md border border-steel bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-steel focus:border-neon-blue"
      />
    </div>
  )
}

function Select({
  label,
  name,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  value?: string
  onChange?: (v: string) => void
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-md border border-steel bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-neon-blue"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

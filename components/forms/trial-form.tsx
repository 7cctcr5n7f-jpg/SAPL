'use client'

import { useState } from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export function TrialForm() {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-10 text-center blue-glow">
        <CheckCircle2 className="size-12 text-neon-blue" />
        <h3 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight">
          You&apos;re In.
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-light-grey">
          Thanks for claiming your free trial. Our team will reach out shortly to
          lock in your first coach-supported session.
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
        Claim Your Free Trial
      </h3>
      <p className="mt-1 text-sm text-light-grey">
        It takes 30 seconds. No payment details required.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" placeholder="Thando" />
        <Field label="Last name" name="lastName" placeholder="Mokoena" />
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@email.com"
          className="sm:col-span-2"
        />
        <Field
          label="Mobile number"
          name="phone"
          type="tel"
          placeholder="+27 00 000 0000"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label
            htmlFor="goal"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey"
          >
            Your main goal
          </label>
          <select
            id="goal"
            name="goal"
            className="w-full rounded-md border border-steel bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-neon-blue"
          >
            <option>Lose fat</option>
            <option>Build strength</option>
            <option>Improve fitness</option>
            <option>Train more consistently</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-cobalt px-6 py-4 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
      >
        Claim Free Trial
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </button>
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
      <label
        htmlFor={name}
        className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey"
      >
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

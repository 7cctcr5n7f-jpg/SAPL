'use client'

import { useState } from 'react'
import { CheckCircle2, Send, Loader2 } from 'lucide-react'

// Recipient inbox for all contact submissions.
const CONTACT_EMAIL = 'hello@tenrounds.co.za'

export function ContactForm({
  heading = 'Send Us A Message',
  subheading = 'We usually reply within one business day.',
  withCompany = false,
  buttonLabel = 'Send Message',
}: {
  heading?: string
  subheading?: string
  withCompany?: boolean
  buttonLabel?: string
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    const formEl = e.currentTarget
    const data = new FormData(formEl)
    data.append('_subject', `New ${withCompany ? 'corporate' : 'website'} enquiry — TENROUNDS`)
    data.append('_captcha', 'false')
    data.append('_template', 'table')

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      })
      if (!res.ok) throw new Error('Request failed')
      formEl.reset()
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-neon-blue/40 bg-card p-10 text-center blue-glow">
        <CheckCircle2 className="size-12 text-neon-blue" />
        <h3 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight">
          Request Sent
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-light-grey">
          Thanks for reaching out — your message is on its way to the TENROUNDS team.
          We&apos;ll reply to you shortly.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-steel bg-card p-6 sm:p-8"
    >
      <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight">
        {heading}
      </h3>
      <p className="mt-1 text-sm text-light-grey">{subheading}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" placeholder="Your name" />
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@email.com"
        />
        {withCompany ? (
          <>
            <Field label="Company" name="company" placeholder="Company name" />
            <Field
              label="Team size"
              name="teamSize"
              placeholder="e.g. 25"
            />
          </>
        ) : (
          <Field
            label="Mobile number"
            name="phone"
            type="tel"
            placeholder="+27 00 000 0000"
            className="sm:col-span-2"
          />
        )}
        <div className="sm:col-span-2">
          <label
            htmlFor="message"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-light-grey"
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            placeholder="Tell us how we can help..."
            className="w-full rounded-md border border-steel bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-steel focus:border-neon-blue"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-cobalt px-6 py-4 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending' ? (
          <>
            Sending
            <Loader2 className="size-4 animate-spin" />
          </>
        ) : (
          <>
            {buttonLabel}
            <Send className="size-4" />
          </>
        )}
      </button>

      {status === 'error' && (
        <p className="mt-3 text-center text-sm text-red-400" role="alert">
          Something went wrong sending your message. Please try again, or email us
          directly at {CONTACT_EMAIL}.
        </p>
      )}
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

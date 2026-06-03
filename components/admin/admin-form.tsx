'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import type { SaveState } from '@/app/actions/admin'

type Action = (prev: SaveState, formData: FormData) => Promise<SaveState>

const baseSaveBtn =
  'inline-flex items-center justify-center gap-2 rounded-md bg-neon-blue px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={baseSaveBtn} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Saving…
        </>
      ) : (
        label
      )}
    </button>
  )
}

/**
 * A form wired to a state-returning server action. Shows a "Saving…" state
 * while submitting and a green "Saved!" confirmation once the action resolves.
 */
export function AdminForm({
  action,
  submitLabel,
  className,
  children,
}: {
  action: Action
  submitLabel: string
  className?: string
  children: React.ReactNode
}) {
  const [state, formAction] = useActionState<SaveState, FormData>(action, null)
  const [showSaved, setShowSaved] = useState(false)
  const lastAt = useRef<number | null>(null)

  useEffect(() => {
    if (state?.ok && state.at !== lastAt.current) {
      lastAt.current = state.at
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 3000)
      return () => clearTimeout(t)
    }
  }, [state])

  return (
    <form action={formAction} className={className ?? 'flex flex-col gap-4'}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} />
        {showSaved ? (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 rounded-md border border-neon-green/50 bg-neon-green/10 px-3 py-1.5 text-sm font-semibold text-neon-green"
          >
            <Check className="size-4" /> Saved!
          </span>
        ) : state && !state.ok ? (
          <span
            role="alert"
            aria-live="assertive"
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive"
          >
            <AlertTriangle className="size-4" /> {state.message}
          </span>
        ) : null}
      </div>
    </form>
  )
}

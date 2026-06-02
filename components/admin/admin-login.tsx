'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import { login } from '@/app/actions/admin'

const initialState: { error: string | null; ok?: boolean } = { error: null }

export function AdminLogin() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(login, initialState)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-20">
      <div className="rounded-2xl border border-steel bg-card p-8">
        <div className="flex size-12 items-center justify-center rounded-full border border-neon-blue/50 bg-black/40 text-neon-blue">
          <Lock className="size-5" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-black uppercase tracking-tight">
          Admin Access
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-light-grey">
          Enter your passcode to manage specials and CHOW winners.
        </p>
        <form action={formAction} className="mt-6 flex flex-col gap-3">
          <label htmlFor="passcode" className="sr-only">
            Passcode
          </label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Passcode"
            className="w-full rounded-md border border-steel bg-background px-4 py-3 text-foreground outline-none focus:border-neon-blue"
          />
          {state?.error ? (
            <p className="text-sm font-medium text-red-400" role="alert">
              {state.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-md bg-neon-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {pending ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

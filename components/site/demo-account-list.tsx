"use client"

import { useState } from "react"
import Link from "next/link"
import { Copy, Check, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DemoAccount } from "@/lib/demo-accounts"

/**
 * Interactive list of demo logins with copy-to-clipboard for each credential.
 * Receives the catalog + shared password from the server page so the
 * client bundle never imports the server-only lib/demo module.
 */
export function DemoAccountList({
  accounts,
  password,
}: {
  accounts: DemoAccount[]
  password: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {accounts.map((acct) => (
        <DemoAccountCard key={acct.key} account={acct} password={password} />
      ))}
    </div>
  )
}

function DemoAccountCard({ account, password }: { account: DemoAccount; password: string }) {
  return (
    <div className="flex flex-col gap-4 border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{account.label}</span>
        <h3 className="heading text-lg">{account.name}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{account.blurb}</p>
      </div>

      <div className="flex flex-col gap-2">
        <CopyRow label="Email" value={account.email} />
        <CopyRow label="Password" value={password} />
      </div>

      <Button asChild size="sm" className="mt-auto w-full">
        <Link href={`/sign-in?email=${encodeURIComponent(account.email)}`}>
          <LogIn className="h-4 w-4" />
          Sign in as {account.label}
        </Link>
      </Button>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — selection still works manually.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/50"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-sm">{value}</span>
      </span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      )}
      <span className="sr-only">Copy {label}</span>
    </button>
  )
}
